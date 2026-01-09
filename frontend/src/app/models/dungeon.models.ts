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

export enum TrapType {
  MECHANICAL = 'Mechanical',
  MAGICAL = 'Magical',
  HYBRID = 'Hybrid'
}

export enum SaveAbility {
  STR = 'STR',
  DEX = 'DEX',
  CON = 'CON',
  INT = 'INT',
  WIS = 'WIS',
  CHA = 'CHA'
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
  'action-cost'?: number;
  'ability-type': 'trait' | 'action' | 'bonus-action' | 'reaction' |
                  'legendary-action' | 'lair-action' | 'mythic-action';
}

export interface StatblockData {
  abilityScores: AbilityScores;
  size: CreatureSize;
  type: CreatureType;
  'challenge-rating'?: string;
  'experience-points'?: number;
  'proficiency-bonus': number;
  speed: SpeedData;
  // Saving throws flattened
  'save-strength'?: number;
  'save-dexterity'?: number;
  'save-constitution'?: number;
  'save-intelligence'?: number;
  'save-wisdom'?: number;
  'save-charisma'?: number;
  // Skills flattened
  'skill-acrobatics'?: number;
  'skill-animal-handling'?: number;
  'skill-arcana'?: number;
  'skill-athletics'?: number;
  'skill-deception'?: number;
  'skill-history'?: number;
  'skill-insight'?: number;
  'skill-intimidation'?: number;
  'skill-investigation'?: number;
  'skill-medicine'?: number;
  'skill-nature'?: number;
  'skill-perception'?: number;
  'skill-performance'?: number;
  'skill-persuasion'?: number;
  'skill-religion'?: number;
  'skill-sleight-of-hand'?: number;
  'skill-stealth'?: number;
  'skill-survival'?: number;
  'damage-resistances': string[];
  'damage-immunities': string[];
  'condition-immunities': string[];
  'damage-vulnerabilities': string[];
  senses: string[];
  languages: string[];
  'passive-perception': number;
  abilities: CreatureAbility[];
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
  randomEncounters: RandomEncounterTable[];
}

export interface RoomData {
  name: string;
  description?: string;
  creatures: CreatureData[];
  items: ItemData[];
  containers: ContainerData[];
  traps: TrapData[];
  'creature-groups': CreatureGroupData[];
}

// Discriminated union types matching backend sealed classes

export type CreatureData = Monster | NPC | PC;

export interface Monster {
  type: 'monster';
  name: string;
  description?: string;
  level?: number;
  'hit-points'?: number;
  'armor-class'?: number;
  alignment?: Alignment;
  statblock?: StatblockData;
}

export interface NPC {
  type: 'npc';
  name: string;
  description?: string;
  level?: number;
  'hit-points'?: number;
  'armor-class'?: number;
  alignment?: Alignment;
  'is-friendly'?: boolean;
  statblock?: StatblockData;
}

export interface PC {
  type: 'pc';
  name: string;
  description?: string;
  level?: number;
  'hit-points'?: number;
  'armor-class'?: number;
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
  'requires-attunement'?: boolean;
  rarity?: Rarity;
}

export type ContainerData = BoxContainer;

export interface BoxContainer {
  type: 'box-container';
  name: string;
  description?: string;
  items: ItemData[];
  creatures: CreatureData[];
  containers: ContainerData[];
  traps: TrapData[];
}

export interface TrapData {
  name: string;
  description?: string;
  'trap-type'?: TrapType;
  'save-dc'?: number;
  'save-ability'?: SaveAbility;
  'damage-dice'?: string;
  'damage-types': string[];
  'trigger-description'?: string;
  'disarm-dc'?: number;
}

export interface CreatureGroupData {
  name: string;
  description?: string;
  'quantity-min'?: number;
  'quantity-max'?: number;
  'quantity-dice'?: string;
  'template-creature'?: CreatureData;
}

export interface RandomEncounterTable {
  id: string;
  name: string;
  description?: string;
  'trigger-condition'?: string;
  encounters: EncounterEntryData[];
}

export interface EncounterEntryData {
  'encounter-number': number;
  name: string;
  description?: string;
  'quantity-min'?: number;
  'quantity-max'?: number;
  'quantity-dice'?: string;
  'template-creature'?: CreatureData;
}
