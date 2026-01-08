import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DungeonGraph } from '../models/dungeon.models';

@Injectable({
  providedIn: 'root'
})
export class DungeonService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/dungeons';

  getDungeon(name: string): Observable<DungeonGraph> {
    return this.http.get<DungeonGraph>(`${this.baseUrl}/${encodeURIComponent(name)}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Network error: ${error.error.message}`;
    } else {
      // Backend returned an unsuccessful response code
      if (error.status === 404) {
        errorMessage = 'Dungeon not found';
      } else if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Make sure the backend is running on http://localhost:8080';
      } else {
        errorMessage = `Server error: ${error.status} - ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }
}
