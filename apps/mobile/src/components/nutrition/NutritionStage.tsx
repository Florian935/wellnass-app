/**
 * US DASH-01 — la scène du pilier Nutrition : « le remplissage » (spec §4.2).
 *
 * Remplace, en tête du journal, l'en-tête, la navigation de jour, la trame de la semaine, la carte
 * « Bilan du jour » et les trois macros : cinq blocs devenus une seule surface.
 *
 * ── Ce que la scène montre ────────────────────────────────────────────────────────────────────────
 *  - le **niveau** : consommé / cible du jour affiché, plafonné au filet de cible (jamais de
 *    débordement ; au-delà, le texte dit l'excédent) ;
 *  - les **7 verres** de la semaine du jour sélectionné — un tap change de jour, les jours futurs
 *    sont inertes ;
 *  - le **brouillard de confiance** : un jour passé sans saisie est dessiné en pointillé, et la scène
 *    nomme le plus récent — c'est la donnée qui affinerait le plus les conseils ;
 *  - l'**ajout rapide** des aliments récents (aujourd'hui seulement), la **photo** du repas et la
 *    recherche.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  dayFill,
  localDateFromDayKey,
  localDayKey,
  startOfWeek,
  weekLoggingConfidence,
} from '@wellness/shared';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { AnimatedNumber, useLocaleSeparators } from '@/components/motion/AnimatedNumber';
import { PressableScale } from '@/components/motion/PressableScale';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageButton } from '@/components/stage/StageButton';
import { StageIconButton } from '@/components/stage/StageIconButton';
import { FillLevel } from '@/components/stage/matter/FillLevel';
import { useMonthTotals } from '@/data/repositories/journal-repository';
import { useLoopActive } from '@/hooks/useLoopActive';
import { fontFamily } from '@/theme/fonts';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
/**
 * Remplissage d'un verre non sélectionné : l'onde du pilier, adoucie.
 *
 * ⚠️ Écrit ici et non lu depuis `stage.wave` : la valeur a besoin d'une **opacité**, et les teintes
 * du thème sont des hex opaques. Le lien est donc à maintenir à la main si `wave` change — d'où le
 * commentaire, plutôt qu'un `rgba` anonyme au milieu d'un style.
 */
const WEEK_FILL = 'rgba(158,209,106,0.75)'; // = #9ed16a (stage.wave) à 75 %
/** Part de la scène couverte par la jauge : le filet de cible est posé à 38 % du haut. */
const GAUGE_SPAN = 0.62;

export type QuickFood = { id: string; name: string; kcal: number; onAdd: () => void };
export type Macros = { protein: number; carbs: number; fat: number };

type Props = {
  day: string;
  todayKey: string;
  dayLabel: string;
  consumedKcal: number;
  targetKcal: number | null;
  consumedMacros: Macros;
  targetMacros: Macros | null;
  trainingBonusKcal: number;
  quickFoods: readonly QuickFood[];
  /** Ouvre « Pourquoi ? » sur la cible calorique (§6.1) — absent quand il n'y a pas de cible. */
  onExplainTarget?: () => void;
  onSelectDay: (dayKey: string) => void;
  onOpenCalendar: () => void;
  onSetTarget: () => void;
  onSearch: () => void;
  onScan: () => void;
  onStats: () => void;
  onProfile: () => void;
};

export function NutritionStage(props: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n?.language ?? 'fr';
  const stage = useStageTheme('nutrition');
  const active = useLoopActive('nutrition');
  const { groupSeparator, decimalSeparator } = useLocaleSeparators();
  const { day, todayKey, consumedKcal, targetKcal } = props;
  const isToday = day === todayKey;

  const weekDays = useMemo(() => {
    const start = startOfWeek(localDateFromDayKey(day));
    return Array.from({ length: 7 }, (_, i) => localDayKey(addDays(start, i)));
  }, [day]);

  // La confiance porte sur les 6 jours avant aujourd'hui, quelle que soit la semaine affichée.
  const confidenceFrom = useMemo(() => localDayKey(addDays(localDateFromDayKey(todayKey), -6)), [todayKey]);
  const rangeFrom = weekDays[0]! < confidenceFrom ? weekDays[0]! : confidenceFrom;
  const rangeTo = weekDays[6]! > todayKey ? weekDays[6]! : todayKey;
  const { totals } = useMonthTotals(rangeFrom, rangeTo);
  const kcalByDay = useMemo(() => new Map(totals.map((r) => [r.logDate, r.kcal])), [totals]);
  const confidence = useMemo(
    () => weekLoggingConfidence(totals.map((r) => ({ dayKey: r.logDate, kcal: r.kcal })), todayKey),
    [totals, todayKey],
  );
  const missing = new Set(confidence.missingDayKeys);

  const ratio = targetKcal && targetKcal > 0 ? consumedKcal / targetKcal : 0;

  /**
   * US NUTRI-UX02 — **le grand chiffre dit ce qu'il RESTE, plus ce qui a été mangé.**
   *
   * Le consommé était déjà lisible deux fois : par le niveau qui monte derrière le texte, et par la
   * ligne « sur 3120 kcal visées ». Le grand chiffre le répétait une troisième fois, et personne
   * n'ouvre ce journal pour savoir ce qu'il a déjà mangé — on l'ouvre pour savoir **ce qu'on peut
   * encore manger**. La preuve était dans l'app : la feuille d'ajout affichait déjà « Il te reste
   * 1163 kcal · 59 g de protéines », la meilleure phrase du pilier, visible seulement une fois la
   * feuille ouverte.
   *
   * 🔴 Le visuel et le texte se répartissent désormais le travail au lieu de se répéter : le niveau
   * montre le **consommé**, le chiffre dit le **restant**, et la sous-ligne porte le détail complet
   * (`1957 sur 3120 · +720 jour de séance`) pour que rien ne soit perdu.
   *
   * Replis : sans cible, ou sur un **jour passé** (où « il te reste » n'a aucun sens), on revient au
   * consommé et à l'ancien libellé.
   */
  const remaining = targetKcal !== null ? targetKcal - consumedKcal : null;
  const showRemaining = isToday && remaining !== null && remaining > 0;
  const heroValue = showRemaining ? remaining! : consumedKcal;

  const status = (() => {
    if (targetKcal === null) return t('stage.nutrition.noTarget');
    if (!isToday) return t('stage.nutrition.ofTarget', { kcal: targetKcal });
    if (showRemaining) return t('stage.nutrition.stillAvailable');
    return remaining! < 0 ? t('stage.nutrition.over', { kcal: -remaining! }) : t('stage.nutrition.reached');
  })();

  /**
   * La sous-ligne de détail : consommé, cible, et le bonus du jour s'il y en a un.
   *
   * 🔴 Elle ne s'affiche **que** quand le grand chiffre montre le restant. Sinon le statut dit déjà
   * « sur 3120 kcal visées » et la sous-ligne répétait « 1957 sur 3120 » deux lignes plus bas — la
   * même information deux fois, relevée en recette le 20/09.
   */
  const detail =
    targetKcal === null || !showRemaining
      ? null
      : props.trainingBonusKcal > 0
        ? t('stage.nutrition.detailWithBonus', {
            consumed: consumedKcal,
            target: targetKcal,
            bonus: props.trainingBonusKcal,
          })
        : t('stage.nutrition.detail', { consumed: consumedKcal, target: targetKcal });

  const stems: { key: keyof Macros; label: string; color: string }[] = [
    { key: 'protein', label: t('stage.nutrition.macroP'), color: '#e8f0d6' },
    { key: 'carbs', label: t('stage.nutrition.macroC'), color: '#f2d9a3' },
    { key: 'fat', label: t('stage.nutrition.macroF'), color: '#f0b79b' },
  ];

  const latestMissing = isToday ? confidence.missingDayKeys[0] : undefined;

  return (
    <PillarStage
      pillar="nutrition"
      testID="nutrition-stage"
      matter={
        <>
          <FillLevel ratio={ratio} gaugeSpan={GAUGE_SPAN} active={active} fill={stage.fill!} wave={stage.wave!} />
          <View style={[styles.filet, { top: `${(1 - GAUGE_SPAN) * 100}%` }]} />
        </>
      }
    >
      <View style={styles.topRow}>
        <View style={styles.dayNav}>
          <StageIconButton
            icon="chevron-back"
            label={t('journal.prevDay')}
            onPress={() => props.onSelectDay(shiftDay(day, -1))}
            color={stage.inkMuted}
            size={19}
          />
          {/* Le libellé du jour ouvre le calendrier — l'affordance est le chevron (R3.1 du journal). */}
          <Pressable
            onPress={props.onOpenCalendar}
            accessibilityRole="button"
            accessibilityLabel={t('journal.calendar.open')}
            hitSlop={8}
            style={styles.dayButton}
          >
            <Text style={[styles.eyebrow, { color: stage.ink }]} numberOfLines={1}>
              {isToday ? t('journal.today') : props.dayLabel}
            </Text>
            <Ionicons name="chevron-down" size={13} color={stage.inkMuted} />
          </Pressable>
          <StageIconButton
            icon="chevron-forward"
            label={t('journal.nextDay')}
            onPress={() => props.onSelectDay(shiftDay(day, 1))}
            color={stage.inkMuted}
            size={19}
          />
        </View>
        <View style={styles.icons}>
          <StageIconButton icon="barcode-outline" label={t('scan.title')} onPress={props.onScan} color={stage.ink} />
          <StageIconButton icon="stats-chart-outline" label={t('stats.title')} onPress={props.onStats} color={stage.ink} />
          <StageIconButton icon="options-outline" label={t('nutrition.title')} onPress={props.onProfile} color={stage.ink} />
        </View>
      </View>

      <View style={styles.glasses}>
        {weekDays.map((key, i) => {
          const future = key > todayKey;
          const selected = key === day;
          const fill = dayFill(kcalByDay.get(key) ?? 0, targetKcal);
          const pct = fill === 'complete' ? 100 : fill === 'partial' ? 55 : 0;
          const hazy = missing.has(key);
          return (
            <PressableScale
              key={key}
              haptic="select"
              disabled={future}
              onPress={() => props.onSelectDay(key)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: future }}
              accessibilityLabel={t(`journal.calendar.dayA11y.${future ? 'empty' : fill}`, {
                day: localDateFromDayKey(key).getDate(),
              })}
              style={styles.glassCol}
            >
              <View
                style={[
                  styles.glass,
                  {
                    borderColor: selected ? stage.ink : 'rgba(255,255,255,0.28)',
                    borderWidth: selected ? 2 : 1.5,
                    borderStyle: hazy ? 'dashed' : 'solid',
                    opacity: future ? 0.4 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.glassFill,
                    // Passe 2 — la teinte du pilier, et non plus `rgba(169,186,126,0.75)` écrit en
                    // dur : c'était l'ANCIEN accent nutrition (`#a9ba7e`), et la trame est restée
                    // olive quand toute la scène a viré au vert franc. Le seul élément qui n'avait
                    // pas suivi, parce qu'il ne lisait pas le thème.
                    { height: `${pct}%`, backgroundColor: selected ? stage.accent : WEEK_FILL },
                  ]}
                />
              </View>
              <Text style={[styles.weekday, { color: selected ? stage.ink : stage.inkMuted }]}>
                {t(`common.weekdayShort.${WEEKDAY_KEYS[i]}`)}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/*
        Passe 2 — F1 : le retour à aujourd'hui.

        L'écran peut s'ouvrir sur un autre jour (navigation, reprise d'app), et il **change alors de
        comportement** : le grand chiffre repasse au consommé, la carte de décision disparaît,
        l'ajout rapide aussi. Trois règles justes — mais rien ne les annonçait, et on se retrouvait
        devant un écran qui ne propose plus rien sans comprendre pourquoi.
      */}
      {!isToday ? (
        <Pressable
          onPress={() => props.onSelectDay(todayKey)}
          accessibilityRole="button"
          testID="back-to-today"
          style={[styles.backToday, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
        >
          <Ionicons name="arrow-back" size={14} color={stage.ink} />
          <Text style={[styles.backTodayText, { color: stage.ink }]}>
            {t('stage.nutrition.backToToday')}
          </Text>
        </Pressable>
      ) : null}

      {latestMissing ? (
        <Pressable
          onPress={() => props.onSelectDay(latestMissing)}
          accessibilityRole="button"
          style={styles.hazeLine}
        >
          <Ionicons name="ellipsis-horizontal" size={14} color={stage.inkMuted} />
          <Text style={[styles.hazeText, { color: stage.inkMuted }]} numberOfLines={2}>
            {t('stage.nutrition.missingDay', {
              day: localDateFromDayKey(latestMissing).toLocaleDateString(lang, { weekday: 'long', day: 'numeric' }),
              count: confidence.missingDayKeys.length,
            })}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.levelRow}>
        <View style={styles.levelTexts}>
          <View style={styles.bigRow}>
            <AnimatedNumber
              testID="stage-kcal"
              value={heroValue}
              groupSeparator={groupSeparator}
              decimalSeparator={decimalSeparator}
              style={[styles.big, { color: stage.ink }]}
              accessibilityLabel={
                showRemaining
                  ? t('stage.nutrition.remainingA11y', { kcal: heroValue })
                  : t('stage.nutrition.consumedA11y', { kcal: heroValue })
              }
            />
            <Text style={[styles.unit, { color: stage.inkMuted }]}>{t('nutrition.kcal')}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.status, { color: stage.ink }]}>{status}</Text>
            {targetKcal !== null && props.onExplainTarget ? (
              <ExplainButton
                onPress={props.onExplainTarget}
                color={stage.inkMuted}
                subject={t('journal.balance.target')}
              />
            ) : null}
          </View>
          {/* Le détail chiffré remplace la pastille « +720 kcal » : elle isolait le bonus d'un
              calcul qu'elle ne montrait pas, alors qu'il n'a de sens qu'à côté de la cible. */}
          {detail ? (
            <Text style={[styles.detail, { color: stage.inkMuted }]} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
          {targetKcal === null ? (
            <Pressable onPress={props.onSetTarget} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.link, { color: stage.accent }]}>{t('journal.setTarget')}</Text>
            </Pressable>
          ) : null}
        </View>
        {props.targetMacros ? (
          <View style={styles.stems}>
            {stems.map((m) => {
              const goal = props.targetMacros![m.key];
              const value = Math.round(props.consumedMacros[m.key]);
              const pct = goal > 0 ? Math.min(1, props.consumedMacros[m.key] / goal) : 0;
              return (
                <View
                  key={m.key}
                  accessible
                  accessibilityLabel={t('stage.nutrition.macroA11y', {
                    macro: t(`nutrition.macros.${m.key}`),
                    value,
                    goal: Math.round(goal),
                  })}
                  style={styles.stemCol}
                >
                  <View style={styles.stemTrack}>
                    <View style={[styles.stemFill, { height: `${pct * 100}%`, backgroundColor: m.color }]} />
                  </View>
                  {/*
                    US NUTRI-UX02 — les grammes, enfin lisibles.

                    Les trois tiges ne portaient **aucun chiffre** : elles disaient « à peu près aux
                    deux tiers » sans jamais dire de quoi. L'information existait déjà — elle était
                    dans le libellé d'accessibilité juste au-dessus, donc lue par TalkBack et par
                    personne d'autre. Le gramme consommé est la donnée qu'on vient chercher : c'est
                    lui qu'on compare à ce qu'on s'apprête à manger.
                  */}
                  {/*
                    Passe 2 — le gramme porte sa CIBLE. « 106g » seul ne dit pas si c'est bien :
                    la tige montre le ratio, le chiffre montrait la quantité, et il manquait le
                    repère qui relie les deux. La cible est connue — c'est elle qui dessine la
                    hauteur de la tige — et elle restait non écrite.
                  */}
                  <Text style={[styles.stemValue, { color: stage.ink }]}>
                    {t('stage.nutrition.macroGrams', { value, goal: Math.round(goal) })}
                  </Text>
                  <Text style={[styles.stemLabel, { color: stage.inkMuted }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {isToday && props.quickFoods.length > 0 ? (
        <View style={styles.quickRow}>
          {props.quickFoods.slice(0, 3).map((food) => (
            <PressableScale
              key={food.id}
              haptic="confirm"
              onPress={food.onAdd}
              accessibilityRole="button"
              accessibilityLabel={t('stage.nutrition.quickAddA11y', { name: food.name, kcal: food.kcal })}
              style={[styles.quick, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
            >
              <Ionicons name="add" size={14} color={stage.ink} />
              <Text style={[styles.quickName, { color: stage.ink }]} numberOfLines={1}>
                {food.name}
              </Text>
              <Text style={[styles.quickKcal, { color: stage.inkMuted }]}>{food.kcal}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      <View style={styles.ctaRow}>
        <StageButton
          pillar="nutrition"
          icon="search"
          label={t('stage.nutrition.search')}
          onPress={props.onSearch}
          style={styles.flex}
        />
      </View>
    </PillarStage>
  );
}

/** Décale une clé de jour de `n` jours, sur les composants de date (« 2026-08-00 » n'existe pas). */
function shiftDay(dayKey: string, n: number): string {
  return localDayKey(addDays(localDateFromDayKey(dayKey), n));
}

const styles = StyleSheet.create({
  filet: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(232,240,214,0.45)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  dayNav: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  dayButton: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minHeight: 44, paddingHorizontal: 2 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', flexShrink: 1 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  glasses: { flexDirection: 'row', gap: 8 },
  glassCol: { flex: 1, alignItems: 'center', gap: 5 },
  /**
   * US NUTRI-UX02 — **les quatre coins sont arrondis pareil**.
   *
   * L'idée d'origine était un verre : coins presque droits en haut (3), arrondis en bas (9), pour
   * que le remplissage se lise comme un liquide. À l'écran, à 40 px de haut et sept exemplaires
   * côte à côte, ce n'est pas ce qu'on voit — on voit des carrés **coupés net en haut**, comme si
   * la trame débordait de la scène. Florian l'a signalé deux fois, en deux passes distinctes, en
   * employant le mot « tronqué » : c'est le signe qu'une intention de design n'est pas arrivée, et
   * qu'elle coûte plus qu'elle ne rapporte.
   */
  glass: {
    width: '100%',
    height: 40,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  glassFill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  weekday: { fontFamily: fontFamily.mono, fontSize: 10 },
  hazeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  hazeText: { fontFamily: fontFamily.bodyMedium, fontSize: 12.5, flexShrink: 1 },
  levelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 28 },
  levelTexts: { flex: 1, gap: 6 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: fontFamily.displayXBold, fontSize: 60, letterSpacing: -2.6, lineHeight: 64 },
  unit: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  status: { fontFamily: fontFamily.displayBold, fontSize: 17, letterSpacing: -0.4 },
  // US NUTRI-UX02 — la sous-ligne de détail : consommé, cible, bonus du jour.
  detail: { fontFamily: fontFamily.mono, fontSize: 11, marginTop: 3 },
  // Passe 2 — le retour à aujourd'hui, visible dès qu'on consulte un autre jour.
  backToday: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  backTodayText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  link: { fontFamily: fontFamily.bodyBold, fontSize: 14, textDecorationLine: 'underline' },
  chip: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: 11.5 },
  stems: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  stemCol: { alignItems: 'center', gap: 4 },
  stemTrack: { width: 14, height: 84, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  stemFill: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 7 },
  // US NUTRI-UX02 — les grammes consommés, sous chaque tige.
  stemValue: { fontFamily: fontFamily.monoBold, fontSize: 10 },
  stemLabel: { fontFamily: fontFamily.mono, fontSize: 10 },
  quickRow: { flexDirection: 'row', gap: 7 },
  quick: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  quickName: { fontFamily: fontFamily.bodyBold, fontSize: 12.5, flexShrink: 1 },
  quickKcal: { fontFamily: fontFamily.mono, fontSize: 10 },
  ctaRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
