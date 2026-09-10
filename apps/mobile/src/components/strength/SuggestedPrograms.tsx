/**
 * US MUSCU-UX01 — trois programmes proposés d'emblée au compte neuf.
 *
 * Sans programme actif, le hub ne proposait rien à choisir : il fallait repérer une petite tuile
 * parmi sept, ouvrir la bibliothèque, puis trier. Trois propositions immédiates suppriment cette
 * étape pour l'écrasante majorité des cas.
 *
 * ── Sur quoi elles sont triées — et ce qu'on n'a pas ─────────────────────────────────────────────
 * ⚠️ La spec annonçait d'abord un tri « sur le niveau et la fréquence déclarés à l'onboarding ».
 * Vérification faite, **le profil ne stocke ni l'un ni l'autre** : l'onboarding demande un objectif
 * (`mainGoal`) et un niveau d'**affichage de séance** (`workoutDisplayLevel`), qui décrit la densité
 * de l'écran de séance, pas l'expérience du pratiquant.
 *
 * On utilise donc ce qui existe réellement :
 *  - `workoutDisplayLevel` comme **proxy assumé** de l'expérience — l'onboarding le présente
 *    lui-même en ces termes (« Simplifiée — idéal pour débuter ») ;
 *  - à défaut, les programmes **débutants d'abord**, ce qui est le bon défaut pour quelqu'un qui
 *    n'a encore rien fait dans l'app.
 *
 * Demander une vraie fréquence hebdomadaire à l'onboarding améliorerait nettement ce tri — c'est
 * une US à part, pas un ajout discret ici.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ProgramLevel, WorkoutDisplayLevel } from '@wellness/shared';
import { useProgramLibrary, type ProgramListItem } from '@/data/repositories/program-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Nombre de propositions — trois : assez pour choisir, assez peu pour ne pas retrier. */
const SUGGESTION_COUNT = 3;

/**
 * Niveau de programme visé selon le niveau d'affichage choisi à l'onboarding.
 * Proxy assumé (voir l'en-tête) : c'est le seul signal d'expérience dont on dispose.
 */
function preferredLevel(display: WorkoutDisplayLevel | null | undefined): ProgramLevel {
  if (display === 'detailed') return 'advanced';
  if (display === 'normal') return 'intermediate';
  return 'beginner';
}

/** Ordre de repli quand le niveau visé ne donne pas assez de programmes. */
const LEVEL_FALLBACK: Record<ProgramLevel, ProgramLevel[]> = {
  beginner: ['beginner', 'intermediate', 'advanced'],
  intermediate: ['intermediate', 'beginner', 'advanced'],
  advanced: ['advanced', 'intermediate', 'beginner'],
};

type Props = {
  displayLevel: WorkoutDisplayLevel | null | undefined;
  onPick: (programId: string) => void;
  onSeeAll: () => void;
};

export function SuggestedPrograms({ displayLevel, onPick, onSeeAll }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Toute la bibliothèque muscu : le tri se fait ici, pas en SQL — trois requêtes filtrées par
  // niveau coûteraient plus cher que de trier une liste éditoriale, qui tient en quelques dizaines
  // de lignes.
  const { programs, isLoading } = useProgramLibrary({ pillar: 'strength' });

  if (isLoading || programs.length === 0) return null;

  const wanted = preferredLevel(displayLevel);
  const order = LEVEL_FALLBACK[wanted];
  const ranked = [...programs].sort((a, b) => {
    const rank = (p: ProgramListItem) =>
      p.level ? order.indexOf(p.level) : order.length; // niveau inconnu en dernier
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
  const suggestions = ranked.slice(0, SUGGESTION_COUNT);

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
