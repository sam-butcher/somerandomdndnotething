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
        // Fetch query to get dungeon with all nested structure
        val query = $$"""
            match
                $d isa dungeon, has name "$$dungeonName";
            fetch {
                "name": $d.name,
                "description": $d.description,
                "rooms": [
                    match dungeon-composition (dungeon: $d, room-in-dungeon: $r);
                    fetch {
                        "name": $r.name,
                        "description": $r.description,
                        "capacity": $r.capacity,
                        "creatures": [
                            match containment (container: $r, contained: $c);
                                $c isa! $c-type;
                                $c-type sub creature;
                            fetch {
                                "type": $c-type,
                                "name": $c.name,
                                "description": $c.description,
                                "level": $c.level,
                                "hitPoints": $c.hit-points,
                                "armorClass": $c.armor-class,
                            };
                        ],
                        "items": [
                            match containment (container: $r, contained: $i);
                                $i isa! $i-type;
                                $i-type sub item;
                            fetch {
                                "type": $i-type,
                                "name": $i.name,
                                "description": $i.description,
                            };
                        ],
                        "containers": [
                            match containment (container: $r, contained: $bc);
                                $bc isa! $bc-type;
                                $bc-type sub box-container;
                            fetch {
                                "type": $bc-type,
                                "name": $bc.name,
                                "description": $bc.description,
                                "capacity": $bc.capacity,
                                "items": [
                                    match containment (container: $bc, contained: $bi);
                                        $bi isa! $bi-type;
                                        $bi-type sub item;
                                    fetch {
                                        "type": $bi-type,
                                        "name": $bi.name,
                                        "description": $bi.description,
                                    };
                                ],
                                "creatures": [
                                    match containment (container: $bc, contained: $bcc);
                                        $bcc isa! $bcc-type;
                                        $bcc-type sub creature;
                                    fetch {
                                        "type": $bcc-type,
                                        "name": $bcc.name,
                                        "description": $bcc.description,
                                        "level": $bcc.level,
                                        "hitPoints": $bcc.hit-points,
                                        "armorClass": $bcc.armor-class,
                                    };
                                ]
                            };
                        ]
                    };
                ]
            };
        """.trimIndent()

        logger.info("Executing query for dungeon: $dungeonName")

        val answer = tx.query(query).resolve()
        val results = answer.asConceptDocuments().stream().toList()

        if (results.isEmpty()) {
            logger.warn("No dungeon found with name: $dungeonName")
            return null
        }

        // Parse the first result (there should only be one dungeon with this name)
        val result = results.first()
        return  parseDungeonGraph(result.toString())
    }

    private fun parseDungeonGraph(resultString: String): DungeonGraph {
        val json = Json.parseToJsonElement(resultString).jsonObject

        val name = json["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = json["description"]?.jsonPrimitive?.contentOrNull
        val roomsJson = json["rooms"]?.jsonArray ?: JsonArray(emptyList())

        val rooms = roomsJson.map { parseRoom(it.jsonObject) }

        return DungeonGraph(name, description, rooms)
    }

    private fun parseRoom(json: JsonObject): RoomData {
        val name = json["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = json["description"]?.jsonPrimitive?.contentOrNull
        val capacity = json["capacity"]?.jsonPrimitive?.longOrNull

        val creatures = json["creatures"]?.jsonArray?.map { parseCreature(it.jsonObject) } ?: emptyList()
        val items = json["items"]?.jsonArray?.map { parseItem(it.jsonObject) } ?: emptyList()
        val containers = json["containers"]?.jsonArray?.map { parseContainer(it.jsonObject) } ?: emptyList()

        return RoomData(name, description, capacity, creatures, items, containers)
    }

    private fun parseCreature(json: JsonObject): CreatureData {
        val type = json["type"]?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull ?: "monster"
        val name = json["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = json["description"]?.jsonPrimitive?.contentOrNull
        val level = json["level"]?.jsonPrimitive?.longOrNull
        val hitPoints = json["hitPoints"]?.jsonPrimitive?.longOrNull
        val armorClass = json["armorClass"]?.jsonPrimitive?.longOrNull
        val isFriendly = json["isFriendly"]?.jsonPrimitive?.booleanOrNull

        return when (type) {
            "monster" -> CreatureData.Monster(name, description, level, hitPoints, armorClass)
            "npc" -> CreatureData.NPC(name, description, level, hitPoints, armorClass, isFriendly)
            "pc" -> CreatureData.PC(name, description, level, hitPoints, armorClass)
            else -> CreatureData.Monster(name, description, level, hitPoints, armorClass) // default to monster
        }
    }

    private fun parseItem(json: JsonObject): ItemData {
        val type = json["type"]?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull ?: "item"
        val name = json["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = json["description"]?.jsonPrimitive?.contentOrNull
        val isMagical = json["isMagical"]?.jsonPrimitive?.booleanOrNull

        return when (type) {
            "magic-item" -> ItemData.MagicItem(name, description, isMagical)
            "item" -> ItemData.RegularItem(name, description)
            else -> ItemData.RegularItem(name, description) // default to regular item
        }
    }

    private fun parseContainer(json: JsonObject): ContainerData {
        val type = json["type"]?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull ?: "box-container"
        val name = json["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = json["description"]?.jsonPrimitive?.contentOrNull
        val capacity = json["capacity"]?.jsonPrimitive?.longOrNull

        val items = json["items"]?.jsonArray?.map { parseItem(it.jsonObject) } ?: emptyList()
        val creatures = json["creatures"]?.jsonArray?.map { parseCreature(it.jsonObject) } ?: emptyList()
        val containers = json["containers"]?.jsonArray?.map { parseContainer(it.jsonObject) } ?: emptyList()

        return when (type) {
            "box-container" -> ContainerData.BoxContainer(name, description, capacity, items, creatures, containers)
            else -> ContainerData.BoxContainer(name, description, capacity, items, creatures, containers) // default to box-container
        }
    }
}
