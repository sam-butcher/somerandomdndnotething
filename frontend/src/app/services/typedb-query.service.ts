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
      return response.answers as DungeonSummary[];
    });
  }

  async getDungeonGraph(dungeonId: string): Promise<DungeonGraph | null> {
    const dungeonData = await this.fetchDungeonMetadata(dungeonId);
    if (!dungeonData) return null;

    const roomsData = await this.fetchDungeonRooms(dungeonId);

    const entityMap = await this.fetchAllEntities(dungeonId);

    const containmentMap = await this.buildContainmentMap(roomsData, entityMap);

    const rooms = await Promise.all(
      roomsData.map((roomData) => this.buildRoom(roomData, containmentMap, entityMap))
    );

    console.log('asdf1', roomsData);
    console.log('asdf2', entityMap);
    console.log('asdf3', containmentMap);
    console.log('asdf4', rooms);

    return {
      id: dungeonData.id,
      name: dungeonData.name,
      description: dungeonData.description,
      rooms,
    };
  }

  private async fetchDungeonMetadata(
    dungeonId: string
  ): Promise<{ id: string; name: string; description?: string } | null> {
    const query = `
      match
        $d isa dungeon, has id "${dungeonId}";
      fetch { $d.* };
    `;

    return this.connectionService.executeReadQuery(query, (response: any) => {
      if (response.answerType !== 'conceptDocuments' || response.answers.length === 0) {
        return null;
      }
      return response.answers[0];
    });
  }

  private async fetchDungeonRooms(dungeonId: string): Promise<any[]> {
    const query = `
      match
        $d isa dungeon, has id "${dungeonId}";
        $r($d) isa dungeon-composition;
        $r(room-in-dungeon: $room);
      fetch { $room.* };
    `;

    return this.connectionService.executeReadQuery(query, (response: any) => {
      if (response.answerType !== 'conceptDocuments') {
        return [];
      }
      return response.answers;
    });
  }

  private async fetchAllEntities(dungeonId: string): Promise<Map<string, any>> {
    const query = `
      match
        $d isa dungeon, has id "${dungeonId}";
        $r($d) isa dungeon-composition;
        $r(room-in-dungeon: $room);
        $c($room) isa containment;
        $c(contained: $entity);
        $entity isa $entity-type;
      fetch {
        "entity": { $entity.* },
        "type": $entity-type
      };
    `;

    return this.connectionService.executeReadQuery(query, (response: any) => {
      const entityMap = new Map<string, any>();
      if (response.answerType !== 'conceptDocuments') {
        return entityMap;
      }
      for (const result of response.answers) {
        const entityData = result.entity;
        const entityType = result.type.label;
        const entityName = entityData.name;

        if (entityName) {
          entityMap.set(entityName, {
            ...entityData,
            entityType,
          });
        }
      }
      return entityMap;
    });
  }

  private async buildContainmentMap(
    roomsData: any[],
    entityMap: Map<string, any>
  ): Promise<Map<string, Set<string>>> {
    const containmentMap = new Map<string, Set<string>>();
    const processedContainers = new Set<string>();
    const pendingContainers = new Set<string>(roomsData.map((room) => room.name));

    while (pendingContainers.size > 0) {
      const currentContainers = Array.from(pendingContainers);
      pendingContainers.clear();

      for (const containerName of currentContainers) {
        if (processedContainers.has(containerName)) continue;

        const contained = await this.fetchContainedEntities(containerName);

        if (contained.length > 0) {
          containmentMap.set(
            containerName,
            new Set(contained.map((c) => c.name))
          );

          contained
            .filter((c) => c.type === 'box-container' || c.type === 'room')
            .forEach((c) => pendingContainers.add(c.name));
        }

        processedContainers.add(containerName);
      }
    }

    return containmentMap;
  }

  private async fetchContainedEntities(
    containerName: string
  ): Promise<{ name: string; type: string }[]> {
    const query = `
      match
        $container isa container, has name "${containerName}";
        $c($container) isa containment;
        $c(contained: $contained);
        $contained isa $contained-type;
      fetch {
        "name": $contained.name,
        "type": $contained-type
      };
    `;

    return this.connectionService.executeReadQuery(query, (response: any) => {
      if (response.answerType !== 'conceptDocuments') {
        return [];
      }
      return response.answers.map((result: any) => ({
        name: result.name as string,
        type: result.type.label as string,
      }));
    });
  }

  private async buildRoom(
    roomData: any,
    containmentMap: Map<string, Set<string>>,
    entityMap: Map<string, any>
  ): Promise<RoomData> {
    const contained = containmentMap.get(roomData.name) || new Set<string>();

    const creatures: CreatureData[] = [];
    const items: ItemData[] = [];
    const containers: ContainerData[] = [];

    for (const entityName of contained) {
      const entityData = entityMap.get(entityName);
      if (!entityData) continue;

      const entityType = entityData.entityType;

      if (entityType === 'monster' || entityType === 'npc' || entityType === 'pc') {
        const creature = await this.parseCreatureFromEntity(entityData, entityName, entityType);
        if (creature) creatures.push(creature);
      } else if (entityType === 'item' || entityType === 'magic-item') {
        const item = this.parseItemFromEntity(entityData, entityType);
        if (item) items.push(item);
      } else if (entityType === 'box-container') {
        const container = await this.buildContainer(entityData, containmentMap, entityMap);
        if (container) containers.push(container);
      }
    }

    return {
      name: roomData.name,
      description: roomData.description,
      creatures,
      items,
      containers,
    };
  }

  private async buildContainer(
    containerData: any,
    containmentMap: Map<string, Set<string>>,
    entityMap: Map<string, any>
  ): Promise<ContainerData | null> {
    const containerName = containerData.name;
    if (!containerName) return null;

    const contained = containmentMap.get(containerName) || new Set<string>();

    const creatures: CreatureData[] = [];
    const items: ItemData[] = [];
    const containers: ContainerData[] = [];

    for (const entityName of contained) {
      const entityData = entityMap.get(entityName);
      if (!entityData) continue;

      const entityType = entityData.entityType;

      if (entityType === 'monster' || entityType === 'npc' || entityType === 'pc') {
        const creature = await this.parseCreatureFromEntity(entityData, entityName, entityType);
        if (creature) creatures.push(creature);
      } else if (entityType === 'item' || entityType === 'magic-item') {
        const item = this.parseItemFromEntity(entityData, entityType);
        if (item) items.push(item);
      } else if (entityType === 'box-container') {
        const nestedContainer = await this.buildContainer(entityData, containmentMap, entityMap);
        if (nestedContainer) containers.push(nestedContainer);
      }
    }

    return {
      type: 'box-container',
      name: containerName,
      description: containerData.description,
      creatures,
      items,
      containers,
    };
  }

  private async parseCreatureFromEntity(
    entity: any,
    creatureName: string,
    entityType: string
  ): Promise<CreatureData | null> {
    const name = entity.name as string;
    const description = entity.description as string | undefined;
    const level = entity.level as number | undefined;
    const hitPoints = entity['hit-points'] as number | undefined;
    const armorClass = entity['armor-class'] as number | undefined;
    const alignment = entity.alignment as Alignment | undefined;

    const statblock = await this.buildStatblock(entity, creatureName);

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

  private parseItemFromEntity(entity: any, entityType: string): ItemData | null {
    const name = entity.name;
    const description = entity.description;

    if (entityType === 'magic-item') {
      const rarity = entity.rarity as Rarity | undefined;
      const requiresAttunement = entity['requires-attunement'];

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

  private async buildStatblock(entity: any, creatureName: string): Promise<StatblockData | null> {
    const requiredStats = [
      'strength',
      'dexterity',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
    ];

    for (const stat of requiredStats) {
      if (!entity[stat] || entity[stat].length === 0) return null;
    }

    if (!entity.size || entity.size.length === 0) return null;
    if (!entity['creature-type'] || entity['creature-type'].length === 0) return null;

    const abilityMap = await this.queryCreatureAbilities(creatureName);

    const parseListAttribute = (key: string): string[] => {
      const value = entity[key];
      if (!value) return [];
      return Array.isArray(value) ? value.map((v: any) => v.value as string) : [];
    };

    const wisdom = entity.wisdom as number;
    const passivePerception =
      entity['passive-perception'] || 10 + Math.floor((wisdom - 10) / 2);

    return {
      abilityScores: {
        strength: entity.strength as number,
        dexterity: entity.dexterity as number,
        constitution: entity.constitution as number,
        intelligence: entity.intelligence as number,
        wisdom: wisdom,
        charisma: entity.charisma as number,
      },
      size: entity.size as CreatureSize,
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
      traits: abilityMap.get('trait') || [],
      actions: abilityMap.get('action') || [],
      bonusActions: abilityMap.get('bonus-action') || [],
      reactions: abilityMap.get('reaction') || [],
      legendaryActions: abilityMap.get('legendary-action') || [],
      lairActions: abilityMap.get('lair-action') || [],
      mythicActions: abilityMap.get('mythic-action') || [],
    };
  }

  private async queryCreatureAbilities(
    creatureName: string
  ): Promise<Map<string, CreatureAbility[]>> {
    const query = `
      match
        $c isa creature, has name "${creatureName}";
        $r($c) isa has-ability;
        $r(ability: $a);
        $a isa $ability-type;
      fetch {
        "ability": { $a.* },
        "type": $ability-type
      };
    `;

    return this.connectionService.executeReadQuery(query, (response: any) => {
      const abilityMap = new Map<string, CreatureAbility[]>();

      if (response.answerType !== 'conceptDocuments') {
        return abilityMap;
      }

      for (const result of response.answers) {
        const abilityType = result.type.label as string;
        const abilityData = result.ability;

        const ability: CreatureAbility = {
          name: abilityData.name as string,
          description: abilityData.description as string,
          actionCost: abilityData['action-cost'] as number | undefined,
        };

        if (!abilityMap.has(abilityType)) {
          abilityMap.set(abilityType, []);
        }
        abilityMap.get(abilityType)!.push(ability);
      }

      return abilityMap;
    });
  }
}
