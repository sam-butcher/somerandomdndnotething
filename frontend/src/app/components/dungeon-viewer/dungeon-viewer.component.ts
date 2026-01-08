import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DungeonService } from '../../services/dungeon.service';
import { CreatureStatblock } from '../creature-statblock/creature-statblock';
import {
  DungeonGraph,
  DungeonSummary,
  RoomData,
  CreatureData,
  ItemData,
  ContainerData,
  Rarity,
  Alignment
} from '../../models/dungeon.models';

@Component({
  selector: 'app-dungeon-viewer',
  imports: [CommonModule, FormsModule, CreatureStatblock],
  templateUrl: './dungeon-viewer.component.html',
  styleUrl: './dungeon-viewer.component.css'
})
export class DungeonViewer implements OnInit {
  private readonly dungeonService = inject(DungeonService);

  // State signals
  protected readonly dungeonList = signal<DungeonSummary[]>([]);
  protected readonly selectedDungeonId = signal<string>('');
  protected readonly dungeon = signal<DungeonGraph | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  // Filter signals
  protected readonly filterMonster = signal(true);
  protected readonly filterNPC = signal(true);
  protected readonly filterPC = signal(true);
  protected readonly filterRegularItem = signal(true);
  protected readonly filterMagicItem = signal(true);
  protected readonly searchText = signal('');

  // Expand/collapse state
  protected readonly expandedRooms = signal(new Set<number>());
  protected readonly expandedContainers = signal(new Map<string, boolean>());

  // Computed filtered dungeon
  protected readonly filteredDungeon = computed(() => {
    const dung = this.dungeon();
    if (!dung) return null;

    const searchLower = this.searchText().toLowerCase();

    return {
      ...dung,
      rooms: dung.rooms.map((room, roomIndex) => this.filterRoom(room, roomIndex, searchLower))
    };
  });

  ngOnInit(): void {
    this.loadDungeonList();
  }

  loadDungeonList(): void {
    this.dungeonService.getAllDungeons().subscribe({
      next: (dungeons) => {
        this.dungeonList.set(dungeons);
      },
      error: (err) => {
        this.error.set(err.message);
      }
    });
  }

  onDungeonSelected(dungeonId: string): void {
    if (!dungeonId) {
      this.dungeon.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.dungeon.set(null);

    this.dungeonService.getDungeon(dungeonId).subscribe({
      next: (data) => {
        this.dungeon.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  toggleRoom(index: number): void {
    const expanded = this.expandedRooms();
    const newExpanded = new Set(expanded);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    this.expandedRooms.set(newExpanded);
  }

  isRoomExpanded(index: number): boolean {
    return this.expandedRooms().has(index);
  }

  toggleContainer(id: string): void {
    const expanded = this.expandedContainers();
    const newExpanded = new Map(expanded);
    newExpanded.set(id, !newExpanded.get(id));
    this.expandedContainers.set(newExpanded);
  }

  isContainerExpanded(id: string): boolean {
    return this.expandedContainers().get(id) ?? false;
  }

  private filterRoom(room: RoomData, roomIndex: number, searchLower: string): RoomData {
    return {
      ...room,
      creatures: (room.creatures || []).filter(c => this.filterCreature(c, searchLower)),
      items: (room.items || []).filter(i => this.filterItem(i, searchLower)),
      containers: (room.containers || []).map((c, idx) => this.filterContainer(c, `${roomIndex}-${idx}`, searchLower))
    };
  }

  private filterCreature(creature: CreatureData, searchLower: string): boolean {
    // Check type filter
    if (creature.type === 'monster' && !this.filterMonster()) return false;
    if (creature.type === 'npc' && !this.filterNPC()) return false;
    if (creature.type === 'pc' && !this.filterPC()) return false;

    // Check search text
    if (searchLower && !creature.name.toLowerCase().includes(searchLower)) {
      return false;
    }

    return true;
  }

  private filterItem(item: ItemData, searchLower: string): boolean {
    // Check type filter
    if (item.type === 'item' && !this.filterRegularItem()) return false;
    if (item.type === 'magic-item' && !this.filterMagicItem()) return false;

    // Check search text
    if (searchLower && !item.name.toLowerCase().includes(searchLower)) {
      return false;
    }

    return true;
  }

  private filterContainer(container: ContainerData, id: string, searchLower: string): ContainerData {
    return {
      ...container,
      creatures: (container.creatures || []).filter(c => this.filterCreature(c, searchLower)),
      items: (container.items || []).filter(i => this.filterItem(i, searchLower)),
      containers: (container.containers || []).map((c, idx) => this.filterContainer(c, `${id}-${idx}`, searchLower))
    };
  }

  // Helper methods for template
  getCreatureIcon(creature: CreatureData): string {
    switch (creature.type) {
      case 'monster': return '⚔️';
      case 'npc': return '👤';
      case 'pc': return '⭐';
      default: return '❓';
    }
  }

  getItemIcon(item: ItemData): string {
    return item.type === 'magic-item' ? '✨' : '📦';
  }

  getContainerIcon(): string {
    return '🎁';
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
    // Extract the moral axis (Good/Neutral/Evil) for coloring
    if (alignment.includes('Good')) return 'alignment-good';
    if (alignment.includes('Evil')) return 'alignment-evil';
    if (alignment === Alignment.UNALIGNED) return 'alignment-unaligned';
    return 'alignment-neutral';
  }
}
