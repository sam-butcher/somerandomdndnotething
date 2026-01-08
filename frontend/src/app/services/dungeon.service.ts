import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DungeonGraph, DungeonSummary } from '../models/dungeon.models';
import { TypeDBQueryService } from './typedb-query.service';

@Injectable({
  providedIn: 'root',
})
export class DungeonService {
  private readonly queryService = inject(TypeDBQueryService);

  getAllDungeons(): Observable<DungeonSummary[]> {
    return from(this.queryService.getAllDungeons()).pipe(catchError(this.handleError));
  }

  getDungeon(id: string): Observable<DungeonGraph> {
    return from(this.queryService.getDungeonGraph(id)).pipe(
      map((graph) => {
        if (!graph) {
          throw new Error('Dungeon not found');
        }
        return graph;
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.message) {
      if (error.message.includes('Not connected')) {
        errorMessage = 'Not connected to TypeDB. Please configure connection in Settings.';
      } else if (error.message.includes('Database') && error.message.includes('does not exist')) {
        errorMessage = error.message;
      } else if (error.message.includes('Dungeon not found')) {
        errorMessage = 'Dungeon not found';
      } else {
        errorMessage = `TypeDB error: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }
}
