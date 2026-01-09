import { Injectable, signal } from '@angular/core';
import { QueryResponse, TypeDBHttpDriver, isOkResponse } from '@typedb/driver-http';
import {
  TypeDBConnectionConfig,
  TypeDBConnectionStatus,
} from '../models/typedb-config.models';

@Injectable({
  providedIn: 'root',
})
export class TypeDBConnectionService {
  private readonly _connectionStatus = signal<TypeDBConnectionStatus>({
    connected: false,
  });

  private driver: TypeDBHttpDriver | null = null;
  private config: TypeDBConnectionConfig | null = null;

  readonly connectionStatus = this._connectionStatus.asReadonly();

  async connect(config: TypeDBConnectionConfig): Promise<void> {
    await this.disconnect();

    try {
      this.driver = new TypeDBHttpDriver({
        addresses: [config.address],
        username: config.username,
        password: config.password,
      });

      const databasesResponse = await this.driver.getDatabases();
      if (!isOkResponse(databasesResponse)) {
        throw new Error('Failed to fetch databases');
      }

      const databaseExists = databasesResponse.ok.databases.some(
        (db: any) => db.name === config.database
      );
      if (!databaseExists) {
        throw new Error(`Database '${config.database}' does not exist`);
      }

      this.config = config;
      this._connectionStatus.set({
        connected: true,
        lastChecked: new Date(),
      });

      this.saveConnectionPreferences(config);
    } catch (error) {
      this._connectionStatus.set({
        connected: false,
        error: (error as Error).message,
        lastChecked: new Date(),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.driver = null;
    this.config = null;
    this._connectionStatus.set({ connected: false });
  }

  async executeReadQuery<T>(queryString: string, mapper: (response: QueryResponse) => T): Promise<T> {
    if (!this.driver || !this.config) {
      throw new Error('Not connected to TypeDB');
    }

    const queryResponse = await this.driver.oneShotQuery(
      queryString,
      false,
      this.config.database,
      'read',
      { transactionTimeoutMillis: 30000 }
    );

    console.log('asdf', queryString, queryResponse);

    if (!isOkResponse(queryResponse)) {
      throw new Error('Query failed');
    }

    return mapper(queryResponse.ok);
  }

  private saveConnectionPreferences(config: TypeDBConnectionConfig): void {
    const prefs = {
      address: config.address,
      database: config.database,
      username: config.username,
      tlsEnabled: config.tlsEnabled,
    };
    localStorage.setItem('typedb-connection-prefs', JSON.stringify(prefs));
  }

  loadConnectionPreferences(): Partial<TypeDBConnectionConfig> | null {
    const stored = localStorage.getItem('typedb-connection-prefs');
    return stored ? JSON.parse(stored) : null;
  }
}
