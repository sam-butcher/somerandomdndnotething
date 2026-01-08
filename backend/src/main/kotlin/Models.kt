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
enum class CreatureSize {
    @SerialName("Tiny") TINY,
    @SerialName("Small") SMALL,
    @SerialName("Medium") MEDIUM,
    @SerialName("Large") LARGE,
    @SerialName("Huge") HUGE,
    @SerialName("Gargantuan") GARGANTUAN;

    companion object {
        fun fromString(value: String?): CreatureSize? = when (value) {
            "Tiny" -> TINY
            "Small" -> SMALL
            "Medium" -> MEDIUM
            "Large" -> LARGE
            "Huge" -> HUGE
            "Gargantuan" -> GARGANTUAN
            else -> null
        }
    }
}

@Serializable
enum class CreatureType {
    @SerialName("Aberration") ABERRATION,
    @SerialName("Beast") BEAST,
    @SerialName("Celestial") CELESTIAL,
    @SerialName("Construct") CONSTRUCT,
    @SerialName("Dragon") DRAGON,
    @SerialName("Elemental") ELEMENTAL,
    @SerialName("Fey") FEY,
    @SerialName("Fiend") FIEND,
    @SerialName("Giant") GIANT,
    @SerialName("Humanoid") HUMANOID,
    @SerialName("Monstrosity") MONSTROSITY,
    @SerialName("Ooze") OOZE,
    @SerialName("Plant") PLANT,
    @SerialName("Undead") UNDEAD;

    companion object {
        fun fromString(value: String?): CreatureType? = when (value) {
            "Aberration" -> ABERRATION
            "Beast" -> BEAST
            "Celestial" -> CELESTIAL
            "Construct" -> CONSTRUCT
            "Dragon" -> DRAGON
            "Elemental" -> ELEMENTAL
            "Fey" -> FEY
            "Fiend" -> FIEND
            "Giant" -> GIANT
            "Humanoid" -> HUMANOID
            "Monstrosity" -> MONSTROSITY
            "Ooze" -> OOZE
            "Plant" -> PLANT
            "Undead" -> UNDEAD
            else -> null
        }
    }
}

@Serializable
data class AbilityScores(
    val strength: Long,
    val dexterity: Long,
    val constitution: Long,
    val intelligence: Long,
    val wisdom: Long,
    val charisma: Long
)

@Serializable
data class SpeedData(
    val walk: Long? = null,
    val fly: Long? = null,
    val swim: Long? = null,
    val burrow: Long? = null,
    val climb: Long? = null
)

@Serializable
data class SavingThrows(
    val strength: Long? = null,
    val dexterity: Long? = null,
    val constitution: Long? = null,
    val intelligence: Long? = null,
    val wisdom: Long? = null,
    val charisma: Long? = null
)

@Serializable
data class Skills(
    val acrobatics: Long? = null,
    val animalHandling: Long? = null,
    val arcana: Long? = null,
    val athletics: Long? = null,
    val deception: Long? = null,
    val history: Long? = null,
    val insight: Long? = null,
    val intimidation: Long? = null,
    val investigation: Long? = null,
    val medicine: Long? = null,
    val nature: Long? = null,
    val perception: Long? = null,
    val performance: Long? = null,
    val persuasion: Long? = null,
    val religion: Long? = null,
    val sleightOfHand: Long? = null,
    val stealth: Long? = null,
    val survival: Long? = null
)

@Serializable
data class CreatureAbility(
    val name: String,
    val description: String,
    val actionCost: Long? = null
)

@Serializable
data class StatblockData(
    val abilityScores: AbilityScores,
    val size: CreatureSize,
    val type: CreatureType,
    val challengeRating: String? = null,
    val experiencePoints: Long? = null,
    val proficiencyBonus: Long,
    val speed: SpeedData,
    val savingThrows: SavingThrows? = null,
    val skills: Skills? = null,
    val damageResistances: List<String> = emptyList(),
    val damageImmunities: List<String> = emptyList(),
    val conditionImmunities: List<String> = emptyList(),
    val damageVulnerabilities: List<String> = emptyList(),
    val senses: List<String> = emptyList(),
    val languages: List<String> = emptyList(),
    val passivePerception: Long,
    val traits: List<CreatureAbility> = emptyList(),
    val actions: List<CreatureAbility> = emptyList(),
    val bonusActions: List<CreatureAbility> = emptyList(),
    val reactions: List<CreatureAbility> = emptyList(),
    val legendaryActions: List<CreatureAbility> = emptyList(),
    val lairActions: List<CreatureAbility> = emptyList(),
    val mythicActions: List<CreatureAbility> = emptyList()
)

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
        override val alignment: Alignment? = null,
        val statblock: StatblockData? = null
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
        val isFriendly: Boolean? = null,
        val statblock: StatblockData? = null
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
