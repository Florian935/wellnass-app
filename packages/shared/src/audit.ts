/**
 * Journal d'audit du back-office (US 8.10). Logique **pure** : actions auditables (union
 * stable), schéma Zod de validation d'une entrée, et clé de libellé i18n associée à chaque
 * action. Aucune I/O — l'admin fait l'écriture (table `audit_log`).
 *
 * Contrat : cf. docs/specs/functional/us/8.10-admin-log-audit.md.
 */
import { z } from 'zod';

/** Actions auditables du back-office. */
export type AuditAction =
  | 'role.grant'
  | 'role.revoke'
  | 'exercise.create'
  | 'exercise.update'
  | 'exercise.archive'
  | 'exercise.publish'
  | 'program.create'
  | 'program.update'
  | 'program.archive'
  | 'program.publish'
  | 'food.create'
  | 'food.update'
  | 'food.archive'
  | 'food.import';

/** Même ordre que l'union `AuditAction`, sans doublon. */
export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'role.grant',
  'role.revoke',
  'exercise.create',
  'exercise.update',
  'exercise.archive',
  'exercise.publish',
  'program.create',
  'program.update',
  'program.archive',
  'program.publish',
  'food.create',
  'food.update',
  'food.archive',
  'food.import',
];

/** Entrée d'audit à écrire (avant horodatage/auteur, ajoutés côté data). */
export type AuditEntryInput = {
  action: AuditAction;
  targetTable?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  details?: Record<string, unknown>;
};

/** Schéma Zod d'une entrée d'audit : action ∈ union ; targetId uuid|null ; details défaut `{}`. */
export const auditEntrySchema = z.object({
  action: z.enum([...AUDIT_ACTIONS] as [AuditAction, ...AuditAction[]]),
  targetTable: z.string().nullish(),
  targetId: z.string().uuid().nullish(),
  targetLabel: z.string().nullish(),
  details: z.record(z.unknown()).default({}),
});

/** Clé i18n du libellé FR d'une action (ex. `audit.action.program.publish`). */
export function auditActionLabelKey(action: AuditAction): string {
  return `audit.action.${action}`;
}
