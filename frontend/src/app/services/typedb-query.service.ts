import { Injectable, inject } from '@angular/core';
import { TypeDBConnectionService } from './typedb-connection.service';
import {
  DungeonGraph,
  DungeonSummary,
  RoomData,
  CreatureData,
  ItemData,
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
    // Query 1: Get dungeon structure with transitive containment
    const structure = await this.fetchDungeonStructure(dungeonId);
    if (!structure) return null;

    // Query 2: Get all entity attributes and abilities in one query
    const entityDetails = await this.fetchAllEntityDetails(structure.entityIds);

    // Query 3: Get random encounter tables for this dungeon
    const randomEncounters = await this.fetchRandomEncounters(dungeonId, entityDetails);

    // Build the dungeon graph from structure and details
    return this.buildDungeonFromStructure(structure, entityDetails, randomEncounters);
  }

  /**
   * Query 1: Fetch dungeon structure using transitive containment function
   * Returns: dungeon metadata, rooms, and all containment relationships
   */
  private async fetchDungeonStructure(dungeonId: string): Promise<{
    dungeon: { id: string; name: string; description?: string };
    rooms: Array<{ id: string; name: string; description?: string }>;
    containmentEdges: ContainmentEdge[];
    entityIds: string[];
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
            (dungeon: $dungeon, room-in-dungeon: $room) isa dungeon-composition;
            let $parent, $contained in all_contents($room);
            $contained isa! $contained_type;
          fetch {
            "containerId": $parent.id,
            "containedId": $contained.id,
            "type": $contained_type
          };
        ]
      };
    `;

    return this.connectionService.executeReadQuery(query, (response) => {
      if (response.answerType !== 'conceptDocuments' || response.answers.length === 0) {
        return null;
      }

      const result: any = response.answers[0];
      const dungeon = {
        id: result.dungeon.id as string,
        name: result.dungeon.name as string,
        description: result.dungeon.description as string | undefined,
      };

      const rooms = (result.rooms || []).map((r: any) => ({
        id: r.id as string,
        name: r.name as string,
        description: r.description as string | undefined,
      }));

      const containmentEdges: ContainmentEdge[] = (result.containment || []).map((c: any) => ({
        containerId: c.containerId as string,
        containedId: c.containedId as string,
        containedType: c.type.label as string,
      }));

      // Extract all unique entity IDs
      const entityIds = Array.from(
        new Set(containmentEdges.map((edge) => edge.containedId))
      );

      return { dungeon, rooms, containmentEdges, entityIds };
    });
  }

  /**
   * Query 2: Fetch all entity attributes and abilities in one query
   * Uses 'or' pattern to match any entity ID from the list
   */
  private async fetchAllEntityDetails(entityIds: string[]): Promise<Map<string, EntityAttributes>> {
    if (entityIds.length === 0) {
      return new Map();
    }

    // Build query with all entity IDs using 'or' pattern
    const idPatterns = entityIds.map((id) => `$entity has id "${id}"`).join(';\n    } or {\n      ');

    const query = `
      match
        $entity isa! $entity_type;
        {
          ${idPatterns};
        };
      fetch {
        "id": $entity.id,
        "type": $entity_type,
        "attributes": { $entity.* },
        "abilities": [
          match
            $entity isa creature;
            (creature: $entity, ability: $ability) isa has-ability;
            $ability isa $ability_type;
          fetch {
            "ability": { $ability.* },
            "type": $ability_type
          };
        ]
      };
    `;

    return this.connectionService.executeReadQuery(query, (response) => {
      const entityMap = new Map<string, EntityAttributes>();

      if (response.answerType !== 'conceptDocuments') {
        return entityMap;
      }

      for (const result of response.answers as any[]) {
        const id = result.id as string;
        const entityType = result.type.label as string;
        const attributes = result.attributes;
        const abilities = result.abilities || [];

        // Group abilities by type
        const abilityMap = new Map<string, CreatureAbility[]>();
        for (const abilityData of abilities) {
          const abilityType = abilityData.type.label as string;
          const ability: CreatureAbility = {
            name: abilityData.ability.name as string,
            description: abilityData.ability.description as string,
            actionCost: abilityData.ability['action-cost'] as number | undefined,
          };

          if (!abilityMap.has(abilityType)) {
            abilityMap.set(abilityType, []);
          }
          abilityMap.get(abilityType)!.push(ability);
        }

        entityMap.set(id, {
          ...attributes,
          entityType,
          abilityMap,
        });
      }

      return entityMap;
    });
  }

  /**
   * Build the dungeon graph from structure data and entity details
   */
  private buildDungeonFromStructure(
    structure: {
      dungeon: { id: string; name: string; description?: string };
      rooms: Array<{ id: string; name: string; description?: string }>;
      containmentEdges: ContainmentEdge[];
      entityIds: string[];
    },
    entityDetails: Map<string, EntityAttributes>,
    randomEncounters: RandomEncounterTable[]
  ): DungeonGraph {
    // Build containment map: container ID -> set of contained entity IDs
    const containmentMap = new Map<string, Set<string>>();
    for (const edge of structure.containmentEdges) {
      if (!containmentMap.has(edge.containerId)) {
        containmentMap.set(edge.containerId, new Set());
      }
      containmentMap.get(edge.containerId)!.add(edge.containedId);
    }

    // Build rooms with their contents
    const rooms: RoomData[] = structure.rooms.map((roomData) =>
      this.buildRoom(roomData.id, roomData.name, roomData.description, containmentMap, entityDetails)
    );

    return {
      id: structure.dungeon.id,
      name: structure.dungeon.name,
      description: structure.dungeon.description,
      rooms,
      randomEncounters: randomEncounters.length > 0 ? randomEncounters : undefined,
    };
  }

  private buildRoom(
    roomId: string,
    roomName: string,
    roomDescription: string | undefined,
    containmentMap: Map<string, Set<string>>,
    entityDetails: Map<string, EntityAttributes>
  ): RoomData {
    const contained = containmentMap.get(roomId) || new Set<string>();

    const creatures: CreatureData[] = [];
    const items: ItemData[] = [];
    const containers: ContainerData[] = [];
    const traps: TrapData[] = [];
    const creatureGroups: CreatureGroupData[] = [];

    for (const entityId of contained) {
      const entityData = entityDetails.get(entityId);
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
          entityDetails
        );
        if (container) containers.push(container);
      } else if (entityType === 'trap') {
        const trap = this.parseTrapFromEntity(entityData);
        if (trap) traps.push(trap);
      } else if (entityType === 'creature-group') {
        const creatureGroup = this.parseCreatureGroupFromEntity(entityId, entityData, containmentMap, entityDetails);
        if (creatureGroup) creatureGroups.push(creatureGroup);
      }
    }

    return {
      name: roomName,
      description: roomDescription,
      creatures: creatures.length > 0 ? creatures : undefined,
      items: items.length > 0 ? items : undefined,
      containers: containers.length > 0 ? containers : undefined,
      traps: traps.length > 0 ? traps : undefined,
      creatureGroups: creatureGroups.length > 0 ? creatureGroups : undefined,
    };
  }

  private buildContainer(
    containerId: string,
    containerData: EntityAttributes,
    containmentMap: Map<string, Set<string>>,
    entityDetails: Map<string, EntityAttributes>
  ): ContainerData | null {
    const contained = containmentMap.get(containerId) || new Set<string>();

    const creatures: CreatureData[] = [];
    const items: ItemData[] = [];
    const containers: ContainerData[] = [];
    const traps: TrapData[] = [];

    for (const entityId of contained) {
      const entityData = entityDetails.get(entityId);
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
          entityDetails
        );
        if (nestedContainer) containers.push(nestedContainer);
      } else if (entityType === 'trap') {
        const trap = this.parseTrapFromEntity(entityData);
        if (trap) traps.push(trap);
      }
    }

    return {
      type: 'box-container',
      name: containerData['name'] as string,
      description: containerData['description'] as string | undefined,
      creatures: creatures.length > 0 ? creatures : undefined,
      items: items.length > 0 ? items : undefined,
      containers: containers.length > 0 ? containers : undefined,
      traps: traps.length > 0 ? traps : undefined,
    };
  }

  private parseCreatureFromEntity(
    entity: EntityAttributes,
    entityType: string
  ): CreatureData | null {
    const name = entity['name'] as string;
    const description = entity['description'] as string | undefined;
    const level = entity['level'] as number | undefined;
    const hitPoints = entity['hit-points'] as number | undefined;
    const armorClass = entity['armor-class'] as number | undefined;
    const alignment = entity['alignment'] as Alignment | undefined;

    const statblock = this.buildStatblock(entity);

    if (entityType === 'monster') {
      return {
        type: 'monster',
        name,
        description,
        level,
        hitPoints,
        armorClass,
        alignment,
        statblock: statblock || undefined,
      };
    } else if (entityType === 'npc') {
      const isFriendly = entity['is-friendly'] as boolean | undefined;
      return {
        type: 'npc',
        name,
        description,
        level,
        hitPoints,
        armorClass,
        alignment,
        isFriendly,
        statblock: statblock || undefined,
      };
    } else if (entityType === 'pc') {
      return {
        type: 'pc',
        name,
        description,
        level,
        hitPoints,
        armorClass,
        alignment,
      };
    }

    return null;
  }

  private parseItemFromEntity(entity: EntityAttributes, entityType: string): ItemData | null {
    const name = entity['name'] as string;
    const description = entity['description'] as string | undefined;

    if (entityType === 'magic-item') {
      const rarity = entity['rarity'] as Rarity | undefined;
      const requiresAttunement = entity['requires-attunement'] as boolean | undefined;

      return {
        type: 'magic-item',
        name,
        description,
        rarity,
        requiresAttunement,
      };
    } else {
      return {
        type: 'item',
        name,
        description,
      };
    }
  }

  private buildStatblock(entity: EntityAttributes): StatblockData | null {
    const requiredStats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

    for (const stat of requiredStats) {
      if (entity[stat] === undefined || entity[stat] === null) return null;
    }

    if (!entity['size'] || !entity['creature-type']) return null;

    const abilityMap = entity['abilityMap'] as Map<string, CreatureAbility[]>;

    const parseListAttribute = (key: string): string[] => {
      const value = entity[key];
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const wisdom = entity['wisdom'] as number;
    const passivePerception =
      entity['passive-perception'] || 10 + Math.floor((wisdom - 10) / 2);

    return {
      abilityScores: {
        strength: entity['strength'] as number,
        dexterity: entity['dexterity'] as number,
        constitution: entity['constitution'] as number,
        intelligence: entity['intelligence'] as number,
        wisdom: wisdom,
        charisma: entity['charisma'] as number,
      },
      size: entity['size'] as CreatureSize,
      type: entity['creature-type'] as CreatureType,
      challengeRating: entity['challenge-rating'] as string | undefined,
      experiencePoints: entity['experience-points'] as number | undefined,
      proficiencyBonus: entity['proficiency-bonus'] || 2,
      speed: {
        walk: entity['speed-walk'] as number | undefined,
        fly: entity['speed-fly'] as number | undefined,
        swim: entity['speed-swim'] as number | undefined,
        burrow: entity['speed-burrow'] as number | undefined,
        climb: entity['speed-climb'] as number | undefined,
      },
      savingThrows: {
        strength: entity['save-strength'] as number | undefined,
        dexterity: entity['save-dexterity'] as number | undefined,
        constitution: entity['save-constitution'] as number | undefined,
        intelligence: entity['save-intelligence'] as number | undefined,
        wisdom: entity['save-wisdom'] as number | undefined,
        charisma: entity['save-charisma'] as number | undefined,
      },
      skills: {
        acrobatics: entity['skill-acrobatics'] as number | undefined,
        animalHandling: entity['skill-animal-handling'] as number | undefined,
        arcana: entity['skill-arcana'] as number | undefined,
        athletics: entity['skill-athletics'] as number | undefined,
        deception: entity['skill-deception'] as number | undefined,
        history: entity['skill-history'] as number | undefined,
        insight: entity['skill-insight'] as number | undefined,
        intimidation: entity['skill-intimidation'] as number | undefined,
        investigation: entity['skill-investigation'] as number | undefined,
        medicine: entity['skill-medicine'] as number | undefined,
        nature: entity['skill-nature'] as number | undefined,
        perception: entity['skill-perception'] as number | undefined,
        performance: entity['skill-performance'] as number | undefined,
        persuasion: entity['skill-persuasion'] as number | undefined,
        religion: entity['skill-religion'] as number | undefined,
        sleightOfHand: entity['skill-sleight-of-hand'] as number | undefined,
        stealth: entity['skill-stealth'] as number | undefined,
        survival: entity['skill-survival'] as number | undefined,
      },
      damageResistances: parseListAttribute('damage-resistance'),
      damageImmunities: parseListAttribute('damage-immunity'),
      conditionImmunities: parseListAttribute('condition-immunity'),
      damageVulnerabilities: parseListAttribute('damage-vulnerability'),
      senses: parseListAttribute('sense'),
      languages: parseListAttribute('language'),
      passivePerception,
      traits: abilityMap?.get('trait') || [],
      actions: abilityMap?.get('action') || [],
      bonusActions: abilityMap?.get('bonus-action') || [],
      reactions: abilityMap?.get('reaction') || [],
      legendaryActions: abilityMap?.get('legendary-action') || [],
      lairActions: abilityMap?.get('lair-action') || [],
      mythicActions: abilityMap?.get('mythic-action') || [],
    };
  }

  private parseTrapFromEntity(entity: EntityAttributes): TrapData | null {
    const name = entity['name'] as string;
    if (!name) return null;

    const parseListAttribute = (key: string): string[] => {
      const value = entity[key];
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    return {
      name,
      description: entity['description'] as string | undefined,
      trapType: entity['trap-type'] as TrapType | undefined,
      saveDC: entity['save-dc'] as number | undefined,
      saveAbility: entity['save-ability'] as SaveAbility | undefined,
      damageDice: entity['damage-dice'] as string | undefined,
      damageTypes: parseListAttribute('damage-type'),
      triggerDescription: entity['trigger-description'] as string | undefined,
      disarmDC: entity['disarm-dc'] as number | undefined,
    };
  }

  private parseCreatureGroupFromEntity(
    groupId: string,
    entity: EntityAttributes,
    containmentMap: Map<string, Set<string>>,
    entityDetails: Map<string, EntityAttributes>
  ): CreatureGroupData | null {
    const name = entity['name'] as string;
    if (!name) return null;

    // Get the template creature via group-template relation
    // The template creature should be linked to this group
    let templateCreature: CreatureData | undefined;

    // Look through the containmentMap or entity links to find the template
    // In our schema, the group-template relation connects groups to creatures
    // We need to fetch this separately or include it in the entity details
    // For now, we'll leave it undefined and handle it in the query

    return {
      name,
      description: entity['description'] as string | undefined,
      quantityMin: entity['quantity-min'] as number | undefined,
      quantityMax: entity['quantity-max'] as number | undefined,
      quantityDice: entity['quantity-dice'] as string | undefined,
      templateCreature,
    };
  }

  /**
   * Fetch random encounter tables for a dungeon
   */
  private async fetchRandomEncounters(
    dungeonId: string,
    entityDetails: Map<string, EntityAttributes>
  ): Promise<RandomEncounterTable[]> {
    const query = `
      match
        $dungeon isa dungeon, has id "${dungeonId}";
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
                "id": $creature.id,
                "type": $creature_type
              };
            ]
          };
        ]
      };
    `;

    return this.connectionService.executeReadQuery(query, (response) => {
      if (response.answerType !== 'conceptDocuments' || response.answers.length === 0) {
        return [];
      }

      const tables: RandomEncounterTable[] = [];

      for (const result of response.answers as any[]) {
        const tableData = result.table;
        const entries: EncounterEntryData[] = [];

        for (const entryResult of result.entries || []) {
          const entryData = entryResult.entry;
          let templateCreature: CreatureData | undefined;

          // Get template creature from entity details if available
          if (entryResult.templateCreature && entryResult.templateCreature.length > 0) {
            const templateId = entryResult.templateCreature[0].id as string;
            const templateEntityData = entityDetails.get(templateId);
            if (templateEntityData) {
              const creatureType = entryResult.templateCreature[0].type.label as string;
              templateCreature = this.parseCreatureFromEntity(templateEntityData, creatureType) || undefined;
            }
          }

          entries.push({
            encounterNumber: entryData['encounter-number'] as number,
            name: entryData['name'] as string,
            description: entryData['description'] as string | undefined,
            quantityMin: entryData['quantity-min'] as number | undefined,
            quantityMax: entryData['quantity-max'] as number | undefined,
            quantityDice: entryData['quantity-dice'] as string | undefined,
            templateCreature,
          });
        }

        tables.push({
          id: tableData['id'] as string,
          name: tableData['name'] as string,
          description: tableData['description'] as string | undefined,
          triggerCondition: tableData['trigger-condition'] as string | undefined,
          encounters: entries,
        });
      }

      return tables;
    });
  }
}
