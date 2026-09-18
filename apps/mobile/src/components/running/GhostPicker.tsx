/**
 * US FANT-01 — le choix du fantôme, sur l'écran de départ (spec §3, R2).
 *
 * ⚠️ **Aucune permission demandée ici.** On lit la **dernière position connue** uniquement si la
 * permission de localisation est *déjà* accordée : l'écran de départ ne doit pas ouvrir une boîte de
 * dialogue système avant même que le coureur ait appuyé sur « démarrer » — c'est `startTracking` qui
 * porte cette demande, et elle doit rester lisible.
 *
 * Sans position, aucune proposition (R2) : proposer une course partie d'une autre ville serait pire
 * que de ne rien proposer.
 */

import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { GHOST_SUGGESTIONS, useGhostCandidates } from '@/data/repositories/run-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Dernière position connue, si et seulement si la permission est déjà accordée. */
function useKnownPosition(): { lat: number; lng: number } | null {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted) return;
        const last = await Location.getLastKnownPositionAsync();
        if (!last || cancelled) return;
        setPosition({ lat: last.coords.latitude, lng: last.coords.longitude });
      } catch {
        // Offline-first : pas de position = pas de proposition, jamais d'erreur à l'écran.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return position;
}

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null) return '—';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function GhostPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const position = useKnownPosition();
  const { candidates } = useGhostCandidates(position);
  const [expanded, setExpanded] = useState(false);

  const shown = expanded ? candidates : candidates.slice(0, GHOST_SUGGESTIONS);
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' });

  return (
    <Card>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={18} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>{t('running.ghost.cta')}</Text>
      </View>

      {candidates.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t('running.ghost.none')}</Text>
      ) : (
        <>
          {shown.map((candidate) => {
            const selected = candidate.id === selectedId;
            return (
              <Pressable
                key={candidate.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(selected ? null : candidate.id)}
                style={[
                  styles.option,
                  { borderColor: selected ? colors.accent : colors.border },
                  selected && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={selected ? colors.accent : colors.textMuted}
                />
                <Text style={[styles.optionLabel, { color: colors.text }]} numberOfLines={2}>
                  {t('running.ghost.option', {
                    date: dateFormat.format(new Date(candidate.finishedAt)),
                    distance: units.formatDistance(candidate.distanceM / 1000),
                    duration: formatDuration(candidate.durationSeconds),
                  })}
                </Text>
              </Pressable>
            );
          })}

          {!expanded && candidates.length > GHOST_SUGGESTIONS ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setExpanded(true)}
              style={styles.more}
            >
              <Text style={[styles.moreLabel, { color: colors.accent }]}>
                {t('running.ghost.pick')}
              </Text>
            </Pressable>
          ) : null}

          {selectedId !== null ? (
            <Pressable accessibilityRole="button" onPress={() => onSelect(null)} style={styles.more}>
              <Text style={[styles.moreLabel, { color: colors.textMuted }]}>
                {t('running.ghost.clear')}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontFamily: fontFamily.displaySemi, fontSize: 17, letterSpacing: -0.3 },
  empty: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  // `minHeight` et non `height` : la ligne grandit avec la police système, et la cible reste ≥ 48 dp.
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  optionLabel: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 14, lineHeight: 19 },
  more: { minHeight: 44, justifyContent: 'center' },
  moreLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
});
