import { Component, input, signal, computed } from '@angular/core';
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

  // Collapse state
  protected readonly isCollapsed = signal(true);

  // Computed ability getters - filter abilities by type
  readonly traits = computed(() =>
    this.statblock().abilities.filter(a => a['ability-type'] === 'trait')
  );

  readonly actions = computed(() =>
    this.statblock().abilities.filter(a => a['ability-type'] === 'action')
  );

  readonly bonusActions = computed(() =>
    this.statblock().abilities.filter(a => a['ability-type'] === 'bonus-action')
  );

  readonly reactions = computed(() =>
    this.statblock().abilities.filter(a => a['ability-type'] === 'reaction')
  );

  readonly legendaryActions = computed(() =>
    this.statblock().abilities.filter(a => a['ability-type'] === 'legendary-action')
  );

  readonly lairActions = computed(() =>
    this.statblock().abilities.filter(a => a['ability-type'] === 'lair-action')
  );

  readonly mythicActions = computed(() =>
    this.statblock().abilities.filter(a => a['ability-type'] === 'mythic-action')
  );

  // Toggle collapse state
  toggleCollapse(): void {
    this.isCollapsed.set(!this.isCollapsed());
  }

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
  formatSavingThrows(): string | null {
    const stat = this.statblock();
    const parts: string[] = [];
    if (stat['save-strength'] !== null && stat['save-strength'] !== undefined) parts.push(`Str ${this.formatBonus(stat['save-strength'])}`);
    if (stat['save-dexterity'] !== null && stat['save-dexterity'] !== undefined) parts.push(`Dex ${this.formatBonus(stat['save-dexterity'])}`);
    if (stat['save-constitution'] !== null && stat['save-constitution'] !== undefined) parts.push(`Con ${this.formatBonus(stat['save-constitution'])}`);
    if (stat['save-intelligence'] !== null && stat['save-intelligence'] !== undefined) parts.push(`Int ${this.formatBonus(stat['save-intelligence'])}`);
    if (stat['save-wisdom'] !== null && stat['save-wisdom'] !== undefined) parts.push(`Wis ${this.formatBonus(stat['save-wisdom'])}`);
    if (stat['save-charisma'] !== null && stat['save-charisma'] !== undefined) parts.push(`Cha ${this.formatBonus(stat['save-charisma'])}`);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  // Format skills for display
  formatSkills(): string | null {
    const stat = this.statblock();
    const parts: string[] = [];
    if (stat['skill-acrobatics'] !== null && stat['skill-acrobatics'] !== undefined) parts.push(`Acrobatics ${this.formatBonus(stat['skill-acrobatics'])}`);
    if (stat['skill-animal-handling'] !== null && stat['skill-animal-handling'] !== undefined) parts.push(`Animal Handling ${this.formatBonus(stat['skill-animal-handling'])}`);
    if (stat['skill-arcana'] !== null && stat['skill-arcana'] !== undefined) parts.push(`Arcana ${this.formatBonus(stat['skill-arcana'])}`);
    if (stat['skill-athletics'] !== null && stat['skill-athletics'] !== undefined) parts.push(`Athletics ${this.formatBonus(stat['skill-athletics'])}`);
    if (stat['skill-deception'] !== null && stat['skill-deception'] !== undefined) parts.push(`Deception ${this.formatBonus(stat['skill-deception'])}`);
    if (stat['skill-history'] !== null && stat['skill-history'] !== undefined) parts.push(`History ${this.formatBonus(stat['skill-history'])}`);
    if (stat['skill-insight'] !== null && stat['skill-insight'] !== undefined) parts.push(`Insight ${this.formatBonus(stat['skill-insight'])}`);
    if (stat['skill-intimidation'] !== null && stat['skill-intimidation'] !== undefined) parts.push(`Intimidation ${this.formatBonus(stat['skill-intimidation'])}`);
    if (stat['skill-investigation'] !== null && stat['skill-investigation'] !== undefined) parts.push(`Investigation ${this.formatBonus(stat['skill-investigation'])}`);
    if (stat['skill-medicine'] !== null && stat['skill-medicine'] !== undefined) parts.push(`Medicine ${this.formatBonus(stat['skill-medicine'])}`);
    if (stat['skill-nature'] !== null && stat['skill-nature'] !== undefined) parts.push(`Nature ${this.formatBonus(stat['skill-nature'])}`);
    if (stat['skill-perception'] !== null && stat['skill-perception'] !== undefined) parts.push(`Perception ${this.formatBonus(stat['skill-perception'])}`);
    if (stat['skill-performance'] !== null && stat['skill-performance'] !== undefined) parts.push(`Performance ${this.formatBonus(stat['skill-performance'])}`);
    if (stat['skill-persuasion'] !== null && stat['skill-persuasion'] !== undefined) parts.push(`Persuasion ${this.formatBonus(stat['skill-persuasion'])}`);
    if (stat['skill-religion'] !== null && stat['skill-religion'] !== undefined) parts.push(`Religion ${this.formatBonus(stat['skill-religion'])}`);
    if (stat['skill-sleight-of-hand'] !== null && stat['skill-sleight-of-hand'] !== undefined) parts.push(`Sleight of Hand ${this.formatBonus(stat['skill-sleight-of-hand'])}`);
    if (stat['skill-stealth'] !== null && stat['skill-stealth'] !== undefined) parts.push(`Stealth ${this.formatBonus(stat['skill-stealth'])}`);
    if (stat['skill-survival'] !== null && stat['skill-survival'] !== undefined) parts.push(`Survival ${this.formatBonus(stat['skill-survival'])}`);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  // Format a bonus/modifier
  private formatBonus(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }
}
