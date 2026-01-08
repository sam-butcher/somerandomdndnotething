import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatblockData, Alignment } from '../../models/dungeon.models';

@Component({
  selector: 'app-creature-statblock',
  imports: [CommonModule],
  templateUrl: './creature-statblock.html',
  styleUrl: './creature-statblock.css',
})
export class CreatureStatblock {
  // Input signals
  readonly statblock = input.required<StatblockData>();
  readonly creatureName = input.required<string>();
  readonly hitPoints = input<number | undefined>();
  readonly armorClass = input<number | undefined>();
  readonly alignment = input<Alignment | undefined>();

  // Calculate ability modifier from ability score
  getAbilityModifier(score: number): string {
    const modifier = Math.floor((score - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  }

  // Format speed for display
  formatSpeed(speed: StatblockData['speed']): string {
    const parts: string[] = [];
    if (speed.walk) parts.push(`${speed.walk} ft.`);
    if (speed.fly) parts.push(`fly ${speed.fly} ft.`);
    if (speed.swim) parts.push(`swim ${speed.swim} ft.`);
    if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`);
    if (speed.climb) parts.push(`climb ${speed.climb} ft.`);
    return parts.join(', ');
  }

  // Format saving throws for display
  formatSavingThrows(saves: StatblockData['savingThrows']): string | null {
    if (!saves) return null;
    const parts: string[] = [];
    if (saves.strength !== null && saves.strength !== undefined) parts.push(`Str ${this.formatBonus(saves.strength)}`);
    if (saves.dexterity !== null && saves.dexterity !== undefined) parts.push(`Dex ${this.formatBonus(saves.dexterity)}`);
    if (saves.constitution !== null && saves.constitution !== undefined) parts.push(`Con ${this.formatBonus(saves.constitution)}`);
    if (saves.intelligence !== null && saves.intelligence !== undefined) parts.push(`Int ${this.formatBonus(saves.intelligence)}`);
    if (saves.wisdom !== null && saves.wisdom !== undefined) parts.push(`Wis ${this.formatBonus(saves.wisdom)}`);
    if (saves.charisma !== null && saves.charisma !== undefined) parts.push(`Cha ${this.formatBonus(saves.charisma)}`);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  // Format skills for display
  formatSkills(skills: StatblockData['skills']): string | null {
    if (!skills) return null;
    const parts: string[] = [];
    if (skills.acrobatics !== null && skills.acrobatics !== undefined) parts.push(`Acrobatics ${this.formatBonus(skills.acrobatics)}`);
    if (skills.animalHandling !== null && skills.animalHandling !== undefined) parts.push(`Animal Handling ${this.formatBonus(skills.animalHandling)}`);
    if (skills.arcana !== null && skills.arcana !== undefined) parts.push(`Arcana ${this.formatBonus(skills.arcana)}`);
    if (skills.athletics !== null && skills.athletics !== undefined) parts.push(`Athletics ${this.formatBonus(skills.athletics)}`);
    if (skills.deception !== null && skills.deception !== undefined) parts.push(`Deception ${this.formatBonus(skills.deception)}`);
    if (skills.history !== null && skills.history !== undefined) parts.push(`History ${this.formatBonus(skills.history)}`);
    if (skills.insight !== null && skills.insight !== undefined) parts.push(`Insight ${this.formatBonus(skills.insight)}`);
    if (skills.intimidation !== null && skills.intimidation !== undefined) parts.push(`Intimidation ${this.formatBonus(skills.intimidation)}`);
    if (skills.investigation !== null && skills.investigation !== undefined) parts.push(`Investigation ${this.formatBonus(skills.investigation)}`);
    if (skills.medicine !== null && skills.medicine !== undefined) parts.push(`Medicine ${this.formatBonus(skills.medicine)}`);
    if (skills.nature !== null && skills.nature !== undefined) parts.push(`Nature ${this.formatBonus(skills.nature)}`);
    if (skills.perception !== null && skills.perception !== undefined) parts.push(`Perception ${this.formatBonus(skills.perception)}`);
    if (skills.performance !== null && skills.performance !== undefined) parts.push(`Performance ${this.formatBonus(skills.performance)}`);
    if (skills.persuasion !== null && skills.persuasion !== undefined) parts.push(`Persuasion ${this.formatBonus(skills.persuasion)}`);
    if (skills.religion !== null && skills.religion !== undefined) parts.push(`Religion ${this.formatBonus(skills.religion)}`);
    if (skills.sleightOfHand !== null && skills.sleightOfHand !== undefined) parts.push(`Sleight of Hand ${this.formatBonus(skills.sleightOfHand)}`);
    if (skills.stealth !== null && skills.stealth !== undefined) parts.push(`Stealth ${this.formatBonus(skills.stealth)}`);
    if (skills.survival !== null && skills.survival !== undefined) parts.push(`Survival ${this.formatBonus(skills.survival)}`);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  // Format a bonus/modifier
  private formatBonus(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }
}
