/**
 * US CYCLE-01 — calendrier mensuel du suivi de cycle.
 *
 * C'était la seule pièce de la spec (§1 « Calendrier + historique ») qui manquait au code livré la
 * nuit du 30 au 31/07 : le widget `large` promettait déjà « les 7 derniers jours » dans son
 * commentaire sans les rendre, et l'écran de détail n'avait qu'une liste — pas de vue calendaire.
 *
 * ⚠️ **Pas de librairie de calendrier** (patron du plan, étape 4c) : le calcul de grille est le même
 * genre de math que `PlanningPreview` (semaines de 7 jours à partir de `startOfWeek`/`addDays`), mais
 * écrit ici spécifiquement — les données à colorer (flux par jour, appartenance à une période) n'ont
 * rien à voir avec les séances planifiées, réutiliser le composant aurait forcé une généralisation
 * inutile pour un seul appelant.
 *
 * ⚠️ **Aucune phrase construite ici** : seuls des libellés i18n et le mois/année via
 * `Intl.DateTimeFormat` (pas de dictionnaire de noms de mois à maintenir en double de l'OS).
 *
 * ⚠️ **Le futur reste refusé** (R4) : un jour postérieur à aujourd'hui est affiché mais **non
 * appuyable** — cohérent avec `assertNotFuture` côté repository, qui lèverait de toute façon.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addDays, localDayKey, startOfWeek, type MenstrualFlow, type MenstrualPeriod } from '@wellness/shared';

import { getAppLanguage } from '@/i18n';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Opacité du fond par intensité de flux — plus foncé = plus abondant. Purement visuel, pas une donnée. */
const FLOW_OPACITY: Record<MenstrualFlow, number> = {
  spotting: 0.22,
  light: 0.4,
  medium: 0.65,
  heavy: 0.9,
};

/** Un jour marqué « dans une période » sans flux saisi ce jour précis (ex. saisie du début seule). */
const PERIOD_ONLY_OPACITY = 0.12;

type DayCell = {
  key: string;
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  flow: MenstrualFlow | null;
  inPeriod: boolean;
};

/** Vrai si `dateKey` tombe dans l'intervalle d'une période (ouverte = jusqu'à `todayKey` inclus). */
function isWithinAnyPeriod(dateKey: string, periods: MenstrualPeriod[], todayKey: string): boolean {
  return periods.some((p) => {
    if (dateKey < p.startedOn) return false;
    const end = p.endedOn ?? todayKey;
    return dateKey <= end;
  });
}

function buildMonthGrid(
  monthAnchor: Date,
  periods: MenstrualPeriod[],
  logsByDate: Map<string, MenstrualFlow | null>,
  todayKey: string,
): DayCell[][] {
  const month = monthAnchor.getMonth();
  const firstOfMonth = new Date(monthAnchor.getFullYear(), month, 1);
  const lastOfMonth = new Date(monthAnchor.getFullYear(), month + 1, 0);
  const gridStart = startOfWeek(firstOfMonth);
  const gridEnd = addDays(startOfWeek(lastOfMonth), 6);

  const days: DayCell[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    const key = localDayKey(d);
    days.push({
      key,
      date: d,
      inMonth: d.getMonth() === month,
      isToday: key === todayKey,
      isFuture: key > todayKey,
      flow: logsByDate.get(key) ?? null,
      inPeriod: isWithinAnyPeriod(key, periods, todayKey),
    });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function CycleMonthCalendar({
  periods,
  logs,
  todayKey,
  onSelectDay,
}: {
  periods: MenstrualPeriod[];
  logs: { logDate: string; flow: MenstrualFlow | null }[];
  todayKey: string;
  onSelectDay: (dateKey: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Ancre du mois affiché — Date construite depuis todayKey pour rester DST-safe (pas de new Date()
  // au rendu : todayKey est déjà réactif via useTodayKey côté appelant).
  const [anchor, setAnchor] = useState(() => {
    const [y, m] = todayKey.split('-').map(Number);
    return new Date(y!, m! - 1, 1);
  });

  const logsByDate = useMemo(() => {
    const map = new Map<string, MenstrualFlow | null>();
    for (const l of logs) if (!map.has(l.logDate)) map.set(l.logDate, l.flow);
    return map;
  }, [logs]);

  const weeks = useMemo(
    () => buildMonthGrid(anchor, periods, logsByDate, todayKey),
    [anchor, periods, logsByDate, todayKey],
  );

  const isCurrentMonthOrLater = (() => {
    const [ty, tm] = todayKey.split('-').map(Number);
    return anchor.getFullYear() > ty! || (anchor.getFullYear() === ty! && anchor.getMonth() >= tm! - 1);
  })();

  const monthLabel = new Intl.DateTimeFormat(getAppLanguage(), { month: 'long', year: 'numeric' }).format(
    anchor,
  );

  const goPrevMonth = () => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1));
  const goNextMonth = () => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1));

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <Pressable
          onPress={goPrevMonth}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('cycle.calendar.prevMonth')}
          style={styles.navBtn}
        >
          <Text style={[styles.navArrow, { color: colors.accent }]}>‹</Text>
        </Pressable>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
        <Pressable
          onPress={goNextMonth}
          hitSlop={12}
          disabled={isCurrentMonthOrLater}
          accessibilityRole="button"
          accessibilityLabel={t('cycle.calendar.nextMonth')}
          style={styles.navBtn}
        >
          <Text
            style={[
              styles.navArrow,
              { color: isCurrentMonthOrLater ? colors.border : colors.accent },
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_KEYS.map((k) => (
          <Text key={k} style={[styles.weekdayLabel, { color: colors.textMuted }]}>
            {t(`common.weekday.${k}`).charAt(0).toUpperCase()}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((day) => {
            const bg = day.flow
              ? withOpacity(colors.accent, FLOW_OPACITY[day.flow])
              : day.inPeriod
                ? withOpacity(colors.accent, PERIOD_ONLY_OPACITY)
                : 'transparent';
            return (
              <Pressable
                key={day.key}
                disabled={day.isFuture}
                onPress={() => onSelectDay(day.key)}
                accessibilityRole="button"
                accessibilityLabel={t('cycle.calendar.dayA11y', { date: day.date.getDate() })}
                accessibilityState={{ disabled: day.isFuture }}
                style={[
                  styles.day,
                  { backgroundColor: bg },
                  day.isToday && { borderColor: colors.accent, borderWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    {
                      color: day.isFuture
                        ? colors.border
                        : day.inMonth
                          ? colors.text
                          : colors.textMuted,
                    },
                  ]}
                >
                  {day.date.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Applique une opacité à une couleur hex `#rrggbb` — pas de dépendance à une lib de couleur. */
function withOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${alpha}`;
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  navArrow: { fontFamily: fontFamily.displayBold, fontSize: 22 },
  monthLabel: { fontFamily: fontFamily.displaySemi, fontSize: 15, textTransform: 'capitalize' },
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  week: { flexDirection: 'row', gap: 2 },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  dayText: { fontFamily: fontFamily.body, fontSize: 13 },
});
