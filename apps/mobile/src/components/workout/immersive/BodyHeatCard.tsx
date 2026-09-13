/**
 * Le corps qui chauffe — US MUSCU-UX03, spec §5.11.
 *
 * Chaque série validée réchauffe les muscles qu'elle sollicite. À la fin de la séance, le schéma
 * **est** la séance : on voit d'un coup d'œil ce qu'on a travaillé, sans lire une liste.
 *
 * ── La légende n'est pas décorative ─────────────────────────────────────────────────────────────
 * Elle est **obligatoire** : la couleur ne porte jamais seule une information (règle
 * d'accessibilité du projet). Les deux muscles les plus chauds y sont nommés avec leur nombre de
 * séries — ce que le dégradé montre, le texte le dit.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FineMuscle, SessionHeat } from '@wellness/shared';
import { hottestMuscles } from '@wellness/shared';
import { BodyMap } from '@/components/body/BodyMap';
import { heatColor } from '@/components/workout/immersive/theme';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

type Props = {
  heat: SessionHeat;
  /** Nombre de séries validées par muscle, pour la légende écrite. */
  setsByMuscle: Partial<Record<FineMuscle, number>>;
  /** Dernier muscle réchauffé : son halo pulse une fois. */
  pulse: FineMuscle | null;
  colors: Palette;
};

export function BodyHeatCard({ heat, setsByMuscle, pulse, colors }: Props) {
  const { t } = useTranslation();
  const hottest = hottestMuscles(heat, 2);

  return (
    <View style={styles.card}>
      <BodyMap
        full={[]}
        reduced={[]}
        heat={heat}
        heatColor={heatColor}
        height={132}
        pulse={pulse}
        colors={{ neutral: colors.surfaceAlt, accent: colors.accent, caption: colors.textMuted }}
      />
      {hottest.length > 0 ? (
        <View style={styles.legend}>
          {hottest.map((muscle) => (
            <Text key={muscle} style={[styles.legendText, { color: colors.text }]}>
              {t('immersive.heat.legendItem', {
                muscle: t(`muscleFine.${muscle}`),
                count: setsByMuscle[muscle] ?? 0,
              })}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t('immersive.heat.empty')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 10 },
  legend: { alignItems: 'center', gap: 2 },
  legendText: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  empty: { fontFamily: fontFamily.body, fontSize: 12.5, textAlign: 'center' },
});
