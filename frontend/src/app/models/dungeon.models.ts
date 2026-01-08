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
