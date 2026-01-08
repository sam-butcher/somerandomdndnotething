// TypeScript models matching backend API response structure

export interface DungeonGraph {
  name: string;
  description?: string;
  rooms: RoomData[];
}

export interface RoomData {
  name: string;
  description?: string;
  capacity?: number;
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
}

export interface NPC {
  type: 'npc';
  name: string;
  description?: string;
  level?: number;
  hitPoints?: number;
  armorClass?: number;
  isFriendly?: boolean;
}

export interface PC {
  type: 'pc';
  name: string;
  description?: string;
  level?: number;
  hitPoints?: number;
  armorClass?: number;
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
  isMagical?: boolean;
}

export type ContainerData = BoxContainer;

export interface BoxContainer {
  type: 'box-container';
  name: string;
  description?: string;
  capacity?: number;
  items?: ItemData[];
  creatures?: CreatureData[];
  containers?: ContainerData[];
}
