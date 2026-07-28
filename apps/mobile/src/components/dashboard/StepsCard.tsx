/**
 * Widget PAS-01 — pas quotidiens, décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : anneau de progression + total ;
 *  - `wide`  : total + objectif + barre de progression + bande des 7 derniers jours ;
 *  - `large` : idem + mini-histogramme de la semaine.
 *
 * Widget **transverse** (`pillars: 'always'` au registre) : la marche n'appartient à aucun des trois
 * piliers, et un utilisateur « nutrition seule » a autant de raisons de la suivre que les autres.
 *
 * Aucun état muet : les cinq situations de la spec §2.4 (indisponible / opt-in OFF / permission
 * manquante / aucune donnée / nominal) ont chacune leur texte et, quand il y a lieu, leur action.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { localDayKey, type WidgetSize } from '@wellness/shared';

import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { MiniBars, RingGauge } from '@/components/widgets/primitives';
import { useDailySteps, useTodaySteps } from '@/data/repositories/daily-steps-repository';
import { useHealthConnectState } from '@/hooks/useHealthConnectState';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Sépare les milliers selon la **langue courante** : « 6 240 » en français, « 6,240 » en anglais.
 * Formater en `fr-FR` quelle que soit la langue afficherait un séparateur faux à un anglophone.
 */
function formatSteps(value: number, language: string): string {
  return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'fr-FR').format(value);
}

/** Les 7 derniers jours (aujourd'hui inclus), du plus ancien au plus récent. */
function lastSevenKeys(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return localDayKey(d);
  });
}

export function StepsCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { state } = useHealthConnectState();
  const { steps, goal, reached, isLoading } = useTodaySteps();
  const { rows } = useDailySteps(lastSevenKeys()[0]);

  // Pas encore résolu, ou plateforme sans Health Connect → on ne rend rien (pas de widget fantôme).
  if (state === null || state === 'unsupported') return null;

  const open = () => router.push('/steps');

  // ── États non nominaux : un texte, une action ───────────────────────────────
  if (state === 'provider_missing' || state === 'provider_update_required') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('steps.title')}>
        <Eyebrow>{t('steps.title')}</Eyebrow>
        <Text style={[styles.cta, { color: colors.textMuted }]}>{t('steps.unsupported')}</Text>
      </WidgetFrame>
    );
  }

  if (state === 'off' || state === 'permissions_missing') {
    return (
      <WidgetFrame
        pad={16}
        onPress={() => router.push('/settings')}
        accessibilityLabel={t('steps.title')}
        accessibilityHint={t(state === 'off' ? 'steps.enableCta' : 'steps.permissionCta')}
      >
        <Eyebrow>{t('steps.title')}</Eyebrow>
        <Text style={[styles.cta, { color: colors.text }]}>
          {t(state === 'off' ? 'steps.enableCta' : 'steps.permissionCta')}
        </Text>
      </WidgetFrame>
    );
  }

  if (isLoading) return null;

  const hasData = rows.length > 0 || steps > 0;
  if (!hasData) {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('steps.title')}>
        <Eyebrow>{t('steps.title')}</Eyebrow>
        <Text style={[styles.cta, { color: colors.textMuted }]}>{t('steps.empty')}</Text>
      </WidgetFrame>
    );
  }

  const pct = Math.min(1, steps / goal);
  const color = reached ? colors.success : colors.accent;
  // Progression annoncée en **texte** : ni l'anneau ni la barre ne doivent porter seuls
  // l'information (accessibilité — la couleur et le remplissage ne suffisent pas).
  const a11y = t('steps.a11yProgress', {
    steps: formatSteps(steps, i18n.language),
    goal: formatSteps(goal, i18n.language),
    status: t(reached ? 'steps.goalReached' : 'steps.goalNotReached'),
  });

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={a11y}>
        <Eyebrow>{t('steps.title')}</Eyebrow>
        <View style={styles.smallRow}>
          <RingGauge size={62} stroke={7} pct={pct} color={color}>
            <Text style={[styles.ringPct, { color }]}>{Math.round(pct * 100)}%</Text>
          </RingGauge>
          <View style={styles.grow}>
            <Text style={[styles.num, { color: colors.text }]}>{formatSteps(steps, i18n.language)}</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>/ {formatSteps(goal, i18n.language)}</Text>
          </View>
        </View>
      </WidgetFrame>
    );
  }

  const byDay = new Map(rows.map((r) => [r.logDate, r.steps]));
  const week = lastSevenKeys().map((k) => byDay.get(k) ?? 0);
  const labels = t('home.streak.days', { returnObjects: true }) as string[];

  const bar = (
    <View style={[styles.barTrack, { backgroundColor: colors.track }]}>
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );

  const head = (
    <>
      <View style={styles.head}>
        <Eyebrow>{t('steps.title')}</Eyebrow>
        <Text style={[styles.goal, { color: colors.textMuted }]}>
          {t('steps.goal')} {formatSteps(goal, i18n.language)}
        </Text>
      </View>
      <View style={styles.numRow}>
        <Text style={[styles.num, { color: colors.text }]}>{formatSteps(steps, i18n.language)}</Text>
        <Text style={[styles.pct, { color }]}>{Math.round(pct * 100)}%</Text>
      </View>
      {bar}
    </>
  );

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} style={styles.col} onPress={open} accessibilityLabel={a11y}>
        {head}
        <MiniBars
          values={week}
          height={30}
          color={color}
          highlightIndex={week.map((v, i) => (v >= goal ? i : -1)).filter((i) => i >= 0)}
          labels={labels}
        />
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={22} style={styles.col} onPress={open} accessibilityLabel={a11y}>
      {head}
      <MiniBars
        values={week}
        height={78}
        color={color}
        highlightIndex={week.map((v, i) => (v >= goal ? i : -1)).filter((i) => i >= 0)}
        labels={labels}
      />
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  col: { gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  smallRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  numRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  num: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -1 },
  pct: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  sub: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  goal: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
  ringPct: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  cta: { fontFamily: fontFamily.bodySemi, fontSize: 14, marginTop: 8, lineHeight: 19 },
  barTrack: { height: 9, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
});
