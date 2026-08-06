/**
 * US DOUL-01 — écran du journal des zones sensibles.
 *
 * Trois blocs : le schéma corporel (déclaration au tap), la liste des zones actuellement sensibles,
 * et l'historique.
 *
 * ── Deux parcours de saisie, et ce n'est pas une redondance ──────────────────────────────────────
 * `react-native-svg` n'accepte pas `accessibilityRole` sur ses formes : un tracé SVG n'est donc pas
 * un bouton pour TalkBack. La **liste de zones** sous le schéma est le parcours accessible — de vrais
 * boutons, atteignables au lecteur d'écran, et plus sûrs au doigt pour les petites articulations.
 * Le schéma est l'affordance visuelle ; la liste est le chemin garanti.
 *
 * ⚠️ **Aucun vocabulaire médical** (R6) : ni « blessure », ni « repos conseillé », ni « consulte ».
 * Le mot employé est « zone sensible », et un test parcourt les clés `pain.*` pour le vérifier.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  PAIN_JOINT_ZONES,
  PAIN_LEVELS,
  PAIN_MUSCLE_ZONES,
  formatDayFull,
  localDayKey,
  type PainLevel,
  type PainZone,
} from '@wellness/shared';

import { Screen } from '@/components/Screen';
import { PainBodyMap } from '@/components/body/PainBodyMap';
import {
  deletePainReport,
  reportPain,
  useCurrentPainZones,
  usePainReports,
} from '@/data/repositories/pain-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function PainScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const todayKey = useTodayKey();

  const { zones: current } = useCurrentPainZones();
  const { reports } = usePainReports();

  const [selected, setSelected] = useState<PainZone | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Niveau courant de chaque zone, pour colorer le schéma. */
  const levels = useMemo(() => {
    const map: Partial<Record<PainZone, PainLevel>> = {};
    for (const r of current) map[r.zone] = r.level;
    return map;
  }, [current]);

  const declare = async (zone: PainZone, level: PainLevel) => {
    setError(null);
    try {
      // Jamais `void` : l'écriture peut échouer (journal désactivé, session perdue) et l'utilisateur
      // doit le voir — c'est ce qui avait rendu la panne de CYCLE-01 invisible.
      await reportPain({ zone, level, logDate: localDayKey(new Date()) });
      setSelected(null);
    } catch {
      setError(t('pain.errors.failed'));
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await deletePainReport(id);
    } catch {
      setError(t('pain.errors.failed'));
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.textMuted }]}>{t('pain.intro')}</Text>

        <PainBodyMap levels={levels} onSelect={setSelected} selected={selected} />

        {/* Le parcours accessible : de vrais boutons, groupés muscles puis articulations. */}
        <Text style={[styles.section, { color: colors.text }]}>{t('pain.pickZone')}</Text>
        <ZoneChips zones={[...PAIN_MUSCLE_ZONES]} selected={selected} onSelect={setSelected} />
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('pain.jointsHint')}</Text>
        <ZoneChips zones={[...PAIN_JOINT_ZONES]} selected={selected} onSelect={setSelected} />

        {selected !== null && (
          <View style={[styles.levelBox, { borderColor: colors.border }]}>
            <Text style={[styles.section, { color: colors.text }]}>
              {t('pain.howMuch', { zone: t(`pain.zones.${selected}`) })}
            </Text>
            <View style={styles.levelRow}>
              {PAIN_LEVELS.map((level) => (
                <Pressable
                  key={level}
                  onPress={() => void declare(selected, level)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`pain.levels.${level}`)}
                  style={[styles.level, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.levelLabel, { color: colors.text }]}>
                    {t(`pain.levels.${level}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {error !== null && (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Text style={[styles.section, { color: colors.text }]}>{t('pain.currentTitle')}</Text>
        {current.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('pain.empty')}</Text>
        ) : (
          current.map((r) => (
            <View key={r.id} style={[styles.row, { borderBottomColor: colors.border }]}>
              <Text style={[styles.zoneName, { color: colors.text }]}>
                {t(`pain.zones.${r.zone}`)}
              </Text>
              <Text style={[styles.levelTag, { color: colors.textMuted }]}>
                {t(`pain.levels.${r.level}`)}
              </Text>
              <Pressable
                onPress={() => void remove(r.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('pain.remove', { zone: t(`pain.zones.${r.zone}`) })}
              >
                <Text style={[styles.remove, { color: colors.accent }]}>{t('pain.removeShort')}</Text>
              </Pressable>
            </View>
          ))
        )}

        {reports.length > 0 && (
          <>
            <Text style={[styles.section, { color: colors.text }]}>{t('pain.historyTitle')}</Text>
            {reports.slice(0, 30).map((r) => (
              <View key={r.id} style={[styles.row, { borderBottomColor: colors.border }]}>
                <Text style={[styles.zoneName, { color: colors.text }]}>
                  {t(`pain.zones.${r.zone}`)}
                </Text>
                <Text style={[styles.levelTag, { color: colors.textMuted }]}>
                  {t(`pain.levels.${r.level}`)}
                </Text>
                <Text style={[styles.when, { color: colors.textMuted }]}>
                  {r.logDate === todayKey ? t('pain.today') : formatDayFull(r.logDate)}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Rangée de zones sélectionnables — le parcours accessible du schéma. */
function ZoneChips({
  zones,
  selected,
  onSelect,
}: {
  zones: PainZone[];
  selected: PainZone | null;
  onSelect: (zone: PainZone) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.chips}>
      {zones.map((zone) => {
        const on = selected === zone;
        return (
          <Pressable
            key={zone}
            onPress={() => onSelect(zone)}
            accessibilityRole="button"
            accessibilityLabel={t(`pain.zones.${zone}`)}
            accessibilityState={{ selected: on }}
            style={[
              styles.chip,
              { borderColor: on ? colors.accent : colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text
              style={[styles.chipLabel, { color: on ? colors.accent : colors.text }]}
              maxFontSizeMultiplier={1.4}
            >
              {t(`pain.zones.${zone}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10 },
  intro: { fontFamily: fontFamily.body, fontSize: 13.5, marginBottom: 4 },
  section: { fontFamily: fontFamily.bodySemi, fontSize: 14, marginTop: 12 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  levelBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10 },
  levelRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  level: { flex: 1, borderWidth: 1, borderRadius: 10, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  levelLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  zoneName: { fontFamily: fontFamily.bodySemi, fontSize: 14, flex: 1 },
  levelTag: { fontFamily: fontFamily.body, fontSize: 12.5 },
  when: { fontFamily: fontFamily.body, fontSize: 11.5, minWidth: 78, textAlign: 'right' },
  remove: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
