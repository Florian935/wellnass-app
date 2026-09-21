/**
 * US SERIE-01 — le réglage de la régularité : **l'unité de la série** et **l'objectif hebdomadaire**.
 *
 * ── Pourquoi un composant à part ────────────────────────────────────────────────────────────────
 * `settings.tsx` dépasse les 1 100 lignes. Y verser une section de plus la rendrait un peu moins
 * relisible à chaque US ; l'extraire coûte un fichier et rend la section testable seule.
 *
 * ── Les trois choses que cette section dit ──────────────────────────────────────────────────────
 * 1. **En quoi on compte** — jours ou semaines. Les deux comptes existent toujours, tout le temps :
 *    on choisit celui qui s'affiche, jamais celui qui est calculé (spec D2).
 * 2. **Combien d'activités par semaine** — de 1 à 14, toutes disciplines confondues. Et **rien**
 *    tant qu'on n'a pas répondu : le bandeau affiche alors le compte nu (spec R9).
 * 3. **Quand les deux cibles ne collent pas** — objectif transverse sous la fréquence de course
 *    visée. 🔴 On le **signale**, on ne corrige pas (spec R10) : les deux chiffres sont légitimes
 *    — l'un compte les sorties, l'autre toutes les activités — et trancher à la place de
 *    l'utilisateur serait exactement le défaut que le régime de guidage cherche à éviter.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN, type StreakUnit } from '@wellness/shared';
import { Segment } from '@/components/Segment';
import { updateSettings, useSettings } from '@/data/repositories/settings-repository';
import { useStreakData } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

const UNIT_OPTIONS = ['day', 'week'] as const;

/**
 * L'objectif proposé quand on n'en a jamais réglé.
 *
 * 🔴 **Proposé, pas écrit** (spec D4) : tant que personne n'a touché le bouton, la colonne reste à
 * `null` et l'app affiche le compte nu. La valeur suggérée s'aligne sur la fréquence de course
 * visée quand elle existe — proposer 3 à quelqu'un qui vise déjà 4 sorties créerait l'incohérence
 * que le bloc d'à côté est chargé de signaler.
 */
function suggestedGoal(runningFrequency: number | null): number {
  const base = runningFrequency ?? 3;
  return Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, base));
}

export function StreakUnitSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { settings } = useSettings();
  const { weekly } = useStreakData();

  const goal = settings?.weeklyActivityGoal ?? null;

  /**
   * L'unité **effective**, pas la colonne brute.
   *
   * Laisser le sélecteur vide quand `streak_unit is null` obligerait à inventer un état visuel de
   * plus pour un cas qui se résout en une ligne ; afficher l'unité réellement en vigueur est ce
   * que l'utilisateur voit sur sa carte d'accueil, donc ce qu'il vient vérifier ici. Le libellé
   * sous le sélecteur dit que les deux comptes continuent d'exister — c'est ce qui empêche de lire
   * ce choix comme « l'autre série est perdue ».
   */
  const unit: StreakUnit = weekly.unit;

  const setUnit = (next: StreakUnit) => void updateSettings({ streakUnit: next });
  const setGoal = (next: number | null) => void updateSettings({ weeklyActivityGoal: next });

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {t('settings.streak.title')}
      </Text>

      {/* 1 — l'unité */}
      <Text style={[styles.label, { color: colors.text }]}>{t('settings.streak.unitLabel')}</Text>
      <Segment
        options={UNIT_OPTIONS}
        value={unit}
        onChange={setUnit}
        label={(option) => t(`settings.streak.unit.${option}`)}
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('settings.streak.unitHint')}
      </Text>

      {/* 2 — l'objectif hebdomadaire */}
      <Text style={[styles.label, { color: colors.text, marginTop: 18 }]}>
        {t('settings.streak.goalLabel')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {goal == null ? (
          <View style={styles.row}>
            <View style={styles.rowGrow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                {t('settings.streak.goalNone')}
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                {t('settings.streak.goalNoneHint', { count: weekly.doneThisWeek })}
              </Text>
            </View>
            <Pressable
              onPress={() => setGoal(suggestedGoal(weekly.runningFrequency))}
              accessibilityRole="button"
              style={[styles.cta, { backgroundColor: colors.accent }]}
            >
              <Text
                style={[styles.ctaLabel, { color: colors.accentText }]}
                maxFontSizeMultiplier={1.3}
              >
                {t('settings.streak.goalSet')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.rowGrow}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('settings.streak.goalValue', { count: goal })}
                </Text>
                <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                  {t('settings.streak.goalBounds', { min: WEEKLY_GOAL_MIN, max: WEEKLY_GOAL_MAX })}
                </Text>
              </View>
              {/* Pas de boucle modulo comme le sélecteur d'heure : un objectif qui passerait de 14
                  à 1 d'un appui serait une erreur de saisie, pas un choix. On borne, on n'enroule
                  pas — et les bornes sont celles de la brique pure, jamais recopiées ici. */}
              <View
                style={[
                  styles.stepper,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Pressable
                  onPress={() => setGoal(Math.max(WEEKLY_GOAL_MIN, goal - 1))}
                  disabled={goal <= WEEKLY_GOAL_MIN}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.streak.goalDecrease')}
                  hitSlop={8}
                  style={styles.stepperBtn}
                >
                  <Text
                    style={[
                      styles.stepperSign,
                      { color: goal <= WEEKLY_GOAL_MIN ? colors.textMuted : colors.accent },
                    ]}
                  >
                    −
                  </Text>
                </Pressable>
                <Text
                  style={[styles.stepperVal, { color: colors.text, borderColor: colors.border }]}
                >
                  {goal}
                </Text>
                <Pressable
                  onPress={() => setGoal(Math.min(WEEKLY_GOAL_MAX, goal + 1))}
                  disabled={goal >= WEEKLY_GOAL_MAX}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.streak.goalIncrease')}
                  hitSlop={8}
                  style={styles.stepperBtn}
                >
                  <Text
                    style={[
                      styles.stepperSign,
                      { color: goal >= WEEKLY_GOAL_MAX ? colors.textMuted : colors.accent },
                    ]}
                  >
                    +
                  </Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={() => setGoal(null)}
              accessibilityRole="button"
              style={[styles.remove, { borderTopColor: colors.border }]}
            >
              <Text
                style={[styles.removeLabel, { color: colors.accent }]}
                maxFontSizeMultiplier={1.3}
              >
                {t('settings.streak.goalRemove')}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {/* 3 — l'incohérence, signalée et pas corrigée */}
      {weekly.goalConflict && weekly.runningFrequency != null && goal != null && (
        <View
          style={[
            styles.conflict,
            {
              backgroundColor: withAlpha(colors.warnText, 0.09),
              borderColor: withAlpha(colors.warnText, 0.3),
            },
          ]}
          accessibilityRole="alert"
        >
          <Text
            style={[styles.conflictTitle, { color: colors.warnText }]}
            maxFontSizeMultiplier={1.3}
          >
            {t('settings.streak.conflictTitle')}
          </Text>
          <Text style={[styles.conflictBody, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
            {t('settings.streak.conflictBody', { goal, runs: weekly.runningFrequency })}
          </Text>
          {/* Une seule action proposée, et elle va dans le sens de l'utilisateur : aligner
              l'objectif sur ce qu'il vise déjà. Rien ne l'y oblige — le message reste s'il
              l'ignore, et c'est très bien : signaler n'est pas exiger. */}
          <Pressable
            onPress={() => setGoal(weekly.runningFrequency)}
            accessibilityRole="button"
            style={styles.conflictCta}
          >
            <Text
              style={[styles.conflictCtaLabel, { color: colors.accent }]}
              maxFontSizeMultiplier={1.3}
            >
              {t('settings.streak.conflictFix', { count: weekly.runningFrequency })}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 28,
    marginBottom: 10,
  },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 14, marginBottom: 8 },
  hint: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 8, lineHeight: 18 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowGrow: { flex: 1, minWidth: 0, paddingRight: 12 },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  rowDesc: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 2, lineHeight: 16 },
  cta: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  ctaLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  stepperBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  stepperSign: { fontFamily: fontFamily.bodyBold, fontSize: 20 },
  stepperVal: {
    fontFamily: fontFamily.mono,
    fontSize: 16,
    minWidth: 42,
    textAlign: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingVertical: 12,
  },
  remove: { borderTopWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  removeLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  conflict: { marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  conflictTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conflictBody: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  conflictCta: { minHeight: 44, justifyContent: 'center' },
  conflictCtaLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
