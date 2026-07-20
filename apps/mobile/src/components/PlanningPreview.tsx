import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  localDayKey,
  type ProgramSessionType,
  type WidgetSize,
} from '@wellness/shared';
import {
  useUpcomingSessions,
  type PlannedSessionItem,
} from '@/data/repositories/planned-session-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Le mini-calendrier couvre les 7 prochains jours (aujourd'hui inclus). */
const PREVIEW_DAYS = 7;

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

type DayCell = {
  key: string;
  date: Date;
  dayItems: PlannedSessionItem[];
  isToday: boolean;
};

/**
 * Mini-calendrier d'aperçu des séances planifiées sur les **7 prochains jours**
 * (aujourd'hui inclus), tous piliers. Visuel type calendrier : une colonne par jour
 * (initiale + numéro), pastille(s) colorée(s) par pilier, aujourd'hui mis en avant.
 * Purement présentationnel (aucune navigation propre — la carte parente est tappable).
 *
 * S'adapte à la forme du widget :
 *  - `small` : bande semaine condensée (7 initiales + pastilles) + prochaine séance ;
 *  - `wide`  : grille 7 colonnes (initiale + numéro + pastilles), 1 semaine ;
 *  - `large` : **2 semaines** (2 rangées de 7 jours) + liste des prochaines séances.
 */
export function PlanningPreview({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Grand carré = 2 semaines (14 jours) ; sinon 1 semaine (7 jours).
  const dayCount = size === 'large' ? 2 * PREVIEW_DAYS : PREVIEW_DAYS;
  const { items } = useUpcomingSessions(dayCount);

  const today = new Date();
  const todayKey = localDayKey(today);

  // Regroupe par date, en excluant les séances sautées.
  const byDate: Record<string, PlannedSessionItem[]> = {};
  for (const item of items) {
    if (item.status === 'skipped') continue;
    (byDate[item.scheduledDate] ??= []).push(item);
  }

  const days: DayCell[] = Array.from({ length: dayCount }, (_, i) => {
    const date = addDays(today, i);
    const key = localDayKey(date);
    return { key, date, dayItems: byDate[key] ?? [], isToday: key === todayKey };
  });

  // Découpe en semaines de 7 jours (1 rangée par semaine) pour la grille calendrier.
  const weeks: DayCell[][] = [];
  for (let i = 0; i < days.length; i += PREVIEW_DAYS) weeks.push(days.slice(i, i + PREVIEW_DAYS));

  const upcoming = days.flatMap((d) => d.dayItems);
  const next = upcoming[0] ?? null;

  const pillarColor = (item: PlannedSessionItem) =>
    item.pillar === 'running' ? colors.accent : STRENGTH_COLOR;

  const dayInitial = (date: Date) =>
    t(`common.weekday.${weekdayKey(date)}`).charAt(0).toUpperCase();

  // ── Forme small : bande semaine condensée + prochaine séance ────────────────
  if (size === 'small') {
    return (
      <View style={styles.smallContainer}>
        <View style={styles.strip}>
          {days.map((d) => (
            <View key={d.key} style={styles.stripCol}>
              <Text
                style={[
                  styles.stripDow,
                  { color: d.isToday ? colors.accent : colors.textMuted },
                ]}
              >
                {dayInitial(d.date)}
              </Text>
              <View
                style={[
                  styles.stripDot,
                  {
                    backgroundColor: d.dayItems[0]
                      ? pillarColor(d.dayItems[0])
                      : colors.border,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <Text style={[styles.summary, { color: colors.textMuted }]} numberOfLines={2}>
          {next
            ? t('planning.previewNext', { session: sessionLabel(next, t) })
            : t('planning.previewEmpty')}
        </Text>
      </View>
    );
  }

  // ── Formes wide / large : grille calendrier 7 colonnes (1 rangée par semaine) ──
  return (
    <View style={styles.container}>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((d) => (
            <View
              key={d.key}
              style={[
                styles.cell,
                {
                  backgroundColor: d.isToday ? colors.surfaceAlt : colors.background,
                  borderColor: d.isToday ? colors.accent : colors.border,
                  borderWidth: d.isToday ? 2 : 1,
                },
              ]}
            >
              <Text style={[styles.dow, { color: colors.textMuted }]}>
                {dayInitial(d.date)}
              </Text>
              <Text style={[styles.dom, { color: colors.text }]}>{d.date.getDate()}</Text>
              <View style={styles.dots}>
                {d.dayItems.slice(0, 3).map((item) => (
                  <View
                    key={item.id}
                    style={[styles.dot, { backgroundColor: pillarColor(item) }]}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}

      {size === 'large' ? (
        <View style={styles.largeList}>
          {upcoming.length > 0 ? (
            upcoming.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.largeRow}>
                <View style={[styles.largeDot, { backgroundColor: pillarColor(item) }]} />
                <Text style={[styles.largeDay, { color: colors.textMuted }]}>
                  {t(`common.weekday.${weekdayKey(new Date(item.scheduledDate))}`)}
                </Text>
                <Text
                  style={[styles.largeName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {sessionLabel(item, t)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.summary, { color: colors.textMuted }]} numberOfLines={1}>
              {t('planning.previewEmpty')}
            </Text>
          )}
        </View>
      ) : (
        <Text style={[styles.summary, { color: colors.textMuted }]} numberOfLines={1}>
          {next
            ? t('planning.previewNext', { session: sessionLabel(next, t) })
            : t('planning.previewEmpty')}
        </Text>
      )}
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
  row: { flexDirection: 'row', gap: 4 },
  cell: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 3,
    minHeight: 62,
  },
  dow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  dom: { fontFamily: fontFamily.displaySemi, fontSize: 15 },
  dots: { flexDirection: 'row', gap: 2, minHeight: 6, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  summary: { fontFamily: fontFamily.body, fontSize: 13 },

  // Forme small : bande semaine.
  smallContainer: { flex: 1, gap: 8, justifyContent: 'flex-end' },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  stripCol: { alignItems: 'center', gap: 4 },
  stripDow: { fontFamily: fontFamily.bodySemi, fontSize: 10 },
  stripDot: { width: 6, height: 6, borderRadius: 3 },

  // Forme large : liste des prochaines séances.
  largeList: { gap: 6 },
  largeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  largeDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  largeDay: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    width: 34,
  },
  largeName: { fontFamily: fontFamily.body, fontSize: 13, flex: 1 },
});
