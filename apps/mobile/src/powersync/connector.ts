import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
} from '@powersync/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const powerSyncUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL;

// Les opérations remontées par PowerSync ciblent des tables **dynamiques** (par nom) ;
// on utilise un client au typage générique pour ne pas dépendre des types de schéma.
const db = supabase as unknown as SupabaseClient;

/**
 * Connecteur PowerSync ↔ Supabase.
 *  - `fetchCredentials` : fournit l'endpoint PowerSync + le JWT Supabase de l'utilisateur.
 *  - `uploadData` : rejoue les écritures locales (CRUD) vers Postgres via Supabase.
 * Voir architecture §4/§7 et offline-sync.md.
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    if (!powerSyncUrl) {
      throw new Error('EXPO_PUBLIC_POWERSYNC_URL manquant (voir .env).');
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return null;
    }
    return { endpoint: powerSyncUrl, token: session.access_token };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    for (const op of transaction.crud) {
      const table = db.from(op.table);
      let result;
      switch (op.op) {
        case UpdateType.PUT:
          result = await table.upsert({ ...op.opData, id: op.id });
          break;
        case UpdateType.PATCH:
          result = await table.update(op.opData ?? {}).eq('id', op.id);
          break;
        case UpdateType.DELETE:
          result = await table.delete().eq('id', op.id);
          break;
      }
      if (result?.error) {
        // Trace l'échec (une erreur d'upload silencieuse bloque toute la synchro via le
        // write-checkpoint — cf. bug ensureSettings/doublon user_id). On relance pour
        // réessayer plus tard (transaction non complétée).
        console.warn(
          `[PowerSync] upload ${op.op} ${op.table} échoué :`,
          result.error.message ?? result.error,
        );
        throw result.error;
      }
    }

    await transaction.complete();
  }
}
