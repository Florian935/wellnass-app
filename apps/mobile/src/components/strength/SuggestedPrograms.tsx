/**
 * US MUSCU-UX01 — trois programmes proposés d'emblée au compte neuf.
 * US GUID-01 — le tri ne repose plus sur une préférence d'affichage.
 *
 * Sans programme actif, le hub ne proposait rien à choisir : il fallait repérer une petite tuile
 * parmi sept, ouvrir la bibliothèque, puis trier. Trois propositions immédiates suppriment cette
 * étape pour l'écrasante majorité des cas.
 *
 * ── Ce que GUID-01 a corrigé ────────────────────────────────────────────────────────────────────
 * L'en-tête de ce fichier disait, depuis MUSCU-UX01 : « la spec annonçait un tri sur le niveau et
 * la fréquence déclarés à l'onboarding. Vérification faite, **le profil ne stocke ni l'un ni
 * l'autre** […] on utilise `workoutDisplayLevel` comme **proxy assumé** de l'expérience ».
 *
 * Ce constat n'est plus vrai : `training_level` et `weekly_availability` existent, demandés devant
 * la bibliothèque (et non à l'onboarding — décision D6, la question a besoin d'un objet visible).
 * Le proxy survit en **dernier repli**, pour ne pas dégrader les comptes qui n'ont pas répondu.
 *
 * Le tri lui-même vit dans `@wellness/shared` (`program-ranking`), pur et testé : un composant
 * n'est pas l'endroit où l'on fige une règle métier qu'on veut pouvoir vérifier.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  preferredProgramLevel,
  rankSuggestedPrograms,
  type TrainingLevel,
  type WorkoutDisplayLevel,
} from '@wellness/shared';
import { useProgramLibrary } from '@/data/repositories/program-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Nombre de propositions — trois : assez pour choisir, assez peu pour ne pas retrier. */
const SUGGESTION_COUNT = 3;

type Props = {
  /** Le vrai signal — `null` tant que la question n'a pas été posée. */
  trainingLevel: TrainingLevel | null | undefined;
  /** Le proxy historique, conservé en dernier repli. */
  displayLevel: WorkoutDisplayLevel | null | undefined;
  /** Jours d'entraînement disponibles par semaine, si déclarés. */
  weeklyAvailability: number | null | undefined;
  onPick: (programId: string) => void;
  onSeeAll: () => void;
};

export function SuggestedPrograms({
  trainingLevel,
  displayLevel,
  weeklyAvailability,
  onPick,
  onSeeAll,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Toute la bibliothèque muscu : le tri se fait ici, pas en SQL — trois requêtes filtrées par
  // niveau coûteraient plus cher que de trier une liste éditoriale, qui tient en quelques dizaines
  // de lignes.
  const { programs, isLoading } = useProgramLibrary({ pillar: 'strength' });

  if (isLoading || programs.length === 0) return null;

  const context = { trainingLevel, displayLevel, weeklyAvailability };
  // Le libellé de section et le tri viennent du MÊME calcul : deux sources auraient divergé au
  // premier changement, et l'en-tête aurait annoncé un niveau que la liste ne respecte pas.
  const wanted = preferredProgramLevel(context);
  const suggestions = rankSuggestedPrograms(programs, context).slice(0, SUGGESTION_COUNT);

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          {t('strengthHub.suggested.title', { level: t(`programs.level.${wanted}`) })}
        </Text>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.list}>
        {suggestions.map((program) => (
          <Pressable
            key={program.id}
            accessibilityRole="button"
            accessibilityLabel={program.name}
            onPress={() => onPick(program.id)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.icon, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="barbell-outline" size={19} color={colors.accent} />
            </View>
            <View style={styles.rowTexts}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {program.name}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                {[
                  program.level ? t(`programs.level.${program.level}`) : null,
                  program.durationWeeks
                    ? t('programs.weeks', { count: program.durationWeeks })
                    : null,
                  program.goal,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      {programs.length > SUGGESTION_COUNT ? (
        <Pressable accessibilityRole="button" onPress={onSeeAll} style={styles.seeAll} hitSlop={6}>
          <Text style={[styles.seeAllLabel, { color: colors.accent }]}>
            {t('strengthHub.suggested.seeAll', { count: programs.length })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  rule: { flex: 1, height: 1 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTexts: { flex: 1, gap: 3 },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  meta: { fontFamily: fontFamily.body, fontSize: 12.5 },
  seeAll: { alignItems: 'center', paddingVertical: 4 },
  seeAllLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  pressed: { opacity: 0.85 },
});
