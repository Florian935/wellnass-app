/**
 * US DASH-01 (§4.4) — « **À ta portée** » : les trois records les plus proches d'être battus.
 *
 * MUSC-09 détecte les records depuis le début ; ce qui manquait, c'est la question qui donne envie
 * d'aller à la salle — **de combien je suis loin, aujourd'hui ?** `nearRecords` (`@wellness/shared`,
 * testée) écarte ce qui n'est pas atteignable : un écart de 30 kg n'est pas une motivation, c'est
 * une information. La carte se tait quand rien n'est à portée, plutôt que d'afficher trois lignes
 * décourageantes.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { StaggerIn } from '@/components/motion/StaggerIn';
import { DenseTile } from '@/components/stage/DenseTile';
import { useNearRecords } from '@/data/repositories/records-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { onOpenExercise: (exerciseId: string) => void };

export function NearRecordsCard({ onOpenExercise }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { items } = useNearRecords();

  if (items.length === 0) return null;

  return (
    <DenseTile
      title={t('stage.strength.reach.title')}
      meta={t('stage.strength.reach.meta')}
      testID="near-records-card"
    >
      <View style={styles.list}>
        {items.map((item, index) => (
          <StaggerIn key={item.exerciseId} index={index}>
            <PressableScale
              haptic="select"
              onPress={() => onOpenExercise(item.exerciseId)}
              accessibilityRole="button"
              accessibilityLabel={t(`stage.strength.near.${item.gapKind}`, {
                exercise: item.exerciseName,
                gap: item.gap,
                count: item.gap,
              })}
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            >
              <View style={styles.texts}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.exerciseName}
                </Text>
                <Text style={[styles.gap, { color: colors.textMuted }]} numberOfLines={1}>
                  {t(`stage.strength.near.${item.gapKind}`, {
                    exercise: item.exerciseName,
                    gap: item.gap,
                    count: item.gap,
                  })}
                </Text>
              </View>
              {/* La part du record déjà atteinte : une barre, pas un pourcentage — le chiffre est dans le texte. */}
              <View style={[styles.track, { backgroundColor: colors.track }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.round(item.ratio * 100)}%`, backgroundColor: colors.accent },
                  ]}
                />
              </View>
            </PressableScale>
          </StaggerIn>
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stage.strength.reach.hint')}</Text>
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8, minHeight: 44 },
  texts: { gap: 2 },
  name: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  gap: { fontFamily: fontFamily.bodyMedium, fontSize: 12.5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  hint: { fontFamily: fontFamily.body, fontSize: 11.5 },
});
