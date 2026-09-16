/**
 * US LABO-01 (roadmap 7.30) — Le Labo : la planification qui croise les piliers.
 *
 * ── Ce que l'écran fait, et ne fait pas ─────────────────────────────────────────────────────────
 * Il **assemble** : la scène en tête, quatre onglets en dessous, et les gestes qui écrivent dans le
 * plan. Aucune règle : tout vient des moteurs purs (`@wellness/shared`) via `lab-repository`.
 *
 * ── Les quatre onglets ──────────────────────────────────────────────────────────────────────────
 *  - **Semaine** : ta semaine réelle, ce que le Labo y voit, un geste par point, puis la feuille.
 *  - **Composer** : les doses de tous les piliers ensemble, et ce que ça change.
 *  - **Pourquoi ?** : quand une courbe cale, les causes classées dans tes données.
 *  - **Acquis** : ce que le Labo a appris de toi, et à quoi ça sert.
 *
 * ⚠️ **Rien ne s'écrit sans la feuille** (R4) : les gestes qui touchent le plan se mettent « prêts »,
 * la feuille montre ce qui change et où, et seule sa validation écrit.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import {
  bestLabSteps,
  composeLab,
  stepDose,
  type LabDoses,
  type LabExperimentKind,
  type LabLever,
  type LabProposal,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { LabApplySheet, type LabChangeItem } from '@/components/lab/LabApplySheet';
import { LabComposerPanel } from '@/components/lab/LabComposerPanel';
import { LabKnownPanel } from '@/components/lab/LabKnownPanel';
import { LabStage } from '@/components/lab/LabStage';
import { LabWeekPanel } from '@/components/lab/LabWeekPanel';
import { LabWhyPanel } from '@/components/lab/LabWhyPanel';
import { weekdayInitial } from '@/components/lab/lab-format';
import {
  labSceneFromComposer,
  labSceneFromWeek,
  labSceneWithKnowledge,
  labSceneWithQuestion,
  type ScenePillar,
} from '@/components/lab/scene/scene-state';
import { applyAdaptationForToday, reschedulePlannedSession } from '@/data/repositories/planned-session-repository';
import { finishLabExperiment, startLabExperiment, stopLabExperiment } from '@/data/repositories/lab-experiment-repository';
import {
  nextMondayKey,
  useLabComposer,
  useLabKnowledge,
  useLabObjective,
  useLabPillars,
  useLabQuestions,
  useLabWeek,
} from '@/data/repositories/lab-repository';
import { upsertNutritionProfile } from '@/data/repositories/nutrition-repository';
import { upsertRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useTodayKey } from '@/hooks/useTodayKey';
import { hapticConfirm, hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const TABS = ['week', 'composer', 'why', 'known'] as const;
type LabTab = (typeof TABS)[number];

/** Où mène chaque geste « ouvrir » d'une proposition. */
const ROUTES = {
  planning: '/planning',
  foodSuggestion: '/nutrition',
  nutritionProfile: '/nutrition-profile',
  nutritionStats: '/nutrition-stats',
} as const;

export default function LabScreen() {
  useMenuFocus('lab');
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();
  const reducedMotion = useAppReducedMotion();
  const lockApply = useActionLock();

  const activePillars = useLabPillars();
  const objective = useLabObjective();
  const { week } = useLabWeek();
  const { questions } = useLabQuestions();
  const { cards, experiments } = useLabKnowledge();
  const { context } = useLabComposer();

  const [tab, setTab] = useState<LabTab>('week');
  const [staged, setStaged] = useState<string[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const [draft, setDraft] = useState<LabDoses | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [focus, setFocus] = useState<ScenePillar[] | null>(null);
  const [sheet, setSheet] = useState<'week' | 'formula' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doses = draft ?? context.baseline;
  const composed = composeLab(context, doses);
  const best = bestLabSteps(context, doses);
  const question = questions.find((q) => q.id === questionId) ?? questions[0] ?? null;
  // 🔴 « En cours » se lit sur le VERDICT (`sealed`), pas sur la colonne `status` : celle-ci reste à
  // `running` jusqu'à ce que l'app clôture la ligne, et la fin des 4 semaines est calculée par date.
  // S'appuyer sur `status` seul laisserait « déjà en cours » affiché à vie sur un modèle terminé.
  const running = experiments.filter((e) => e.record.status === 'running' && e.verdict.status === 'sealed');
  const runningKinds = running.map((e) => e.record.kind);
  /** Expériences dont la fenêtre est close mais que personne n'a encore clôturées en base. */
  const toClose = experiments.filter((e) => e.record.status === 'running' && e.verdict.status !== 'sealed');

  // ── La scène suit l'onglet ──────────────────────────────────────────────────────────────────
  const labels = {
    brand: t('lab.scene.brand'),
    plate: t('lab.scene.plate'),
    trackBig:
      tab === 'composer'
        ? String(doses.runningFrequency)
        : String(Math.round(week.progress.running?.doneKm ?? 0)),
    trackSmall: tab === 'composer' ? t('lab.scene.outings') : t('lab.scene.kmOf', { total: Math.round(week.progress.running?.plannedKm ?? 0) }),
    days: week.days.map((d) => weekdayInitial(d.dayKey, i18n.language)),
  };

  const weekScene = labSceneFromWeek({
    week,
    activePillars,
    objective,
    resolved: [...staged, ...applied],
    labels,
    reducedMotion,
    selected: null,
    focus,
  });
  const scene =
    tab === 'composer'
      ? labSceneFromComposer({
          doses,
          result: composed,
          activePillars,
          weeklyKm: week.progress.running?.plannedKm ?? 0,
          labels,
          reducedMotion,
          selected: null,
        })
      : tab === 'why'
        ? labSceneWithQuestion(weekScene, question)
        : tab === 'known'
          ? labSceneWithKnowledge(weekScene, cards)
          : weekScene;

  // ── Les gestes ──────────────────────────────────────────────────────────────────────────────
  const stagedProposals = week.proposals.filter((p) => staged.includes(p.id));

  const openProposal = (proposal: LabProposal) => {
    if (proposal.action.type !== 'open') return;
    hapticSelect();
    router.push(ROUTES[proposal.action.target]);
  };

  /**
   * Un réglage n'entre dans la feuille que si l'app sait **vraiment** l'écrire.
   *
   * 🔴 La cible de protéines est stockée en grammes par jour : sans poids connu, `applyFormula` ne
   * l'écrit pas (on n'invente pas un poids). L'annoncer quand même dans « ce qui change dans ton
   * plan », recevoir la confirmation, vibrer — et n'écrire rien — détruirait exactement la confiance
   * que R4 sert à construire.
   */
  const writableHere = (change: (typeof composed.changes)[number]) =>
    change.writable && !(change.lever === 'proteinGPerKg' && context.weightKg === null);

  const changeItems: LabChangeItem[] =
    sheet === 'week'
      ? stagedProposals.map((p) => ({
          id: p.id,
          pillar: p.pair[0] === 'sleep' ? p.pair[1] : p.pair[0],
          title: t(`lab.proposals.${p.kind}.changeTitle`, p.values),
          detail: t(`lab.proposals.${p.kind}.changeDetail`, p.values),
          where: t(`lab.proposals.${p.kind}.changeWhere`),
        }))
      : composed.changes
          .filter(writableHere)
          .map((change) => ({
            id: change.lever,
            pillar: change.lever === 'runningFrequency' ? 'running' : 'nutrition',
            title: t(`lab.composer.lever.${change.lever}`),
            detail: t(`lab.composer.change.${change.lever}`, {
              // L'objectif est une clé métier (`bulk`, `cut`…) : on affiche son libellé, pas la clé.
              from: change.lever === 'objective' ? t(`nutrition.objective.options.${change.from}`) : change.from,
              to: change.lever === 'objective' ? t(`nutrition.objective.options.${change.to}`) : change.to,
            }),
            where: t(`lab.composer.changeWhere.${change.lever}`),
          }));

  async function applyWeek() {
    for (const proposal of stagedProposals) {
      if (proposal.action.type === 'reschedule') {
        await reschedulePlannedSession(proposal.action.plannedSessionId, proposal.action.toDayKey);
      } else if (proposal.action.type === 'lighten') {
        await applyAdaptationForToday(proposal.action.plannedSessionId, {
          repsReductionPct: proposal.action.repsReductionPct,
          paceSlowdownSPerKm: null,
        });
      }
    }
    setApplied((current) => [...current, ...stagedProposals.map((p) => p.id)]);
    setStaged([]);
  }

  async function applyFormula() {
    const weightKg = context.weightKg;
    for (const change of composed.changes) {
      if (change.lever === 'runningFrequency') await upsertRunnerProfile({ weeklyFrequency: Number(change.to) });
      if (change.lever === 'objective') await upsertNutritionProfile({ objective: doses.objective });
      if (change.lever === 'proteinGPerKg' && weightKg !== null) {
        await upsertNutritionProfile({ manualProteinG: Math.round(Number(change.to) * weightKg) });
      }
    }
    setDraft(null);
  }

  // 🔴 Un échec doit se voir (leçon CONF-06, la même que celle du check-in de bien-être) : sur le
  // geste le plus engageant de l'écran, une rejection avalée laisserait l'utilisateur croire son
  // plan modifié. La feuille reste alors ouverte, avec le message.
  const confirmSheet = () =>
    lockApply(async () => {
      setBusy(true);
      setError(null);
      try {
        if (sheet === 'week') await applyWeek();
        else await applyFormula();
        hapticConfirm();
        setSheet(null);
      } catch {
        setError(t('lab.apply.error'));
      } finally {
        setBusy(false);
      }
    });

  const startExperiment = (kind: LabExperimentKind) =>
    lockApply(async () => {
      try {
        // Clore d'abord les expériences du même modèle dont la fenêtre est passée : l'index unique
        // de la base ne tolère qu'une seule ligne `running` par modèle, et un rejet à l'upload
        // bloquerait la file de synchro — donc la remontée de TOUTES les tables.
        for (const done of toClose.filter((e) => e.record.kind === kind)) {
          await finishLabExperiment(done.record.id);
        }
        await startLabExperiment(kind, nextMondayKey(todayKey));
        hapticConfirm();
        setTab('known');
      } catch {
        setError(t('lab.apply.error'));
      }
    });

  const stopExperiment = (id: string) =>
    lockApply(async () => {
      try {
        await stopLabExperiment(id);
      } catch {
        setError(t('lab.apply.error'));
      }
    });

  const writableChanges = composed.changes.filter(writableHere).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <LabStage
        state={scene}
        caption={t(`lab.stage.${tab}`)}
        onPick={(pillar) => setFocus(pillar === null ? null : [pillar])}
        onLand={() => hapticSelect()}
      />

      <ScrollView contentContainerStyle={styles.body} testID="lab-body">
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.text }]}>{t('lab.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('lab.subtitle')}</Text>
        </View>

        <Segment options={TABS} value={tab} onChange={setTab} label={(option) => t(`lab.tabs.${option}`)} scrollable />

        {tab === 'week' ? (
          <LabWeekPanel
            week={week}
            staged={staged}
            applied={applied}
            onStage={(proposal) => {
              hapticSelect();
              setStaged((current) => [...current, proposal.id]);
            }}
            onUnstage={(id) => setStaged((current) => current.filter((x) => x !== id))}
            onOpen={openProposal}
          />
        ) : null}

        {tab === 'composer' ? (
          <LabComposerPanel
            doses={doses}
            result={composed}
            best={best}
            activePillars={activePillars}
            hasChanges={composed.changes.length > 0}
            onStep={(lever: LabLever, direction) => {
              const next = stepDose(doses, lever, direction);
              if (next === null) return;
              hapticSelect();
              setDraft(next);
            }}
            onReset={() => setDraft(null)}
          />
        ) : null}

        {tab === 'why' ? (
          <LabWhyPanel
            questions={questions}
            selectedId={question?.id ?? null}
            runningExperiments={runningKinds}
            onSelect={(id) => {
              setQuestionId(id);
              setFocus(null);
            }}
            onStartExperiment={startExperiment}
            onGoToWeek={() => setTab('week')}
          />
        ) : null}

        {tab === 'known' ? (
          <LabKnownPanel
            cards={cards}
            experiments={experiments}
            todayKey={todayKey}
            onStop={stopExperiment}
          />
        ) : null}

        {/* Le bouton d'application : seulement quand il y a quelque chose à appliquer. */}
        {tab === 'week' && staged.length > 0 ? (
          <Button label={t('lab.week.apply', { count: staged.length })} onPress={() => setSheet('week')} />
        ) : null}
        {tab === 'composer' && writableChanges > 0 ? (
          <Button label={t('lab.composer.apply', { count: writableChanges })} onPress={() => setSheet('formula')} />
        ) : null}
        {tab === 'composer' && composed.changes.length > writableChanges ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>{t('lab.composer.notWritable')}</Text>
        ) : null}
        {/* Les échecs hors feuille (lancer ou arrêter une expérience) se disent ici : la feuille est
            fermée, et un geste sans effet ni message se lit comme un bug. */}
        {error !== null && sheet === null ? (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <LabApplySheet
        visible={sheet !== null}
        title={t(sheet === 'formula' ? 'lab.apply.formulaTitle' : 'lab.apply.weekTitle')}
        subtitle={t(sheet === 'formula' ? 'lab.apply.formulaSubtitle' : 'lab.apply.weekSubtitle', { count: changeItems.length })}
        items={changeItems}
        confirmLabel={t('lab.apply.confirm')}
        busy={busy}
        error={error}
        onConfirm={confirmSheet}
        onClose={() => {
          setError(null);
          setSheet(null);
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: 20, paddingBottom: 40, gap: 18 },
  head: { gap: 2 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -0.8 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13 },
  note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
