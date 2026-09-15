/**
 * US DASH-01 (§4.5) — « **Depuis ta dernière visite** ».
 *
 * L'app sait des choses que l'utilisateur ne sait pas encore : une pesée saisie, un record tombé
 * pendant la séance d'hier, une prédiction qui a bougé. Elles étaient toutes lisibles quelque
 * part — dans trois écrans différents, à condition d'y aller. Cette carte les rassemble **une
 * fois**, au retour, et se tait le reste du temps.
 *
 * ── Trois règles ─────────────────────────────────────────────────────────────────────────────────
 *  1. **Rien d'inventé** : chaque ligne est un écart entre deux mesures réelles (`computeSinceLastVisit`).
 *  2. **Rien de honteux** : un poids qui monte est dit sans commentaire ; c'est un fait, pas un reproche (R8).
 *  3. **Rien à la première visite** : sans instantané précédent, la carte ne se rend pas.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  computeSinceLastVisit,
  resolveRacePredictions,
  type SinceLastVisitItem,
  type VisitSnapshot,
} from '@wellness/shared';
import { StaggerIn } from '@/components/motion/StaggerIn';
import { DenseTile } from '@/components/stage/DenseTile';
import { useLatestWeight } from '@/data/repositories/bodyweight-repository';
import { useRecordsCount } from '@/data/repositories/dashboard-repository';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { useLastVisit } from '@/stores/last-visit-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function SinceLastVisitCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { latest } = useLatestWeight();
  const { count: recordsCount } = useRecordsCount();
  const { records } = useRunningRecords();
  const previous = useLastVisit((s) => s.snapshot);
  const hydrated = useLastVisit((s) => s.hydrated);
  const record = useLastVisit((s) => s.record);

  const prediction10k =
    resolveRacePredictions(records).find((p) => p.distanceKey === '10k')?.predictedSeconds ?? null;

  const now: VisitSnapshot = {
    // Lu dans un effet, pas au rendu : l'horloge n'entre jamais dans un calcul mémoïsé (cf. `useTodayKey`).
    takenAt: '',
    weightKg: latest?.weightKg ?? null,
    recordsCount,
    prediction10kSeconds: prediction10k,
  };

  const items = hydrated ? computeSinceLastVisit(previous, now) : [];

  /**
   * L'instantané se pose **après** la comparaison, et seulement s'il est assez vieux : le reposer à
   * chaque ouverture effacerait le point de comparaison et la carte n'aurait jamais rien à dire.
   */
  useEffect(() => {
    if (!hydrated) return;
    record({ ...now, takenAt: new Date().toISOString() });
    // Volontairement borné aux valeurs comparées : c'est leur changement qui justifie un nouvel instantané.
  }, [hydrated, latest?.weightKg, recordsCount, prediction10k]); // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0) return null;

  return (
    <DenseTile title={t('stage.home.sinceLastVisit.title')} testID="since-last-visit-card">
      <View style={styles.lines}>
        {items.map((item, index) => (
          <StaggerIn key={item.kind} index={index}>
            <Text style={[styles.line, { color: colors.text }]}>{label(item, t)}</Text>
          </StaggerIn>
        ))}
      </View>
    </DenseTile>
  );
}

/** Une ligne par écart, toujours au même format : le fait, jamais le jugement. */
function label(item: SinceLastVisitItem, t: (k: string, o?: Record<string, unknown>) => string): string {
  switch (item.kind) {
    case 'weight':
      return t(
        item.deltaKg < 0 ? 'stage.home.sinceLastVisit.weightDown' : 'stage.home.sinceLastVisit.weightUp',
        { delta: Math.abs(item.deltaKg).toFixed(1) },
      );
    case 'records':
      return t('stage.home.sinceLastVisit.records', { count: item.count });
    default:
      return t(
        item.deltaSeconds < 0
          ? 'stage.home.sinceLastVisit.predictionFaster'
          : 'stage.home.sinceLastVisit.predictionSlower',
        { seconds: Math.abs(item.deltaSeconds) },
      );
  }
}

const styles = StyleSheet.create({
  lines: { gap: 6 },
  line: { fontFamily: fontFamily.bodyMedium, fontSize: 14, lineHeight: 20 },
});
