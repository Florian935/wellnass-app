/**
 * US NORYN-01 — le contrat de Noryn, en zod **strict**.
 *
 * Fidèle aux règles de `docs/08-WELLNESS-CONTRACT.md` (« Concrete v1 contract (TASK-013) ») et aux
 * schémas de Noryn (`packages/contracts/src/wellness-source.ts`, lus le 08/10/2026), écrits ici en zod 3
 * (celui du paquet) quand Noryn est en zod 4 : les deux écarts de comportement connus (décalage horaire
 * sans deux-points, règle de semaine évaluée sur une date invalide) sont fermés explicitement. Toute réponse de
 * `noryn-context` est validée ici **avant** de partir (DD3) : une réponse hors contrat devient une
 * erreur, jamais un 200 — pour des données de santé, Noryn préfère « indisponible » à « plus que
 * convenu ». Un champ en plus est donc une faute, pas un détail.
 *
 * Faire évoluer le contrat : un champ entre d'abord dans le contrat et dans Noryn, puis ici.
 */

import { z } from 'zod';
import { addDayKeys, isMondayKey, isValidDayKey, weekKeysFrom } from './paris-date';

export const NORYN_SESSION_KINDS = ['strength', 'running'] as const;
export const NORYN_SESSION_INTENSITIES = ['low', 'moderate', 'high'] as const;
export const NORYN_SESSION_STATUSES = ['planned', 'done', 'skipped'] as const;
export const NORYN_SESSION_TAGS = [
  'heavy_lower',
  'upper_body',
  'easy_run',
  'long_run',
  'intervals',
  'race_effort',
] as const;
export const NORYN_READINESS_VERDICTS = ['rest', 'ok', 'push'] as const;

export type NorynSessionKind = (typeof NORYN_SESSION_KINDS)[number];
export type NorynSessionIntensity = (typeof NORYN_SESSION_INTENSITIES)[number];
export type NorynSessionStatus = (typeof NORYN_SESSION_STATUSES)[number];
export type NorynSessionTag = (typeof NORYN_SESSION_TAGS)[number];

/** Un UUID canonique minuscule : jamais du texte libre, qui pourrait porter un titre ou une note. */
export const NORYN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Plafonds du contrat. */
export const MAX_SESSIONS_PER_DAY = 6;
export const MAX_SESSIONS_PER_WEEK = 42;
export const MAX_DONE_PER_WEEK = 50;

const dayKey = z.string().refine(isValidDayKey);
const monday = z.string().refine((value) => isValidDayKey(value) && isMondayKey(value));
// zod 3 accepte `+0200` ; le zod 4 de Noryn exige `+02:00`.
const instant = z
  .string()
  .datetime({ offset: true })
  .regex(/(Z|[+-]\d{2}:\d{2})$/);
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const level = int(1, 5);
const unique = (values: readonly string[]) => new Set(values).size === values.length;

const sessionSchema = z
  .object({
    id: z.string().regex(NORYN_UUID),
    date: dayKey,
    start_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    kind: z.enum(NORYN_SESSION_KINDS),
    intensity: z.enum(NORYN_SESSION_INTENSITIES).nullable(),
    estimated_minutes: int(1, 600).nullable(),
    status: z.enum(NORYN_SESSION_STATUSES),
    tags: z.array(z.enum(NORYN_SESSION_TAGS)).max(4).refine(unique),
  })
  .strict();

const sessions = (max: number) =>
  z
    .array(sessionSchema)
    .max(max)
    .refine((list) => unique(list.map((s) => s.id)));

/** `synced_at` ne postdate jamais la réponse qui le porte. */
const syncedBeforeGenerated = (value: { generated_at: string; synced_at: string | null }) =>
  value.synced_at === null || Date.parse(value.synced_at) <= Date.parse(value.generated_at);

export const norynDaySchema = z
  .object({
    date: dayKey,
    generated_at: instant,
    synced_at: instant.nullable(),
    steps: z
      .object({ count: int(0, 200_000).nullable(), daily_target: int(1_000, 50_000) })
      .strict()
      .nullable(),
    nutrition: z
      .object({
        energy_kcal: int(0, 20_000).nullable(),
        energy_target_kcal: int(1, 20_000).nullable(),
        protein_g: int(0, 2_000).nullable(),
        protein_target_g: int(1, 2_000).nullable(),
      })
      .strict()
      .refine((n) => (n.energy_kcal === null) === (n.protein_g === null))
      .nullable(),
    hydration: z
      .object({ volume_ml: int(0, 20_000).nullable(), target_ml: int(1, 10_000) })
      .strict()
      .nullable(),
    recovery: z
      .object({
        sleep_minutes: int(0, 840).nullable(),
        sleep_quality: level.nullable(),
        energy: level.nullable(),
        motivation: level.nullable(),
      })
      .strict()
      .nullable(),
    readiness: z.enum(NORYN_READINESS_VERDICTS).nullable(),
    intensity_on_hold: z.boolean(),
    training: sessions(MAX_SESSIONS_PER_DAY),
  })
  .strict()
  .refine(syncedBeforeGenerated)
  .refine((d) => d.training.every((s) => s.date === d.date))
  .refine(
    (d) =>
      d.synced_at !== null ||
      ((d.steps?.count ?? null) === null &&
        (d.nutrition?.energy_kcal ?? null) === null &&
        (d.hydration?.volume_ml ?? null) === null &&
        Object.values(d.recovery ?? {}).every((v) => v === null) &&
        d.readiness === null &&
        !d.intensity_on_hold &&
        d.training.length === 0),
  );

export const norynWeekSchema = z
  .object({
    start: monday,
    generated_at: instant,
    synced_at: instant.nullable(),
    steps: z
      .object({
        daily_target: int(1_000, 50_000),
        days: z.array(z.object({ date: dayKey, count: int(0, 200_000).nullable() }).strict()).length(7),
      })
      .strict()
      .nullable(),
    sleep: z
      .object({ average_minutes: int(0, 840).nullable(), nights: int(0, 7) })
      .strict()
      .refine((s) => (s.nights === 0) === (s.average_minutes === null))
      .nullable(),
    training: z
      .object({
        sessions: sessions(MAX_SESSIONS_PER_WEEK),
        done: z.object({ strength: int(0, MAX_DONE_PER_WEEK), running: int(0, MAX_DONE_PER_WEEK) }).strict(),
      })
      .strict(),
  })
  .strict()
  .refine(syncedBeforeGenerated)
  .refine((w) => {
    // zod 3 évalue ce `refine` même quand `start` a échoué : ne rien calculer sur une date invalide.
    if (!isValidDayKey(w.start)) return false;
    const dates = weekKeysFrom(w.start);
    const perDay = (key: string) => w.training.sessions.filter((s) => s.date === key).length;
    return (
      (w.steps === null || w.steps.days.every((d, i) => d.date === dates[i])) &&
      w.training.sessions.every((s) => s.date >= w.start && s.date <= addDayKeys(w.start, 6)) &&
      dates.every((key) => perDay(key) <= MAX_SESSIONS_PER_DAY)
    );
  })
  .refine(
    (w) =>
      w.synced_at !== null ||
      ((w.steps?.days ?? []).every((d) => d.count === null) &&
        (w.sleep?.nights ?? 0) === 0 &&
        w.training.sessions.length === 0 &&
        w.training.done.strength === 0 &&
        w.training.done.running === 0),
  );

export type NorynDay = z.infer<typeof norynDaySchema>;
export type NorynWeek = z.infer<typeof norynWeekSchema>;
export type NorynSession = z.infer<typeof sessionSchema>;
