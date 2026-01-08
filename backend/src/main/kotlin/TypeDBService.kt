package com.sambutcher

import com.typedb.driver.TypeDB
import com.typedb.driver.api.Driver
import com.typedb.driver.api.Transaction
import kotlinx.serialization.json.*
import org.slf4j.LoggerFactory

class TypeDBService(
    private val address: String = "localhost:1729",
    private val database: String = "dnd"
) {
    private val logger = LoggerFactory.getLogger(TypeDBService::class.java)
    private var driver: Driver? = null

    fun connect() {
        try {
            // For TypeDB 3.x Core, use driver() with null credentials and options
            driver = TypeDB.driver(address, null, null)
            logger.info("Connected to TypeDB at $address")
        } catch (e: Exception) {
            logger.error("Failed to connect to TypeDB", e)
            throw e
        }
    }

    fun close() {
        driver?.close()
        logger.info("TypeDB connection closed")
    }

    fun getDungeonGraph(dungeonName: String): DungeonGraph? {
        val driver = this.driver ?: throw IllegalStateException("TypeDB driver not connected")

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
                                $c isa creature;
                            fetch {
                                "type": $c.type,
                                "name": $c.name,
                                "description": $c.description,
                                "level": $c.level,
                                "hitPoints": $c.hit-points,
                                "armorClass": $c.armor-class,
                                "isFriendly": $c.is-friendly
                            };
                        ],
                        "items": [
                            match containment (container: $r, contained: $i);
                                $i isa item;
                            fetch {
                                "type": $i.type,
                                "name": $i.name,
                                "description": $i.description,
                                "isMagical": $i.is-magical
                            };
                        ],
                        "containers": [
                            match containment (container: $r, contained: $bc);
                                $bc isa box-container;
                            fetch {
                                "type": "box-container",
                                "name": $bc.name,
                                "description": $bc.description,
                                "capacity": $bc.capacity,
                                "items": [
                                    match containment (container: $bc, contained: $bi);
                                        $bi isa item;
                                    fetch {
                                        "type": $bi.type,
                                        "name": $bi.name,
                                        "description": $bi.description,
                                        "isMagical": $bi.is-magical
                                    };
                                ],
                                "creatures": [
                                    match containment (container: $bc, contained: $bcc);
                                        $bcc isa creature;
                                    fetch {
                                        "type": $bcc.type,
                                        "name": $bcc.name,
                                        "description": $bcc.description,
                                        "level": $bcc.level,
                                        "hitPoints": $bcc.hit-points,
                                        "armorClass": $bcc.armor-class,
                                        "isFriendly": $bcc.is-friendly
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
        val type = json["type"]?.jsonPrimitive?.contentOrNull ?: "creature"
        val name = json["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = json["description"]?.jsonPrimitive?.contentOrNull
        val level = json["level"]?.jsonPrimitive?.longOrNull
        val hitPoints = json["hitPoints"]?.jsonPrimitive?.longOrNull
        val armorClass = json["armorClass"]?.jsonPrimitive?.longOrNull
        val isFriendly = json["isFriendly"]?.jsonPrimitive?.booleanOrNull

        return CreatureData(type, name, description, level, hitPoints, armorClass, isFriendly)
    }

    private fun parseItem(json: JsonObject): ItemData {
        val type = json["type"]?.jsonPrimitive?.contentOrNull ?: "item"
        val name = json["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = json["description"]?.jsonPrimitive?.contentOrNull
        val isMagical = json["isMagical"]?.jsonPrimitive?.booleanOrNull

        return ItemData(type, name, description, isMagical)
    }

    private fun parseContainer(json: JsonObject): ContainerData {
        val type = json["type"]?.jsonPrimitive?.contentOrNull ?: "box-container"
        val name = json["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val description = json["description"]?.jsonPrimitive?.contentOrNull
        val capacity = json["capacity"]?.jsonPrimitive?.longOrNull

        val items = json["items"]?.jsonArray?.map { parseItem(it.jsonObject) } ?: emptyList()
        val creatures = json["creatures"]?.jsonArray?.map { parseCreature(it.jsonObject) } ?: emptyList()
        val containers = json["containers"]?.jsonArray?.map { parseContainer(it.jsonObject) } ?: emptyList()

        return ContainerData(type, name, description, capacity, items, creatures, containers)
    }
}
