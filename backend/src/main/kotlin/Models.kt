package com.sambutcher

import kotlinx.serialization.SerialName
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

// Creature type hierarchy matching TypeDB schema
@Serializable
sealed class CreatureData {
    abstract val name: String
    abstract val description: String?
    abstract val level: Long?
    abstract val hitPoints: Long?
    abstract val armorClass: Long?

    @Serializable
    @SerialName("monster")
    data class Monster(
        override val name: String,
        override val description: String? = null,
        override val level: Long? = null,
        override val hitPoints: Long? = null,
        override val armorClass: Long? = null
    ) : CreatureData()

    @Serializable
    @SerialName("npc")
    data class NPC(
        override val name: String,
        override val description: String? = null,
        override val level: Long? = null,
        override val hitPoints: Long? = null,
        override val armorClass: Long? = null,
        val isFriendly: Boolean? = null
    ) : CreatureData()

    @Serializable
    @SerialName("pc")
    data class PC(
        override val name: String,
        override val description: String? = null,
        override val level: Long? = null,
        override val hitPoints: Long? = null,
        override val armorClass: Long? = null
    ) : CreatureData()
}

// Item type hierarchy matching TypeDB schema
@Serializable
sealed class ItemData {
    abstract val name: String
    abstract val description: String?

    @Serializable
    @SerialName("item")
    data class RegularItem(
        override val name: String,
        override val description: String? = null
    ) : ItemData()

    @Serializable
    @SerialName("magic-item")
    data class MagicItem(
        override val name: String,
        override val description: String? = null,
    ) : ItemData()
}

// Container type hierarchy matching TypeDB schema
@Serializable
sealed class ContainerData {
    abstract val name: String
    abstract val description: String?
    abstract val capacity: Long?
    abstract val items: List<ItemData>
    abstract val creatures: List<CreatureData>

    @Serializable
    @SerialName("box-container")
    data class BoxContainer(
        override val name: String,
        override val description: String? = null,
        override val capacity: Long? = null,
        override val items: List<ItemData> = emptyList(),
        override val creatures: List<CreatureData> = emptyList(),
        val containers: List<ContainerData> = emptyList() // for nested containers
    ) : ContainerData()
}
