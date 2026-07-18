import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  localDayKey,
  type ProgramSessionType,
} from '@wellness/shared';
import {
  useUpcomingSessions,
  type PlannedSessionItem,
} from '@/data/repositories/planned-session-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Nombre de jours affichés dans le mini-calendrier d'aperçu. */
const PREVIEW_DAYS = 4;

/** Clés i18n des jours de semaine, indexées 0 = lundi … 6 = dimanche. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * Couleur de pilier « muscu » (bordeaux de la charte, fixe hors thème) — miroir de
 * `planning/index.tsx`, la palette d'app ne portant pas ce rôle.
 */
const STRENGTH_COLOR = '#6b0028';

/** Clé i18n du jour de semaine (0 = lundi) pour une `Date` locale. */
function weekdayKey(date: Date): (typeof WEEKDAY_KEYS)[number] {
  return WEEKDAY_KEYS[(date.getDay() + 6) % 7]!;
}

/**
 * Mini-calendrier d'aperçu des séances planifiées sur les 4 prochains jours
 * (aujourd'hui inclus), tous piliers. Une case par jour : abréviation + numéro,
 * pastille(s) colorée(s) par pilier (ou « repos »). Une ligne « prochaine séance »
 * résume le contenu à venir. Purement présentationnel (aucune navigation propre —
 * la carte parente est tappable).
 */
export function PlanningPreview() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { items } = useUpcomingSessions(PREVIEW_DAYS);

  const today = new Date();
  const todayKey = localDayKey(today);

  // Regroupe par date, en excluant les séances sautées.
  const byDate: Record<string, PlannedSessionItem[]> = {};
  for (const item of items) {
    if (item.status === 'skipped') continue;
    (byDate[item.scheduledDate] ??= []).push(item);
  }

  const days = Array.from({ length: PREVIEW_DAYS }, (_, i) => {
    const date = addDays(today, i);
    const key = localDayKey(date);
    return { key, date, dayItems: byDate[key] ?? [], isToday: key === todayKey };
  });

  // Prochaine séance à venir (première par date) pour la ligne de résumé.
  const next = days.flatMap((d) => d.dayItems)[0] ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {days.map((d) => (
          <View
            key={d.key}
            style={[
              styles.cell,
              {
                backgroundColor: colors.background,
                borderColor: d.isToday ? colors.accent : colors.border,
                borderWidth: d.isToday ? 2 : 1,
              },
            ]}
          >
            <Text style={[styles.dow, { color: colors.textMuted }]}>
              {t(`common.weekday.${weekdayKey(d.date)}`)}
            </Text>
            <Text style={[styles.dom, { color: colors.text }]}>{d.date.getDate()}</Text>
            {d.dayItems.length === 0 ? (
              <Text style={[styles.rest, { color: colors.textMuted }]} numberOfLines={1}>
                {t('planning.restShort')}
              </Text>
            ) : (
              <View style={styles.dots}>
                {d.dayItems.slice(0, 3).map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          item.pillar === 'running' ? colors.accent : STRENGTH_COLOR,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
      <Text style={[styles.summary, { color: colors.textMuted }]} numberOfLines={1}>
        {next
          ? t('planning.previewNext', { session: sessionLabel(next, t) })
          : t('planning.previewEmpty')}
      </Text>
    </View>
  );
}

/** Libellé court d'une séance : running = type (ou nom), muscu = nom (ou fallback). */
function sessionLabel(
  item: PlannedSessionItem,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (item.pillar === 'running') {
    const type = item.sessionType as ProgramSessionType | null;
    return type ? t(`running.sessionType.${type}`) : (item.sessionName ?? '');
  }
  return item.sessionName?.trim()
    ? item.sessionName
    : t('programs.detail.sessionFallback', { index: item.orderIndex + 1 });
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cell: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
    minHeight: 74,
  },
  dow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dom: { fontFamily: fontFamily.displaySemi, fontSize: 18 },
  rest: { fontFamily: fontFamily.body, fontSize: 10 },
  dots: { flexDirection: 'row', gap: 3, minHeight: 8, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  summary: { fontFamily: fontFamily.body, fontSize: 13 },
});
