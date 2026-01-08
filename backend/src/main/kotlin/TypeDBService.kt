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

    fun getAllDungeons(): List<DungeonSummary> {
        return try {
            driver.transaction(database, Transaction.Type.READ).use { tx ->
                queryAllDungeons(tx)
            }
        } catch (e: Exception) {
            logger.error("Error querying all dungeons", e)
            emptyList()
        }
    }

    fun getDungeonGraph(dungeonId: String): DungeonGraph? {
        return try {
            driver.transaction(database, Transaction.Type.READ).use { tx ->
                queryDungeonGraph(tx, dungeonId)
            }
        } catch (e: Exception) {
            logger.error("Error querying dungeon graph for '$dungeonId'", e)
            null
        }
    }

    private fun queryAllDungeons(tx: Transaction): List<DungeonSummary> {
        val query = $$"""
            match
                $d isa dungeon;
            fetch {
                "id": $d.id,
                "name": $d.name
            };
        """.trimIndent()

        logger.info("Executing query for all dungeons")
        val answer = tx.query(query).resolve()
        val results = answer.asConceptDocuments().stream().toList()

        return results.mapNotNull { result ->
            val json = Json.parseToJsonElement(result.toString()).jsonObject
            val id = json["id"]?.jsonPrimitive?.contentOrNull
            val name = json["name"]?.jsonPrimitive?.contentOrNull
            if (id != null && name != null) {
                DungeonSummary(id, name)
            } else {
                null
            }
        }
    }

    private fun queryDungeonGraph(tx: Transaction, dungeonId: String): DungeonGraph? {
        // First query: Get dungeon info and rooms
        val dungeonQuery = $$"""
            match
                $d isa dungeon, has id "$$dungeonId";
            fetch { $d.* };
        """.trimIndent()

        logger.info("Executing dungeon query for ID: $dungeonId")
        val dungeonAnswer = tx.query(dungeonQuery).resolve()
        val dungeonResults = dungeonAnswer.asConceptDocuments().stream().toList()

        if (dungeonResults.isEmpty()) {
            logger.warn("No dungeon found with ID: $dungeonId")
            return null
        }

        val dungeonJson = Json.parseToJsonElement(dungeonResults.first().toString()).jsonObject
        val dungeonIdValue = dungeonJson["id"]?.jsonPrimitive?.contentOrNull ?: ""
        val dungeonNameValue = dungeonJson["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val dungeonDescription = dungeonJson["description"]?.jsonPrimitive?.contentOrNull

        // Second query: Get all rooms in the dungeon
        val roomsQuery = $$"""
            match
                $d isa dungeon, has id "$$dungeonId";
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
                $d isa dungeon, has id "$$dungeonId";
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
            buildRoom(roomName, roomJson, containmentMap, entityMap, tx)
        }

        return DungeonGraph(dungeonIdValue, dungeonNameValue, dungeonDescription, rooms)
    }

    private fun queryCreatureAbilities(tx: Transaction, creatureName: String): Map<String, List<CreatureAbility>> {
        val query = $$"""
            match
                $c isa creature, has name "$$creatureName";
                (creature: $c, ability: $a) isa has-ability;
                $a isa! $ability-type;
            fetch {
                "ability": { $a.* },
                "type": $ability-type
            };
        """.trimIndent()

        val answer = tx.query(query).resolve()
        val results = answer.asConceptDocuments().stream().toList()

        val abilityMap = mutableMapOf<String, MutableList<CreatureAbility>>()

        results.forEach { result ->
            val json = Json.parseToJsonElement(result.toString()).jsonObject
            val abilityJson = json["ability"]?.jsonObject
            val type = json["type"]?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull

            if (abilityJson != null && type != null) {
                val ability = CreatureAbility(
                    name = abilityJson["name"]?.jsonPrimitive?.contentOrNull ?: "",
                    description = abilityJson["description"]?.jsonPrimitive?.contentOrNull ?: "",
                    actionCost = abilityJson["action-cost"]?.jsonPrimitive?.longOrNull
                )

                abilityMap.getOrPut(type) { mutableListOf() }.add(ability)
            }
        }

        return abilityMap
    }

    private fun buildStatblock(tx: Transaction, entity: JsonObject, creatureName: String): StatblockData? {
        // Check required fields
        val str = entity["strength"]?.jsonPrimitive?.longOrNull ?: return null
        val dex = entity["dexterity"]?.jsonPrimitive?.longOrNull ?: return null
        val con = entity["constitution"]?.jsonPrimitive?.longOrNull ?: return null
        val int = entity["intelligence"]?.jsonPrimitive?.longOrNull ?: return null
        val wis = entity["wisdom"]?.jsonPrimitive?.longOrNull ?: return null
        val cha = entity["charisma"]?.jsonPrimitive?.longOrNull ?: return null

        val size = CreatureSize.fromString(entity["size"]?.jsonPrimitive?.contentOrNull) ?: return null
        val type = CreatureType.fromString(entity["creature-type"]?.jsonPrimitive?.contentOrNull) ?: return null

        val profBonus = entity["proficiency-bonus"]?.jsonPrimitive?.longOrNull ?: 2
        val passivePerception = entity["passive-perception"]?.jsonPrimitive?.longOrNull ?: (10 + (wis - 10) / 2)

        // Parse comma-separated lists
        fun parseList(value: String?): List<String> =
            value?.split(",")?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()

        val abilityMap = queryCreatureAbilities(tx, creatureName)

        return StatblockData(
            abilityScores = AbilityScores(str, dex, con, int, wis, cha),
            size = size,
            type = type,
            challengeRating = entity["challenge-rating"]?.jsonPrimitive?.contentOrNull,
            experiencePoints = entity["experience-points"]?.jsonPrimitive?.longOrNull,
            proficiencyBonus = profBonus,
            speed = SpeedData(
                walk = entity["speed-walk"]?.jsonPrimitive?.longOrNull,
                fly = entity["speed-fly"]?.jsonPrimitive?.longOrNull,
                swim = entity["speed-swim"]?.jsonPrimitive?.longOrNull,
                burrow = entity["speed-burrow"]?.jsonPrimitive?.longOrNull,
                climb = entity["speed-climb"]?.jsonPrimitive?.longOrNull
            ),
            savingThrows = SavingThrows(
                strength = entity["save-strength"]?.jsonPrimitive?.longOrNull,
                dexterity = entity["save-dexterity"]?.jsonPrimitive?.longOrNull,
                constitution = entity["save-constitution"]?.jsonPrimitive?.longOrNull,
                intelligence = entity["save-intelligence"]?.jsonPrimitive?.longOrNull,
                wisdom = entity["save-wisdom"]?.jsonPrimitive?.longOrNull,
                charisma = entity["save-charisma"]?.jsonPrimitive?.longOrNull
            ),
            skills = Skills(
                acrobatics = entity["skill-acrobatics"]?.jsonPrimitive?.longOrNull,
                animalHandling = entity["skill-animal-handling"]?.jsonPrimitive?.longOrNull,
                arcana = entity["skill-arcana"]?.jsonPrimitive?.longOrNull,
                athletics = entity["skill-athletics"]?.jsonPrimitive?.longOrNull,
                deception = entity["skill-deception"]?.jsonPrimitive?.longOrNull,
                history = entity["skill-history"]?.jsonPrimitive?.longOrNull,
                insight = entity["skill-insight"]?.jsonPrimitive?.longOrNull,
                intimidation = entity["skill-intimidation"]?.jsonPrimitive?.longOrNull,
                investigation = entity["skill-investigation"]?.jsonPrimitive?.longOrNull,
                medicine = entity["skill-medicine"]?.jsonPrimitive?.longOrNull,
                nature = entity["skill-nature"]?.jsonPrimitive?.longOrNull,
                perception = entity["skill-perception"]?.jsonPrimitive?.longOrNull,
                performance = entity["skill-performance"]?.jsonPrimitive?.longOrNull,
                persuasion = entity["skill-persuasion"]?.jsonPrimitive?.longOrNull,
                religion = entity["skill-religion"]?.jsonPrimitive?.longOrNull,
                sleightOfHand = entity["skill-sleight-of-hand"]?.jsonPrimitive?.longOrNull,
                stealth = entity["skill-stealth"]?.jsonPrimitive?.longOrNull,
                survival = entity["skill-survival"]?.jsonPrimitive?.longOrNull
            ),
            damageResistances = parseList(entity["damage-resistances"]?.jsonPrimitive?.contentOrNull),
            damageImmunities = parseList(entity["damage-immunities"]?.jsonPrimitive?.contentOrNull),
            conditionImmunities = parseList(entity["condition-immunities"]?.jsonPrimitive?.contentOrNull),
            damageVulnerabilities = parseList(entity["damage-vulnerabilities"]?.jsonPrimitive?.contentOrNull),
            senses = parseList(entity["senses"]?.jsonPrimitive?.contentOrNull),
            languages = parseList(entity["languages"]?.jsonPrimitive?.contentOrNull),
            passivePerception = passivePerception,
            traits = abilityMap["trait"] ?: emptyList(),
            actions = abilityMap["action"] ?: emptyList(),
            bonusActions = abilityMap["bonus-action"] ?: emptyList(),
            reactions = abilityMap["reaction"] ?: emptyList(),
            legendaryActions = abilityMap["legendary-action"] ?: emptyList(),
            lairActions = abilityMap["lair-action"] ?: emptyList(),
            mythicActions = abilityMap["mythic-action"] ?: emptyList()
        )
    }

    private fun buildRoom(
        roomName: String,
        roomJson: JsonObject,
        containmentMap: Map<String, Set<String>>,
        entityMap: Map<String, JsonObject>,
        tx: Transaction
    ): RoomData {
        val description = roomJson["description"]?.jsonPrimitive?.contentOrNull

        val containedNames = containmentMap[roomName] ?: emptySet()

        val creatures = mutableListOf<CreatureData>()
        val items = mutableListOf<ItemData>()
        val containers = mutableListOf<ContainerData>()

        containedNames.forEach { containedName ->
            val entityJson = entityMap[containedName]
            if (entityJson != null) {
                val type = entityJson["type"]?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull ?: ""
                val entity = entityJson["entity"]?.jsonObject

                when (type) {
                    in setOf("monster", "npc", "pc") -> {
                        if (entity != null) creatures.add(parseCreatureFromEntity(entity, type, tx))
                    }
                    in setOf("item", "magic-item") -> {
                        if (entity != null) items.add(parseItemFromEntity(entity, type))
                    }
                    "box-container" -> {
                        if (entity != null) containers.add(buildContainer(containedName, entity, containmentMap, entityMap, tx))
                    }
                }
            }
        }

        return RoomData(roomName, description, creatures, items, containers)
    }

    private fun buildContainer(
        containerName: String,
        containerJson: JsonObject,
        containmentMap: Map<String, Set<String>>,
        entityMap: Map<String, JsonObject>,
        tx: Transaction
    ): ContainerData {
        val description = containerJson["description"]?.jsonPrimitive?.contentOrNull

        val containedNames = containmentMap[containerName] ?: emptySet()

        val creatures = mutableListOf<CreatureData>()
        val items = mutableListOf<ItemData>()
        val nestedContainers = mutableListOf<ContainerData>()

        containedNames.forEach { containedName ->
            val entityJson = entityMap[containedName]
            if (entityJson != null) {
                val type = entityJson["type"]?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull ?: ""
                val entity = entityJson["entity"]?.jsonObject

                when (type) {
                    in setOf("monster", "npc", "pc") -> {
                        if (entity != null) creatures.add(parseCreatureFromEntity(entity, type, tx))
                    }
                    in setOf("item", "magic-item") -> {
                        if (entity != null) items.add(parseItemFromEntity(entity, type))
                    }
                    "box-container" -> {
                        // Recursive call for nested containers
                        if (entity != null) nestedContainers.add(buildContainer(containedName, entity, containmentMap, entityMap, tx))
                    }
                }
            }
        }

        return ContainerData.BoxContainer(containerName, description, items, creatures, nestedContainers)
    }

    private fun parseCreatureFromEntity(entity: JsonObject, type: String, tx: Transaction): CreatureData {
        val name = entity["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = entity["description"]?.jsonPrimitive?.contentOrNull
        val level = entity["level"]?.jsonPrimitive?.longOrNull
        val hitPoints = entity["hit-points"]?.jsonPrimitive?.longOrNull
        val armorClass = entity["armor-class"]?.jsonPrimitive?.longOrNull
        val alignmentStr = entity["alignment"]?.jsonPrimitive?.contentOrNull
        val alignment = Alignment.fromString(alignmentStr)
        val isFriendly = entity["is-friendly"]?.jsonPrimitive?.booleanOrNull

        // Build statblock for Monster and NPC only
        val statblock = if (type == "monster" || type == "npc") {
            buildStatblock(tx, entity, name)
        } else null

        return when (type) {
            "monster" -> CreatureData.Monster(name, description, level, hitPoints, armorClass, alignment, statblock)
            "npc" -> CreatureData.NPC(name, description, level, hitPoints, armorClass, alignment, isFriendly, statblock)
            "pc" -> CreatureData.PC(name, description, level, hitPoints, armorClass, alignment)
            else -> CreatureData.Monster(name, description, level, hitPoints, armorClass, alignment, statblock)
        }
    }

    private fun parseItemFromEntity(entity: JsonObject, type: String): ItemData {
        val name = entity["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = entity["description"]?.jsonPrimitive?.contentOrNull
        val requiresAttunement = entity["requires-attunement"]?.jsonPrimitive?.booleanOrNull
        val rarityStr = entity["rarity"]?.jsonPrimitive?.contentOrNull
        val rarity = Rarity.fromString(rarityStr)

        return when (type) {
            "magic-item" -> ItemData.MagicItem(name, description, requiresAttunement, rarity)
            "item" -> ItemData.RegularItem(name, description)
            else -> ItemData.RegularItem(name, description)
        }
    }
}
