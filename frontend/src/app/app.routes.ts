import { Routes } from '@angular/router';
import { DungeonViewer } from './components/dungeon-viewer/dungeon-viewer.component';
import { TypeDBSettingsComponent } from './components/typedb-settings/typedb-settings.component';
import { connectionGuard } from './guards/connection.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dungeons', pathMatch: 'full' },
  { path: 'dungeons', component: DungeonViewer, canActivate: [connectionGuard] },
  { path: 'settings', component: TypeDBSettingsComponent },
];
