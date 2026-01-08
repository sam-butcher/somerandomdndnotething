package com.sambutcher

import com.typedb.driver.TypeDB
import com.typedb.driver.api.Credentials
import com.typedb.driver.api.Driver
import com.typedb.driver.api.DriverOptions
import com.typedb.driver.api.Transaction
import kotlinx.serialization.json.*
import org.slf4j.LoggerFactory

class TypeDBService(
    address: String,
    private val database: String,
    username: String,
    password: String,
    tlsEnabled: Boolean
) {
    private val logger = LoggerFactory.getLogger(TypeDBService::class.java)
    private val driver: Driver = TypeDB.driver(address, Credentials(username, password), DriverOptions(tlsEnabled, null))

    fun close() {
        driver.close()
        logger.info("TypeDB connection closed")
    }

    fun getDungeonGraph(dungeonName: String): DungeonGraph? {
        return try {
            driver.transaction(database, Transaction.Type.READ).use { tx ->
                queryDungeonGraph(tx, dungeonName)
            }
        } catch (e: Exception) {
            logger.error("Error querying dungeon graph for '$dungeonName'", e)
            null
        }
    }

    private fun queryDungeonGraph(tx: Transaction, dungeonName: String): DungeonGraph? {
        // First query: Get dungeon info and rooms
        val dungeonQuery = $$"""
            match
                $d isa dungeon, has name "$$dungeonName";
            fetch { $d.* };
        """.trimIndent()

        logger.info("Executing dungeon query for: $dungeonName")
        val dungeonAnswer = tx.query(dungeonQuery).resolve()
        val dungeonResults = dungeonAnswer.asConceptDocuments().stream().toList()

        if (dungeonResults.isEmpty()) {
            logger.warn("No dungeon found with name: $dungeonName")
            return null
        }

        val dungeonJson = Json.parseToJsonElement(dungeonResults.first().toString()).jsonObject
        val dungeonNameValue = dungeonJson["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val dungeonDescription = dungeonJson["description"]?.jsonPrimitive?.contentOrNull

        // Second query: Get all rooms in the dungeon
        val roomsQuery = $$"""
            match
                $d isa dungeon, has name "$$dungeonName";
                dungeon-composition (dungeon: $d, room-in-dungeon: $r);
            fetch { $r.* };
        """.trimIndent()

        logger.info("Executing rooms query")
        val roomsAnswer = tx.query(roomsQuery).resolve()
        val roomsResults = roomsAnswer.asConceptDocuments().stream().toList()

        // Third query: Get ALL containment relationships (at any depth)
        // This gets all entities that are transitively contained within rooms
        val allEntitiesQuery = $$"""
            match
                $d isa dungeon, has name "$$dungeonName";
                dungeon-composition (dungeon: $d, room-in-dungeon: $r);
                containment ($r, $entity) isa containment;
                $entity isa! $entity-type;
            fetch {
                "entity": { $entity.* },
                "type": $entity-type
            };
        """.trimIndent()

        logger.info("Executing all entities query")
        val entitiesAnswer = tx.query(allEntitiesQuery).resolve()
        val entitiesResults = entitiesAnswer.asConceptDocuments().stream().toList()

        // Build entity map by name
        val entityMap = mutableMapOf<String, JsonObject>()
        val allEntityNames = mutableSetOf<String>()
        entitiesResults.forEach { result ->
            val json = Json.parseToJsonElement(result.toString()).jsonObject
            val entity = json["entity"]?.jsonObject
            val entityName = entity?.get("name")?.jsonPrimitive?.contentOrNull
            if (entityName != null) {
                entityMap[entityName] = json
                allEntityNames.add(entityName)
            }
        }

        // Fourth query: Iteratively get ALL containment relationships at arbitrary depth
        // Start with rooms, then expand to find all nested containers
        val containmentMap = mutableMapOf<String, MutableSet<String>>()
        val processedContainers = mutableSetOf<String>()
        val pendingContainers = roomsResults.mapNotNull { roomResult ->
            val roomJson = Json.parseToJsonElement(roomResult.toString()).jsonObject
            roomJson["name"]?.jsonPrimitive?.contentOrNull
        }.toMutableSet()

        // Iteratively query for containment relationships
        while (pendingContainers.isNotEmpty()) {
            val currentContainers = pendingContainers.toList()
            pendingContainers.clear()

            currentContainers.forEach { containerName ->
                if (processedContainers.contains(containerName)) return@forEach

                val containmentQuery = $$"""
                    match
                        $container isa container, has name "$$containerName";
                        (container: $container, contained: $contained) isa containment;
                        $contained isa! $contained-type;
                    fetch {
                        "contained": $contained.name,
                        "type": $contained-type
                    };
                """.trimIndent()

                val containmentAnswer = tx.query(containmentQuery).resolve()
                val containmentResults = containmentAnswer.asConceptDocuments().stream().toList()

                containmentResults.forEach { result ->
                    val json = Json.parseToJsonElement(result.toString()).jsonObject
                    val containedName = json["contained"]?.jsonPrimitive?.contentOrNull
                    val type = json["type"]?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull

                    if (containedName != null) {
                        // Add to containment map
                        containmentMap.getOrPut(containerName) { mutableSetOf() }.add(containedName)

                        // If the contained item is also a container, add it to pending for further processing
                        if (type == "box-container" || type == "room") {
                            pendingContainers.add(containedName)
                        }

                        // Also query for and store all attributes of this entity if not already in entityMap
                        if (!entityMap.containsKey(containedName)) {
                            val entityQuery = $$"""
                                match
                                    $e has name "$$containedName";
                                    $e isa! $e-type;
                                fetch {
                                    "entity": { $e.* },
                                    "type": $e-type
                                };
                            """.trimIndent()

                            val entityAnswer = tx.query(entityQuery).resolve()
                            val entityResults = entityAnswer.asConceptDocuments().stream().toList()

                            if (entityResults.isNotEmpty()) {
                                val entityJson = Json.parseToJsonElement(entityResults.first().toString()).jsonObject
                                entityMap[containedName] = entityJson
                            }
                        }
                    }
                }

                processedContainers.add(containerName)
            }
        }

        // Build rooms with nested structure
        val rooms = roomsResults.map { roomResult ->
            val roomJson = Json.parseToJsonElement(roomResult.toString()).jsonObject
            val roomName = roomJson["name"]?.jsonPrimitive?.contentOrNull ?: ""
            buildRoom(roomName, roomJson, containmentMap, entityMap)
        }

        return DungeonGraph(dungeonNameValue, dungeonDescription, rooms)
    }

    private fun buildRoom(
        roomName: String,
        roomJson: JsonObject,
        containmentMap: Map<String, Set<String>>,
        entityMap: Map<String, JsonObject>
    ): RoomData {
        val description = roomJson["description"]?.jsonPrimitive?.contentOrNull
        val capacity = roomJson["capacity"]?.jsonPrimitive?.longOrNull

        val containedNames = containmentMap[roomName] ?: emptySet()

        val creatures = mutableListOf<CreatureData>()
        val items = mutableListOf<ItemData>()
        val containers = mutableListOf<ContainerData>()

        containedNames.forEach { containedName ->
            val entityJson = entityMap[containedName]
            if (entityJson != null) {
                val type = entityJson["type"]?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull ?: ""
                val entity = entityJson["entity"]?.jsonObject

                when {
                    type in setOf("monster", "npc", "pc") -> {
                        if (entity != null) creatures.add(parseCreatureFromEntity(entity, type))
                    }
                    type in setOf("item", "magic-item") -> {
                        if (entity != null) items.add(parseItemFromEntity(entity, type))
                    }
                    type == "box-container" -> {
                        if (entity != null) containers.add(buildContainer(containedName, entity, containmentMap, entityMap))
                    }
                }
            }
        }

        return RoomData(roomName, description, capacity, creatures, items, containers)
    }

    private fun buildContainer(
        containerName: String,
        containerJson: JsonObject,
        containmentMap: Map<String, Set<String>>,
        entityMap: Map<String, JsonObject>
    ): ContainerData {
        val description = containerJson["description"]?.jsonPrimitive?.contentOrNull
        val capacity = containerJson["capacity"]?.jsonPrimitive?.longOrNull

        val containedNames = containmentMap[containerName] ?: emptySet()

        val creatures = mutableListOf<CreatureData>()
        val items = mutableListOf<ItemData>()
        val nestedContainers = mutableListOf<ContainerData>()

        containedNames.forEach { containedName ->
            val entityJson = entityMap[containedName]
            if (entityJson != null) {
                val type = entityJson["type"]?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull ?: ""
                val entity = entityJson["entity"]?.jsonObject

                when {
                    type in setOf("monster", "npc", "pc") -> {
                        if (entity != null) creatures.add(parseCreatureFromEntity(entity, type))
                    }
                    type in setOf("item", "magic-item") -> {
                        if (entity != null) items.add(parseItemFromEntity(entity, type))
                    }
                    type == "box-container" -> {
                        // Recursive call for nested containers
                        if (entity != null) nestedContainers.add(buildContainer(containedName, entity, containmentMap, entityMap))
                    }
                }
            }
        }

        return ContainerData.BoxContainer(containerName, description, capacity, items, creatures, nestedContainers)
    }

    private fun parseCreatureFromEntity(entity: JsonObject, type: String): CreatureData {
        val name = entity["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = entity["description"]?.jsonPrimitive?.contentOrNull
        val level = entity["level"]?.jsonPrimitive?.longOrNull
        val hitPoints = entity["hit-points"]?.jsonPrimitive?.longOrNull
        val armorClass = entity["armor-class"]?.jsonPrimitive?.longOrNull
        val isFriendly = entity["is-friendly"]?.jsonPrimitive?.booleanOrNull

        return when (type) {
            "monster" -> CreatureData.Monster(name, description, level, hitPoints, armorClass)
            "npc" -> CreatureData.NPC(name, description, level, hitPoints, armorClass, isFriendly)
            "pc" -> CreatureData.PC(name, description, level, hitPoints, armorClass)
            else -> CreatureData.Monster(name, description, level, hitPoints, armorClass)
        }
    }

    private fun parseItemFromEntity(entity: JsonObject, type: String): ItemData {
        val name = entity["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = entity["description"]?.jsonPrimitive?.contentOrNull

        return when (type) {
            "magic-item" -> ItemData.MagicItem(name, description)
            "item" -> ItemData.RegularItem(name, description)
            else -> ItemData.RegularItem(name, description)
        }
    }
}
