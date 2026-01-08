package com.sambutcher

import kotlinx.serialization.Serializable

@Serializable
data class DungeonGraph(
    val name: String,
    val description: String? = null,
    val rooms: List<RoomData>
)

@Serializable
data class RoomData(
    val name: String,
    val description: String? = null,
    val capacity: Long? = null,
    val creatures: List<CreatureData> = emptyList(),
    val items: List<ItemData> = emptyList(),
    val containers: List<ContainerData> = emptyList()
)

@Serializable
data class CreatureData(
    val type: String, // "monster", "npc", or "pc"
    val name: String,
    val description: String? = null,
    val level: Long? = null,
    val hitPoints: Long? = null,
    val armorClass: Long? = null,
    val isFriendly: Boolean? = null // for NPCs
)

@Serializable
data class ItemData(
    val type: String, // "item" or "magic-item"
    val name: String,
    val description: String? = null,
    val isMagical: Boolean? = null
)

@Serializable
data class ContainerData(
    val type: String, // "box-container"
    val name: String,
    val description: String? = null,
    val capacity: Long? = null,
    val items: List<ItemData> = emptyList(),
    val creatures: List<CreatureData> = emptyList(),
    val containers: List<ContainerData> = emptyList() // for nested containers
)
