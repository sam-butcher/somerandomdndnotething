export interface TypeDBConnectionConfig {
  address: string;
  database: string;
  username: string;
  password: string;
  tlsEnabled: boolean;
}

export interface TypeDBConnectionStatus {
  connected: boolean;
  error?: string;
  lastChecked?: Date;
}

export const DEFAULT_CONFIG: TypeDBConnectionConfig = {
  address: 'localhost:1729',
  database: 'dnd',
  username: 'admin',
  password: '',
  tlsEnabled: false,
};
