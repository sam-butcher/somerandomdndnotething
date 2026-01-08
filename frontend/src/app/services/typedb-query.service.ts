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
} from '../models/dungeon.models';
import { QueryResponse } from '@typedb/driver-http';

interface ContainmentEdge {
  containerName: string;
  containedName: string;
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
    const entityDetails = await this.fetchAllEntityDetails(structure.entityNames);

    // Build the dungeon graph from structure and details
    return this.buildDungeonFromStructure(structure, entityDetails);
  }

  /**
   * Query 1: Fetch dungeon structure using transitive containment function
   * Returns: dungeon metadata, rooms, and all containment relationships
   */
  private async fetchDungeonStructure(dungeonId: string): Promise<{
    dungeon: { id: string; name: string; description?: string };
    rooms: Array<{ name: string; description?: string }>;
    containmentEdges: ContainmentEdge[];
    entityNames: string[];
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
            "container": $parent.name,
            "contained": $contained.name,
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
        name: r.name as string,
        description: r.description as string | undefined,
      }));

      const containmentEdges: ContainmentEdge[] = (result.containment || []).map((c: any) => ({
        containerName: c.container as string,
        containedName: c.contained as string,
        containedType: c.type.label as string,
      }));

      // Extract all unique entity names
      const entityNames = Array.from(
        new Set(containmentEdges.map((edge) => edge.containedName))
      );

      return { dungeon, rooms, containmentEdges, entityNames };
    });
  }

  /**
   * Query 2: Fetch all entity attributes and abilities in one query
   * Uses 'or' pattern to match any entity name from the list
   */
  private async fetchAllEntityDetails(entityNames: string[]): Promise<Map<string, EntityAttributes>> {
    if (entityNames.length === 0) {
      return new Map();
    }

    // Build query with all entity names using 'or' pattern
    const namePatterns = entityNames.map((name) => `$entity has name "${name}"`).join(';\n    } or {\n      ');

    const query = `
      match
        $entity isa! $entity_type;
        {
          ${namePatterns};
        };
      fetch {
        "name": $entity.name,
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
        const name = result.name as string;
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

        entityMap.set(name, {
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
      rooms: Array<{ name: string; description?: string }>;
      containmentEdges: ContainmentEdge[];
      entityNames: string[];
    },
    entityDetails: Map<string, EntityAttributes>
  ): DungeonGraph {
    // Build containment map: container name -> set of contained entity names
    const containmentMap = new Map<string, Set<string>>();
    for (const edge of structure.containmentEdges) {
      if (!containmentMap.has(edge.containerName)) {
        containmentMap.set(edge.containerName, new Set());
      }
      containmentMap.get(edge.containerName)!.add(edge.containedName);
    }

    // Build rooms with their contents
    const rooms: RoomData[] = structure.rooms.map((roomData) =>
      this.buildRoom(roomData.name, roomData.description, containmentMap, entityDetails)
    );

    return {
      id: structure.dungeon.id,
      name: structure.dungeon.name,
      description: structure.dungeon.description,
      rooms,
    };
  }

  private buildRoom(
    roomName: string,
    roomDescription: string | undefined,
    containmentMap: Map<string, Set<string>>,
    entityDetails: Map<string, EntityAttributes>
  ): RoomData {
    const contained = containmentMap.get(roomName) || new Set<string>();

    const creatures: CreatureData[] = [];
    const items: ItemData[] = [];
    const containers: ContainerData[] = [];

    for (const entityName of contained) {
      const entityData = entityDetails.get(entityName);
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
          entityName,
          entityData,
          containmentMap,
          entityDetails
        );
        if (container) containers.push(container);
      }
    }

    return {
      name: roomName,
      description: roomDescription,
      creatures,
      items,
      containers,
    };
  }

  private buildContainer(
    containerName: string,
    containerData: EntityAttributes,
    containmentMap: Map<string, Set<string>>,
    entityDetails: Map<string, EntityAttributes>
  ): ContainerData | null {
    const contained = containmentMap.get(containerName) || new Set<string>();

    const creatures: CreatureData[] = [];
    const items: ItemData[] = [];
    const containers: ContainerData[] = [];

    for (const entityName of contained) {
      const entityData = entityDetails.get(entityName);
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
          entityName,
          entityData,
          containmentMap,
          entityDetails
        );
        if (nestedContainer) containers.push(nestedContainer);
      }
    }

    return {
      type: 'box-container',
      name: containerName,
      description: containerData['description'] as string | undefined,
      creatures,
      items,
      containers,
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
}
