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

@Injectable({
  providedIn: 'root',
})
export class TypeDBQueryService {
  private readonly connectionService = inject(TypeDBConnectionService);

  async getAllDungeons(): Promise<DungeonSummary[]> {
    const query = `
      match
        $d isa dungeon;
      fetch {
        "id": $d.id,
        "name": $d.name
      };
    `;

    return this.connectionService.executeReadQuery(query, (response: any) => {
      if (response.answerType !== 'conceptDocuments') {
        return [];
      }
      return response.answers.map((result: any) => ({
        id: result.id[0].value as string,
        name: result.name[0].value as string,
      }));
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
      fetch {
        "id": $d.id,
        "name": $d.name,
        "description": $d.description
      };
    `;

    return this.connectionService.executeReadQuery(query, (response: any) => {
      if (response.answerType !== 'conceptDocuments' || response.answers.length === 0) {
        return null;
      }
      const result = response.answers[0];
      return {
        id: result.id[0].value as string,
        name: result.name[0].value as string,
        description: result.description?.[0]?.value as string | undefined,
      };
    });
  }

  private async fetchDungeonRooms(dungeonId: string): Promise<any[]> {
    const query = `
      match
        $d isa dungeon, has id "${dungeonId}";
        $r($d) isa dungeon-composition;
        $r(room-in-dungeon: $room);
      fetch {
        "name": $room.name,
        "description": $room.description
      };
    `;

    return this.connectionService.executeReadQuery(query, (response: any) => {
      if (response.answerType !== 'conceptDocuments') {
        return [];
      }
      return response.answers.map((result: any) => ({
        name: result.name[0].value as string,
        description: result.description?.[0]?.value as string | undefined,
      }));
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
        "entity": $entity,
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
        const entityName = entityData.name?.[0]?.value;

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
        name: result.name[0].value as string,
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
    const containerName = containerData.name?.[0]?.value;
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
      description: containerData.description?.[0]?.value,
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
    const name = entity.name?.[0]?.value as string;
    const description = entity.description?.[0]?.value as string | undefined;
    const level = entity.level?.[0]?.value as number | undefined;
    const hitPoints = entity['hit-points']?.[0]?.value as number | undefined;
    const armorClass = entity['armor-class']?.[0]?.value as number | undefined;
    const alignment = entity.alignment?.[0]?.value as Alignment | undefined;

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
      const isFriendly = entity['is-friendly']?.[0]?.value as boolean | undefined;
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
    const name = entity.name?.[0]?.value as string;
    const description = entity.description?.[0]?.value as string | undefined;

    if (entityType === 'magic-item') {
      const rarity = entity.rarity?.[0]?.value as Rarity | undefined;
      const requiresAttunement = entity['requires-attunement']?.[0]?.value as boolean | undefined;

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

    const wisdom = entity.wisdom[0].value as number;
    const passivePerception =
      entity['passive-perception']?.[0]?.value || 10 + Math.floor((wisdom - 10) / 2);

    return {
      abilityScores: {
        strength: entity.strength[0].value as number,
        dexterity: entity.dexterity[0].value as number,
        constitution: entity.constitution[0].value as number,
        intelligence: entity.intelligence[0].value as number,
        wisdom: wisdom,
        charisma: entity.charisma[0].value as number,
      },
      size: entity.size[0].value as CreatureSize,
      type: entity['creature-type'][0].value as CreatureType,
      challengeRating: entity['challenge-rating']?.[0]?.value as string | undefined,
      experiencePoints: entity['experience-points']?.[0]?.value as number | undefined,
      proficiencyBonus: entity['proficiency-bonus']?.[0]?.value || 2,
      speed: {
        walk: entity['speed-walk']?.[0]?.value as number | undefined,
        fly: entity['speed-fly']?.[0]?.value as number | undefined,
        swim: entity['speed-swim']?.[0]?.value as number | undefined,
        burrow: entity['speed-burrow']?.[0]?.value as number | undefined,
        climb: entity['speed-climb']?.[0]?.value as number | undefined,
      },
      savingThrows: {
        strength: entity['save-strength']?.[0]?.value as number | undefined,
        dexterity: entity['save-dexterity']?.[0]?.value as number | undefined,
        constitution: entity['save-constitution']?.[0]?.value as number | undefined,
        intelligence: entity['save-intelligence']?.[0]?.value as number | undefined,
        wisdom: entity['save-wisdom']?.[0]?.value as number | undefined,
        charisma: entity['save-charisma']?.[0]?.value as number | undefined,
      },
      skills: {
        acrobatics: entity['skill-acrobatics']?.[0]?.value as number | undefined,
        animalHandling: entity['skill-animal-handling']?.[0]?.value as number | undefined,
        arcana: entity['skill-arcana']?.[0]?.value as number | undefined,
        athletics: entity['skill-athletics']?.[0]?.value as number | undefined,
        deception: entity['skill-deception']?.[0]?.value as number | undefined,
        history: entity['skill-history']?.[0]?.value as number | undefined,
        insight: entity['skill-insight']?.[0]?.value as number | undefined,
        intimidation: entity['skill-intimidation']?.[0]?.value as number | undefined,
        investigation: entity['skill-investigation']?.[0]?.value as number | undefined,
        medicine: entity['skill-medicine']?.[0]?.value as number | undefined,
        nature: entity['skill-nature']?.[0]?.value as number | undefined,
        perception: entity['skill-perception']?.[0]?.value as number | undefined,
        performance: entity['skill-performance']?.[0]?.value as number | undefined,
        persuasion: entity['skill-persuasion']?.[0]?.value as number | undefined,
        religion: entity['skill-religion']?.[0]?.value as number | undefined,
        sleightOfHand: entity['skill-sleight-of-hand']?.[0]?.value as number | undefined,
        stealth: entity['skill-stealth']?.[0]?.value as number | undefined,
        survival: entity['skill-survival']?.[0]?.value as number | undefined,
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
        "ability": $a,
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
          name: abilityData.name[0].value as string,
          description: abilityData.description[0].value as string,
          actionCost: abilityData['action-cost']?.[0]?.value as number | undefined,
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
