import { Injectable, inject } from '@angular/core';
import { TypeDBConnectionService } from './typedb-connection.service';
import {
  DungeonGraph,
  DungeonSummary,
  RoomData,
  CreatureData,
  Monster,
  NPC,
  PC,
  ItemData,
  MagicItem,
  RegularItem,
  ContainerData,
  StatblockData,
  CreatureAbility,
  Alignment,
  Rarity,
  CreatureSize,
  CreatureType,
  TrapData,
  TrapType,
  SaveAbility,
  CreatureGroupData,
  RandomEncounterTable,
  EncounterEntryData,
} from '../models/dungeon.models';
import { QueryResponse } from '@typedb/driver-http';

interface ContainmentEdge {
  containerId: string;
  containedId: string;
  containedType: string;
  entityData: EntityAttributes;
}

interface EntityAttributes {
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class TypeDBQueryService {
  private readonly connectionService = inject(TypeDBConnectionService);

  async getAllDungeons(): Promise<DungeonSummary[]> {
    const query = `
      match
        $d isa dungeon;
      fetch { $d.* };
    `;

    return this.connectionService.executeReadQuery(query, (response) => {
      if (response.answerType !== 'conceptDocuments') {
        return [];
      }
      return response.answers.map((answer: any) => ({
        id: answer.id as string,
        name: answer.name as string,
      }));
    });
  }

  async getDungeonGraph(dungeonId: string): Promise<DungeonGraph | null> {
    // Single query: Get complete dungeon data (structure, entity details, and random encounters)
    const structure = await this.fetchDungeonStructure(dungeonId);
    if (!structure) return null;

    // Build the dungeon graph from all fetched data
    return this.buildDungeonFromStructure(structure);
  }

  /**
   * Fetch complete dungeon data including structure, entity details, and random encounters
   * Returns: dungeon metadata, rooms, containment relationships, entity details, and random encounter tables
   */
  private async fetchDungeonStructure(dungeonId: string): Promise<{
    dungeon: { id: string; name: string; description?: string };
    rooms: Array<{ id: string; name: string; description?: string }>;
    containmentEdges: ContainmentEdge[];
    randomEncounters: RandomEncounterTable[];
  } | null> {
    const query = `
      match
        $dungeon isa dungeon, has id "${dungeonId}";
      fetch {
        "dungeon": { $dungeon.* },
        "rooms": [
          match (dungeon: $dungeon, room-in-dungeon: $room) isa dungeon-composition;
          fetch { $room.* };
        ],
        "containment": [
          match
            dungeon-composition (dungeon: $dungeon, room-in-dungeon: $room);
            let $parent, $contained in all_contents($room);
            $contained isa! $contained_type;
          fetch {
            "containerId": $parent.id,
            "containedId": $contained.id,
            "type": $contained_type,
            "attributes": { $contained.* },
            "abilities": [
              match
                $contained isa creature;
                (creature: $contained, ability: $ability) isa has-ability;
                $ability isa $ability_type;
              fetch {
                "ability": { $ability.* },
                "type": $ability_type
              };
            ]
          };
        ],
        "randomEncounters": [
          match
            dungeon-encounters (dungeon: $dungeon, encounter-table: $table);
          fetch {
            "table": { $table.* },
            "entries": [
              match
                has-encounter-entry (table: $table, entry: $entry);
              fetch {
                "entry": { $entry.* },
                "templateCreature": [
                  match
                    group-template (group: $entry, template-creature: $creature);
                    $creature isa! $creature_type;
                  fetch {
                    "type": $creature_type,
                    "attributes": { $creature.* },
                    "abilities": [
                      match
                        (creature: $creature, ability: $ability) isa has-ability;
                        $ability isa $ability_type;
                      fetch {
                        "ability": { $ability.* },
                        "type": $ability_type
                      };
                    ]
                  };
                ]
              };
            ]
          };
        ]
      };
    `;

    return this.connectionService.executeReadQuery(query, (response) => {
      if (response.answerType !== 'conceptDocuments' || response.answers.length === 0) {
        return null;
      }

      const result: any = response.answers[0];
      const dungeon = result.dungeon;

      const rooms = result.rooms || [];

      const containmentEdges: ContainmentEdge[] = [];

      for (const c of result.containment || []) {
        const containedId = c.containedId as string;
        const entityType = c.type.label as string;

        // Build entity data with abilities
        const entityData: EntityAttributes = {
          ...c.attributes,
          entityType,
          abilities: (c.abilities || []).map((a: any) => ({
            ...a.ability,
            'ability-type': a.type.label,
          })),
        };

        // Add containment edge with inline entity data
        containmentEdges.push({
          containerId: c.containerId as string,
          containedId,
          containedType: entityType,
          entityData,
        });
      }

      // Parse random encounters
      const randomEncounters: RandomEncounterTable[] = [];
      for (const encounterTableResult of result.randomEncounters || []) {
        const tableData = encounterTableResult.table;
        const entries: EncounterEntryData[] = [];

        for (const entryResult of encounterTableResult.entries || []) {
          const entryData = entryResult.entry;
          let templateCreature: CreatureData | undefined;

          // Parse template creature from fetched details
          if (entryResult.templateCreature && entryResult.templateCreature.length > 0) {
            const templateData = entryResult.templateCreature[0];
            const creatureType = templateData.type.label as string;
            const abilities = templateData.abilities || [];

            // Build ability array
            const entityData: EntityAttributes = {
              ...templateData.attributes,
              entityType: creatureType,
              abilities: abilities.map((a: any) => ({
                ...a.ability,
                'ability-type': a.type.label,
              })),
            };

            templateCreature = this.parseCreatureFromEntity(entityData, creatureType) || undefined;
          }

          entries.push({
            ...entryData,
            'template-creature': templateCreature,
          });
        }

        randomEncounters.push({
          ...tableData,
          encounters: entries,
        });
      }

      return { dungeon, rooms, containmentEdges, randomEncounters };
    });
  }

  /**
   * Build the dungeon graph from structure data with inline entity details
   */
  private buildDungeonFromStructure(structure: {
    dungeon: { id: string; name: string; description?: string };
    rooms: Array<{ id: string; name: string; description?: string }>;
    containmentEdges: ContainmentEdge[];
    randomEncounters: RandomEncounterTable[];
  }): DungeonGraph {
    // Build containment map: container ID -> set of contained entity IDs
    const containmentMap = new Map<string, Set<string>>();
    // Build entity data map: entity ID -> entity data
    const entityDataMap = new Map<string, EntityAttributes>();

    for (const edge of structure.containmentEdges) {
      if (!containmentMap.has(edge.containerId)) {
        containmentMap.set(edge.containerId, new Set());
      }
      containmentMap.get(edge.containerId)!.add(edge.containedId);
      entityDataMap.set(edge.containedId, edge.entityData);
    }

    // Build rooms with their contents
    const rooms: RoomData[] = structure.rooms.map((roomData) =>
      this.buildRoom(roomData.id, roomData.name, roomData.description, containmentMap, entityDataMap)
    );

    return {
      ...structure.dungeon,
      rooms,
      randomEncounters: structure.randomEncounters.length > 0 ? structure.randomEncounters : undefined,
    };
  }

  private buildRoom(
    roomId: string,
    roomName: string,
    roomDescription: string | undefined,
    containmentMap: Map<string, Set<string>>,
    entityDataMap: Map<string, EntityAttributes>
  ): RoomData {
    const contained = containmentMap.get(roomId) || new Set<string>();

    const creatures: CreatureData[] = [];
    const items: ItemData[] = [];
    const containers: ContainerData[] = [];
    const traps: TrapData[] = [];
    const creatureGroups: CreatureGroupData[] = [];

    for (const entityId of contained) {
      const entityData = entityDataMap.get(entityId);
      if (!entityData) continue;

      const entityType = entityData['entityType'];

      if (entityType === 'monster' || entityType === 'npc' || entityType === 'pc') {
        const creature = this.parseCreatureFromEntity(entityData, entityType);
        if (creature) creatures.push(creature);
      } else if (entityType === 'item' || entityType === 'magic-item') {
        const item = this.parseItemFromEntity(entityData, entityType);
        if (item) items.push(item);
      } else if (entityType === 'box-container') {
        const container = this.buildContainer(
          entityId,
          entityData,
          containmentMap,
          entityDataMap
        );
        if (container) containers.push(container);
      } else if (entityType === 'trap') {
        const trap = this.parseTrapFromEntity(entityData);
        if (trap) traps.push(trap);
      } else if (entityType === 'creature-group') {
        creatureGroups.push(entityData as CreatureGroupData);
      }
    }

    return {
      name: roomName,
      description: roomDescription,
      creatures,
      items,
      containers,
      traps,
      'creature-groups': creatureGroups,
    };
  }

  private buildContainer(
    containerId: string,
    containerData: EntityAttributes,
    containmentMap: Map<string, Set<string>>,
    entityDataMap: Map<string, EntityAttributes>
  ): ContainerData | null {
    const contained = containmentMap.get(containerId) || new Set<string>();

    const creatures: CreatureData[] = [];
    const items: ItemData[] = [];
    const containers: ContainerData[] = [];
    const traps: TrapData[] = [];

    for (const entityId of contained) {
      const entityData = entityDataMap.get(entityId);
      if (!entityData) continue;

      const entityType = entityData['entityType'];

      if (entityType === 'monster' || entityType === 'npc' || entityType === 'pc') {
        const creature = this.parseCreatureFromEntity(entityData, entityType);
        if (creature) creatures.push(creature);
      } else if (entityType === 'item' || entityType === 'magic-item') {
        const item = this.parseItemFromEntity(entityData, entityType);
        if (item) items.push(item);
      } else if (entityType === 'box-container') {
        const nestedContainer = this.buildContainer(
          entityId,
          entityData,
          containmentMap,
          entityDataMap
        );
        if (nestedContainer) containers.push(nestedContainer);
      } else if (entityType === 'trap') {
        const trap = this.parseTrapFromEntity(entityData);
        if (trap) traps.push(trap);
      }
    }

    return {
      ...containerData,
      type: 'box-container',
      name: containerData['name'] as string,
      creatures,
      items,
      containers,
      traps,
    };
  }

  private parseCreatureFromEntity(
    entity: EntityAttributes,
    entityType: string
  ): CreatureData | null {
    const statblock = this.buildStatblock(entity);

    if (entityType === 'monster') {
      return {
        type: 'monster',
        ...entity,
        statblock: statblock || undefined,
      } as Monster;
    } else if (entityType === 'npc') {
      return {
        type: 'npc',
        ...entity,
        statblock: statblock || undefined,
      } as NPC;
    } else if (entityType === 'pc') {
      return {
        type: 'pc',
        ...entity,
      } as PC;
    }

    return null;
  }

  private parseItemFromEntity(entity: EntityAttributes, entityType: string): ItemData | null {
    if (entityType === 'magic-item') {
      return {
        type: 'magic-item',
        ...entity,
      } as MagicItem;
    } else {
      return {
        type: 'item',
        ...entity,
      } as RegularItem;
    }
  }

  private buildStatblock(entity: EntityAttributes): StatblockData | null {
    const requiredStats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

    for (const stat of requiredStats) {
      if (entity[stat] === undefined || entity[stat] === null) return null;
    }

    if (!entity['size'] || !entity['creature-type']) return null;

    const parseListAttribute = (key: string): string[] => {
      const value = entity[key];
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const wisdom = entity['wisdom'] as number;
    const passivePerception =
      entity['passive-perception'] || 10 + Math.floor((wisdom - 10) / 2);

    return {
      ...entity,
      abilityScores: {
        strength: entity['strength'],
        dexterity: entity['dexterity'],
        constitution: entity['constitution'],
        intelligence: entity['intelligence'],
        wisdom: entity['wisdom'],
        charisma: entity['charisma'],
      },
      size: entity['size'],
      type: entity['creature-type'],
      'proficiency-bonus': entity['proficiency-bonus'] || 2,
      speed: {
        walk: entity['speed-walk'],
        fly: entity['speed-fly'],
        swim: entity['speed-swim'],
        burrow: entity['speed-burrow'],
        climb: entity['speed-climb'],
      },
      'damage-resistances': parseListAttribute('damage-resistance'),
      'damage-immunities': parseListAttribute('damage-immunity'),
      'condition-immunities': parseListAttribute('condition-immunity'),
      'damage-vulnerabilities': parseListAttribute('damage-vulnerability'),
      senses: parseListAttribute('sense'),
      languages: parseListAttribute('language'),
      'passive-perception': passivePerception,
      abilities: entity['abilities'] || [],
    } as StatblockData;
  }

  private parseTrapFromEntity(entity: EntityAttributes): TrapData | null {
    if (!entity['name']) return null;

    const parseListAttribute = (key: string): string[] => {
      const value = entity[key];
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    return {
      ...entity,
      'damage-types': parseListAttribute('damage-type'),
    } as TrapData;
  }

}
