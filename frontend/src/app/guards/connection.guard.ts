import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TypeDBConnectionService } from '../services/typedb-connection.service';

export const connectionGuard = () => {
  const connectionService = inject(TypeDBConnectionService);
  const router = inject(Router);

  const status = connectionService.connectionStatus;

  if (!status().connected) {
    router.navigate(['/settings']);
    return false;
  }

  return true;
};
