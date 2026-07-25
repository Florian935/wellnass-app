import { supabase } from '../lib/supabase';
import { canonicalPair } from '@wellness/shared';
import { logAudit } from './audit';

/**
 * Couche data des liens éditoriaux « variantes / alternatives » entre exercices
 * de la bibliothèque (US MUSC-F10c-2, Task 5 — admin). Table `exercise_variants`
 * (paire canonique `exercise_id_a < exercise_id_b`, voir `canonicalPair`).
 * Liens ÉDITORIAUX = `owner_id IS NULL` (à distinguer des liens perso créés côté
 * mobile, `owner_id` = utilisateur). Écriture réservée à l'admin (RLS
 * `is_content_editor()`), lecture via la clé anon (RLS lecture publique éditoriale).
 */

/** Une variante éditoriale liée à un exercice, vue côté admin (nom FR résolu). */
export type EditorialVariant = { linkId: string; otherId: string; nameFr: string | null };

/**
 * Variantes éditoriales liées à `exerciseId`, triées par nom FR. Résout le nom
 * de l'« autre » exercice de chaque paire via `exercise_translations` (lang fr).
 */
export async function listVariants(exerciseId: string): Promise<{
  variants: EditorialVariant[];
  error: unknown;
}> {
  const { data, error } = await supabase
    .from('exercise_variants')
    .select('id, exercise_id_a, exercise_id_b')
    .is('owner_id', null)
    .is('deleted_at', null)
    .or(`exercise_id_a.eq.${exerciseId},exercise_id_b.eq.${exerciseId}`);

  if (error) {
    return { variants: [], error };
  }

  const rows = data ?? [];
  const otherIds = rows.map((row) =>
    row.exercise_id_a === exerciseId ? row.exercise_id_b : row.exercise_id_a,
  );

  const namesById = new Map<string, string>();
  if (otherIds.length > 0) {
    const { data: translations, error: trError } = await supabase
      .from('exercise_translations')
      .select('exercise_id, name')
      .eq('lang', 'fr')
      .is('deleted_at', null)
      .in('exercise_id', otherIds);

    if (trError) {
      return { variants: [], error: trError };
    }
    for (const t of translations ?? []) {
      namesById.set(t.exercise_id, t.name);
    }
  }

  const variants: EditorialVariant[] = rows.map((row) => {
    const otherId = row.exercise_id_a === exerciseId ? row.exercise_id_b : row.exercise_id_a;
    return { linkId: row.id, otherId, nameFr: namesById.get(otherId) ?? null };
  });

  variants.sort((a, b) => (a.nameFr ?? '').localeCompare(b.nameFr ?? ''));

  return { variants, error: null };
}

/**
 * Exercices publiés de la bibliothèque pouvant être liés à `exerciseId` (exclut
 * `exerciseId` lui-même et `excludeIds`, typiquement les variantes déjà liées).
 */
export async function listLinkableExercises(
  exerciseId: string,
  excludeIds: string[],
): Promise<{ rows: { id: string; nameFr: string | null }[]; error: unknown }> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, exercise_translations(lang, name)')
    .is('owner_id', null)
    .eq('status', 'published')
    .is('deleted_at', null)
    .neq('id', exerciseId);

  if (error) {
    return { rows: [], error };
  }

  const excluded = new Set(excludeIds);
  const rows = (data ?? [])
    .filter((ex) => !excluded.has(ex.id))
    .map((ex) => {
      const translations = (ex.exercise_translations ?? []) as { lang: string; name: string }[];
      const fr = translations.find((t) => t.lang === 'fr');
      return { id: ex.id, nameFr: fr?.name ?? null };
    });

  rows.sort((a, b) => (a.nameFr ?? '').localeCompare(b.nameFr ?? ''));

  return { rows, error: null };
}

/**
 * Lie deux exercices éditoriaux (upsert par clé naturelle sur la paire canonique) :
 * réactive une ligne soft-deletée existante, sinon insère. Évite la violation de
 * l'unique `(owner_id, exercise_id_a, exercise_id_b) nulls not distinct`.
 */
export async function addEditorialVariant(aId: string, bId: string): Promise<{ error: unknown }> {
  const { a, b } = canonicalPair(aId, bId);

  const { data: existing, error: selectError } = await supabase
    .from('exercise_variants')
    .select('id, deleted_at')
    .is('owner_id', null)
    .eq('exercise_id_a', a)
    .eq('exercise_id_b', b)
    .maybeSingle();

  if (selectError) {
    return { error: selectError };
  }

  let linkId: string;
  if (existing) {
    const { error: updateError } = await supabase
      .from('exercise_variants')
      .update({ deleted_at: null })
      .eq('id', existing.id);
    if (updateError) {
      return { error: updateError };
    }
    linkId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('exercise_variants')
      .insert({ owner_id: null, exercise_id_a: a, exercise_id_b: b })
      .select('id')
      .single();
    if (insertError) {
      return { error: insertError };
    }
    linkId = inserted.id;
  }

  await logAudit({
    action: 'exercise_variant.link',
    targetTable: 'exercise_variants',
    targetId: linkId,
  });

  return { error: null };
}

/** Retire (soft-delete) un lien éditorial. */
export async function removeEditorialVariant(linkId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('exercise_variants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', linkId)
    .is('owner_id', null);

  if (error) {
    return { error };
  }

  await logAudit({
    action: 'exercise_variant.unlink',
    targetTable: 'exercise_variants',
    targetId: linkId,
  });

  return { error: null };
}
