// TypeScript models matching backend API response structure

export enum Alignment {
  LAWFUL_GOOD = 'Lawful Good',
  NEUTRAL_GOOD = 'Neutral Good',
  CHAOTIC_GOOD = 'Chaotic Good',
  LAWFUL_NEUTRAL = 'Lawful Neutral',
  TRUE_NEUTRAL = 'True Neutral',
  CHAOTIC_NEUTRAL = 'Chaotic Neutral',
  LAWFUL_EVIL = 'Lawful Evil',
  NEUTRAL_EVIL = 'Neutral Evil',
  CHAOTIC_EVIL = 'Chaotic Evil',
  UNALIGNED = 'Unaligned'
}

export enum Rarity {
  COMMON = 'Common',
  UNCOMMON = 'Uncommon',
  RARE = 'Rare',
  VERY_RARE = 'Very Rare',
  LEGENDARY = 'Legendary',
  ARTIFACT = 'Artifact'
}

export enum CreatureSize {
  TINY = 'Tiny',
  SMALL = 'Small',
  MEDIUM = 'Medium',
  LARGE = 'Large',
  HUGE = 'Huge',
  GARGANTUAN = 'Gargantuan'
}

export enum CreatureType {
  ABERRATION = 'Aberration',
  BEAST = 'Beast',
  CELESTIAL = 'Celestial',
  CONSTRUCT = 'Construct',
  DRAGON = 'Dragon',
  ELEMENTAL = 'Elemental',
  FEY = 'Fey',
  FIEND = 'Fiend',
  GIANT = 'Giant',
  HUMANOID = 'Humanoid',
  MONSTROSITY = 'Monstrosity',
  OOZE = 'Ooze',
  PLANT = 'Plant',
  UNDEAD = 'Undead'
}

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface SpeedData {
  walk?: number;
  fly?: number;
  swim?: number;
  burrow?: number;
  climb?: number;
}

export interface SavingThrows {
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
}

export interface Skills {
  acrobatics?: number;
  animalHandling?: number;
  arcana?: number;
  athletics?: number;
  deception?: number;
  history?: number;
  insight?: number;
  intimidation?: number;
  investigation?: number;
  medicine?: number;
  nature?: number;
  perception?: number;
  performance?: number;
  persuasion?: number;
  religion?: number;
  sleightOfHand?: number;
  stealth?: number;
  survival?: number;
}

export interface CreatureAbility {
  name: string;
  description: string;
  actionCost?: number;
}

export interface StatblockData {
  abilityScores: AbilityScores;
  size: CreatureSize;
  type: CreatureType;
  challengeRating?: string;
  experiencePoints?: number;
  proficiencyBonus: number;
  speed: SpeedData;
  savingThrows?: SavingThrows;
  skills?: Skills;
  damageResistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
  damageVulnerabilities: string[];
  senses: string[];
  languages: string[];
  passivePerception: number;
  traits: CreatureAbility[];
  actions: CreatureAbility[];
  bonusActions: CreatureAbility[];
  reactions: CreatureAbility[];
  legendaryActions: CreatureAbility[];
  lairActions: CreatureAbility[];
  mythicActions: CreatureAbility[];
}

export interface DungeonSummary {
  id: string;
  name: string;
}

export interface DungeonGraph {
  id: string;
  name: string;
  description?: string;
  rooms: RoomData[];
}

export interface RoomData {
  name: string;
  description?: string;
  creatures?: CreatureData[];
  items?: ItemData[];
  containers?: ContainerData[];
}

// Discriminated union types matching backend sealed classes

export type CreatureData = Monster | NPC | PC;

export interface Monster {
  type: 'monster';
  name: string;
  description?: string;
  level?: number;
  hitPoints?: number;
  armorClass?: number;
  alignment?: Alignment;
  statblock?: StatblockData;
}

export interface NPC {
  type: 'npc';
  name: string;
  description?: string;
  level?: number;
  hitPoints?: number;
  armorClass?: number;
  alignment?: Alignment;
  isFriendly?: boolean;
  statblock?: StatblockData;
}

export interface PC {
  type: 'pc';
  name: string;
  description?: string;
  level?: number;
  hitPoints?: number;
  armorClass?: number;
  alignment?: Alignment;
}

export type ItemData = RegularItem | MagicItem;

export interface RegularItem {
  type: 'item';
  name: string;
  description?: string;
}

export interface MagicItem {
  type: 'magic-item';
  name: string;
  description?: string;
  requiresAttunement?: boolean;
  rarity?: Rarity;
}

export type ContainerData = BoxContainer;

export interface BoxContainer {
  type: 'box-container';
  name: string;
  description?: string;
  items?: ItemData[];
  creatures?: CreatureData[];
  containers?: ContainerData[];
}
