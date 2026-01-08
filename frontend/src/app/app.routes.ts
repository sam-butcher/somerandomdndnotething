import { Routes } from '@angular/router';
import { DungeonViewer } from './components/dungeon-viewer/dungeon-viewer.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dungeons', pathMatch: 'full' },
  { path: 'dungeons', component: DungeonViewer }
];
