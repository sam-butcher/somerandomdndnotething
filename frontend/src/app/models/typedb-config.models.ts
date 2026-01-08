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
  address: 'https://n69m16-0.cluster.typedb.com:80',
  database: 'sam-hackathon',
  username: 'admin',
  password: '',
  tlsEnabled: true,
};
