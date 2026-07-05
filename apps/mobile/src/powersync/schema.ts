import { column, Schema, Table } from '@powersync/react-native';

/**
 * Schéma de la base **locale SQLite** gérée par PowerSync.
 *
 * Pour l'instant : une seule table `todos` (table jouet du runbook du spike) servant à
 * valider le pipeline de synchronisation de bout en bout. Les vraies entités du domaine
 * (Workout, FoodLog, …) seront ajoutées avec leurs US, après figeage du modèle.
 *
 * Convention : l'`id` (UUID, PK texte) est implicite dans PowerSync ; on déclare les autres
 * colonnes. Timestamps en UTC (voir modele-donnees.md §1).
 */
const todos = new Table({
  user_id: column.text,
  text: column.text,
  created_at: column.text,
  updated_at: column.text,
});

export const AppSchema = new Schema({ todos });
