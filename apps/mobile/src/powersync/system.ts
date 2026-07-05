import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from './schema';
import { SupabaseConnector } from './connector';

// Base locale SQLite (op-sqlite — compatible new architecture RN).
const factory = new OPSqliteOpenFactory({ dbFilename: 'wellness.db' });

export const powerSync = new PowerSyncDatabase({ database: factory, schema: AppSchema });
export const connector = new SupabaseConnector();
