import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CreatureStatblock } from '../creature-statblock/creature-statblock';
import {
  ContainerData,
  CreatureData,
  ItemData,
  Rarity,
  Alignment
} from '../../models/dungeon.models';

@Component({
  selector: 'app-container-display',
  imports: [CommonModule, CreatureStatblock],
  templateUrl: './container-display.component.html',
  styleUrl: './container-display.component.css'
})
export class ContainerDisplay {
  @Input({ required: true }) container!: ContainerData;
  @Input({ required: true }) containerId!: string;
  @Input() expanded: boolean = false;

  protected isExpanded = false;

  ngOnInit() {
    this.isExpanded = this.expanded;
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  getCreatureIcon(creature: CreatureData): string {
    switch (creature.type) {
      case 'monster': return '[M]';
      case 'npc': return '[N]';
      case 'pc': return '[P]';
      default: return '[?]';
    }
  }

  getItemIcon(item: ItemData): string {
    return item.type === 'magic-item' ? '[*]' : '[I]';
  }

  getContainerIcon(): string {
    return '[C]';
  }

  getRarityClass(rarity?: Rarity): string {
    if (!rarity) return '';
    switch (rarity) {
      case Rarity.COMMON: return 'rarity-common';
      case Rarity.UNCOMMON: return 'rarity-uncommon';
      case Rarity.RARE: return 'rarity-rare';
      case Rarity.VERY_RARE: return 'rarity-very-rare';
      case Rarity.LEGENDARY: return 'rarity-legendary';
      case Rarity.ARTIFACT: return 'rarity-artifact';
      default: return '';
    }
  }

  getAlignmentClass(alignment?: Alignment): string {
    if (!alignment) return '';
    if (alignment.includes('Good')) return 'alignment-good';
    if (alignment.includes('Evil')) return 'alignment-evil';
    if (alignment === Alignment.UNALIGNED) return 'alignment-unaligned';
    return 'alignment-neutral';
  }
}
