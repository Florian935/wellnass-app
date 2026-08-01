import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
} from '@powersync/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const powerSyncUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL;

/**
 * Colonnes `jsonb` côté Postgres, stockées en **TEXT** côté SQLite local.
 *
 * PowerSync n'a pas de type JSON : le client sérialise (`JSON.stringify`) pour écrire en local.
 * Sans déballage à la remontée, PostgREST envoie cette **chaîne** dans une colonne `jsonb`, et
 * Postgres y stocke une valeur de type `string` au lieu du tableau ou de l'objet attendu.
 *
 * Les deux visages du même bug, constatés en recette device du 01/08/2026 :
 *  - `menstrual_daily_logs.symptoms` porte `check (jsonb_typeof(symptoms) = 'array')` → l'upload
 *    est **rejeté**, l'opération est rejouée en boucle, et la file d'envoi reste bloquée : plus
 *    rien ne monte **ni ne descend**, pendant que le tableau de bord affiche « Synchronisé » ;
 *  - `foods.portions` n'a **pas** de garde → la corruption passe sans bruit. 5 aliments créés
 *    depuis l'app avaient `"[]"` (une chaîne) au lieu de `[]`.
 *
 * Le côté **lecture** était déjà contourné par `parseJsonColumn` (packages/shared), qui déballe
 * jusqu'à trois fois. Ce contournement traitait le symptôme ; voici la cause.
 *
 * ⚠️ Toute nouvelle colonne `jsonb` doit être ajoutée ici. Requête de contrôle :
 * `select table_name, column_name from information_schema.columns
 *   where table_schema='public' and data_type in ('jsonb','json');`
 */
const JSON_COLUMNS: Record<string, readonly string[]> = {
  audit_log: ['details'],
  exercises: ['muscles_secondary'],
  food_entries: ['micronutrients'],
  foods: ['micronutrients', 'portions'],
  menstrual_daily_logs: ['symptoms'],
  nutrition_profiles: ['allergens', 'meals', 'restrictions'],
  user_settings: ['active_pillars', 'dashboard_layout', 'notifications'],
};

/**
 * Déballe les colonnes JSON d'une opération avant l'envoi à Postgres.
 *
 * Tolérant par conception : une valeur déjà décodée (objet/tableau), `null`, ou une chaîne
 * illisible sont laissées telles quelles plutôt que de faire échouer toute la transaction —
 * bloquer la synchro est précisément ce qu'on cherche à éviter ici.
 */
function decodeJsonColumns(
  table: string,
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const columns = JSON_COLUMNS[table];
  if (!data || !columns) return data;

  let out: Record<string, unknown> | undefined;
  for (const column of columns) {
    const value = data[column];
    if (typeof value !== 'string') continue;
    try {
      out ??= { ...data };
      out[column] = JSON.parse(value);
    } catch {
      // Chaîne non-JSON : on n'y touche pas. Postgres tranchera, et l'erreur sera tracée.
    }
  }
  return out ?? data;
}

/** Exposé pour les tests uniquement — le connecteur lui-même exige PowerSync et Supabase. */
export const decodeJsonColumnsForTest = decodeJsonColumns;

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
      const opData = decodeJsonColumns(op.table, op.opData);
      let result;
      switch (op.op) {
        case UpdateType.PUT:
          result = await table.upsert({ ...opData, id: op.id });
          break;
        case UpdateType.PATCH:
          result = await table.update(opData ?? {}).eq('id', op.id);
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
