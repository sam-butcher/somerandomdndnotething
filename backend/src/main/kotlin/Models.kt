package com.sambutcher

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class Alignment {
    @SerialName("Lawful Good") LAWFUL_GOOD,
    @SerialName("Neutral Good") NEUTRAL_GOOD,
    @SerialName("Chaotic Good") CHAOTIC_GOOD,
    @SerialName("Lawful Neutral") LAWFUL_NEUTRAL,
    @SerialName("True Neutral") TRUE_NEUTRAL,
    @SerialName("Chaotic Neutral") CHAOTIC_NEUTRAL,
    @SerialName("Lawful Evil") LAWFUL_EVIL,
    @SerialName("Neutral Evil") NEUTRAL_EVIL,
    @SerialName("Chaotic Evil") CHAOTIC_EVIL,
    @SerialName("Unaligned") UNALIGNED;

    companion object {
        fun fromString(value: String?): Alignment? {
            return when (value) {
                "Lawful Good" -> LAWFUL_GOOD
                "Neutral Good" -> NEUTRAL_GOOD
                "Chaotic Good" -> CHAOTIC_GOOD
                "Lawful Neutral" -> LAWFUL_NEUTRAL
                "True Neutral" -> TRUE_NEUTRAL
                "Chaotic Neutral" -> CHAOTIC_NEUTRAL
                "Lawful Evil" -> LAWFUL_EVIL
                "Neutral Evil" -> NEUTRAL_EVIL
                "Chaotic Evil" -> CHAOTIC_EVIL
                "Unaligned" -> UNALIGNED
                else -> null
            }
        }
    }
}

@Serializable
enum class Rarity {
    @SerialName("Common") COMMON,
    @SerialName("Uncommon") UNCOMMON,
    @SerialName("Rare") RARE,
    @SerialName("Very Rare") VERY_RARE,
    @SerialName("Legendary") LEGENDARY,
    @SerialName("Artifact") ARTIFACT;

    companion object {
        fun fromString(value: String?): Rarity? {
            return when (value) {
                "Common" -> COMMON
                "Uncommon" -> UNCOMMON
                "Rare" -> RARE
                "Very Rare" -> VERY_RARE
                "Legendary" -> LEGENDARY
                "Artifact" -> ARTIFACT
                else -> null
            }
        }
    }
}

@Serializable
data class DungeonGraph(
    val id: String,
    val name: String,
    val description: String? = null,
    val rooms: List<RoomData>
)

@Serializable
data class DungeonSummary(
    val id: String,
    val name: String
)

@Serializable
data class RoomData(
    val name: String,
    val description: String? = null,
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
    abstract val alignment: Alignment?

    @Serializable
    @SerialName("monster")
    data class Monster(
        override val name: String,
        override val description: String? = null,
        override val level: Long? = null,
        override val hitPoints: Long? = null,
        override val armorClass: Long? = null,
        override val alignment: Alignment? = null
    ) : CreatureData()

    @Serializable
    @SerialName("npc")
    data class NPC(
        override val name: String,
        override val description: String? = null,
        override val level: Long? = null,
        override val hitPoints: Long? = null,
        override val armorClass: Long? = null,
        override val alignment: Alignment? = null,
        val isFriendly: Boolean? = null
    ) : CreatureData()

    @Serializable
    @SerialName("pc")
    data class PC(
        override val name: String,
        override val description: String? = null,
        override val level: Long? = null,
        override val hitPoints: Long? = null,
        override val armorClass: Long? = null,
        override val alignment: Alignment? = null
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
        val requiresAttunement: Boolean? = null,
        val rarity: Rarity? = null
    ) : ItemData()
}

// Container type hierarchy matching TypeDB schema
@Serializable
sealed class ContainerData {
    abstract val name: String
    abstract val description: String?
    abstract val items: List<ItemData>
    abstract val creatures: List<CreatureData>

    @Serializable
    @SerialName("box-container")
    data class BoxContainer(
        override val name: String,
        override val description: String? = null,
        override val items: List<ItemData> = emptyList(),
        override val creatures: List<CreatureData> = emptyList(),
        val containers: List<ContainerData> = emptyList() // for nested containers
    ) : ContainerData()
}
