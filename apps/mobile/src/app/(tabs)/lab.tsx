/**
 * US LABO-01 → LABO-02 — Le Labo : la maison de tous les liens entre tes piliers.
 *
 * ── Trois onglets, trois verbes (décision Q1 du 30/09/2026) ──────────────────────────────────────
 *  - **Croiser** : tous les liens entre tes piliers, à un seul endroit, rangés par état — garde-fou,
 *    à régler, ça tient, à découvrir — sur la carte des disques vue du dessus. C'est l'ancien onglet
 *    « Semaine » élargi à tout le registre (LIENS-01) : ses propositions sont devenues les gestes des
 *    liens, et la semaine réelle reste en bas.
 *  - **Composer** : doser les leviers de tous les piliers ensemble (inchangé depuis LABO-01).
 *  - **Apprendre** : quand une courbe cale, les causes dans tes données (ex-« Pourquoi ? »), les
 *    expériences et ce que le Labo sait de toi (ex-« Acquis ») — LABO-04.
 *
 * ── Ce que l'écran fait, et ne fait pas ─────────────────────────────────────────────────────────
 * Il **assemble**. Les liens viennent du registre (`@wellness/shared`, `cross-links.ts`), calculés une
 * fois par `CrossLinksProvider` pour toute l'app ; le reste vient des moteurs du Labo. Aucune règle ici.
 *
 * ⚠️ **Rien ne s'écrit sans la feuille** (LABO-01 R4) : un geste qui touche le plan se met « prêt »,
 * la feuille montre ce qui change et où, et seule sa validation écrit.
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import {
  bestLabSteps,
  composeLab,
  stepDose,
  zoneState,
  type CrossLink,
  type CrossLinkAction,
  type CrossLinkZone,
  type GoalConflict,
  type LabDoses,
  type LabExperimentKind,
  type LabLever,
  type LabProposal,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { CouncilSheet } from '@/components/dashboard/CouncilSheet';
import { actionWrites } from '@/components/lab/CrossLinkCard';
import { LabApplySheet, type LabChangeItem } from '@/components/lab/LabApplySheet';
import { LabComposerPanel } from '@/components/lab/LabComposerPanel';
import { LabCrossPanel } from '@/components/lab/LabCrossPanel';
import { LabKnownPanel } from '@/components/lab/LabKnownPanel';
import { LAB_STAGE_HEIGHT, LabStage } from '@/components/lab/LabStage';
import { LabWhyPanel } from '@/components/lab/LabWhyPanel';
import { weekdayInitial } from '@/components/lab/lab-format';
import { formatLinkValues } from '@/components/lab/link-format';
import { LINK_ROUTES, linkHref } from '@/components/lab/link-routes';
import {
  labSceneFromComposer,
  labSceneFromWeek,
  labSceneWithKnowledge,
  labSceneWithQuestion,
  labSceneWithZones,
  type ScenePillar,
  type SceneZone,
} from '@/components/lab/scene/scene-state';
import { useStageTheme } from '@/components/stage/PillarStage';
import { keepMainGoal, keepPillarGoal } from '@/data/goal-conflict-resolution';
import { useCrossLinks } from '@/data/repositories/cross-links-repository';
import { finishLabExperiment, startLabExperiment, stopLabExperiment } from '@/data/repositories/lab-experiment-repository';
import { nextMondayKey, useLabComposer, useLabObjective, useLabPillars } from '@/data/repositories/lab-repository';
import { applyAdaptationForToday, reschedulePlannedSession } from '@/data/repositories/planned-session-repository';
import { upsertNutritionProfile } from '@/data/repositories/nutrition-repository';
import { upsertRunnerProfile } from '@/data/repositories/running-profile-repository';
// US NARR-01 : le consentement IA décide de la présence du bouton « Résumer », et de rien d'autre.
import { useSettings } from '@/data/repositories/settings-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useTodayKey } from '@/hooks/useTodayKey';
import { hapticConfirm, hapticSelect } from '@/lib/haptics';
import { useLabOtherPillars } from '@/stores/lab-other-pillars-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export const LAB_TABS = ['cross', 'composer', 'learn'] as const;
type LabTab = (typeof LAB_TABS)[number];

/** `?section=` d'un lien entrant (une fiche, un écho) → l'onglet. Inconnu : Croiser. */
function resolveTab(section: string | undefined): LabTab {
  return LAB_TABS.find((tab) => tab === section) ?? 'cross';
}

const ZONES: readonly SceneZone[] = ['mc', 'mn', 'cn', 'centre'];

/** La scène fait 300 points ; l'habillage (titre, onglets) en ajoute. */
const STAGE_HEIGHT = LAB_STAGE_HEIGHT + 64;

export default function LabScreen() {
  useMenuFocus('lab');
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { colors } = useTheme();
  const stage = useStageTheme('lab');
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const todayKey = useTodayKey();
  const reducedMotion = useAppReducedMotion();
  const { settings } = useSettings();
  const lockApply = useActionLock();
  const shared = useCrossLinks();
  const activePillars = useLabPillars();
  const objective = useLabObjective();
  const { context } = useLabComposer();
  const otherHidden = useLabOtherPillars((s) => s.hidden);
  const otherHydrated = useLabOtherPillars((s) => s.hydrated);

  const [tab, setTab] = useState<LabTab>(() => resolveTab(params.section));
  const [zone, setZone] = useState<CrossLinkZone | null>(null);
  // Identifiants de **propositions** (`collision:<séance>`…), pas de liens : un lien garde le même id
  // d'une semaine à l'autre, alors qu'il peut porter une seconde collision une fois la première
  // réglée (revue du 30/09/2026 — mémorisé par lien, le second geste restait « Dans ton plan »).
  const [staged, setStaged] = useState<string[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const [draft, setDraft] = useState<LabDoses | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [focus, setFocus] = useState<ScenePillar[] | null>(null);
  const [sheet, setSheet] = useState<'links' | 'formula' | null>(null);
  const [council, setCouncil] = useState<GoalConflict | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un lien entrant (« Comprendre dans Apprendre », un écho) change d'onglet même si l'écran est monté.
  // Ajusté pendant le rendu, pas dans un effet : un `setTab` d'effet peindrait d'abord l'ancien onglet.
  const [lastSection, setLastSection] = useState(params.section);
  if (params.section !== lastSection) {
    setLastSection(params.section);
    if (params.section !== undefined) setTab(resolveTab(params.section));
  }

  useEffect(() => {
    void useLabOtherPillars.getState().hydrate();
  }, []);

  const links = shared?.links ?? [];
  const learning = shared?.learning ?? [];
  const core = shared?.core;
  const week = core?.week;
  const questions = core?.questions ?? [];
  const cards = core?.cards ?? [];
  const experiments = core?.experiments ?? [];

  const doses = draft ?? context.baseline;
  const composed = composeLab(context, doses);
  const best = bestLabSteps(context, doses);
  const question = questions.find((q) => q.id === questionId) ?? questions[0] ?? null;
  // 🔴 « En cours » se lit sur le VERDICT (`sealed`), pas sur la colonne `status` (LABO-01).
  const running = experiments.filter((e) => e.record.status === 'running' && e.verdict.status === 'sealed');
  const runningKinds = running.map((e) => e.record.kind);
  const toClose = experiments.filter((e) => e.record.status === 'running' && e.verdict.status !== 'sealed');

  // ── La scène suit l'onglet ──────────────────────────────────────────────────────────────────
  const threePillars = activePillars.length === 3;
  const zoneName = (z: CrossLinkZone) => t(`lab.cross.zone.${z === 'centre' && !threePillars ? 'centreFew' : z}`);
  const labels = {
    brand: t('lab.scene.brand'),
    plate: t('lab.scene.plate'),
    trackBig: tab === 'composer' ? String(doses.runningFrequency) : String(Math.round(week?.progress.running?.doneKm ?? 0)),
    trackSmall: tab === 'composer' ? t('lab.scene.outings') : t('lab.scene.kmOf', { total: Math.round(week?.progress.running?.plannedKm ?? 0) }),
    days: (week?.days ?? []).map((d) => weekdayInitial(d.dayKey, locale)),
  };

  const weekScene =
    week === undefined
      ? null
      : labSceneFromWeek({
          week,
          activePillars,
          objective,
          resolved: applied,
          labels,
          reducedMotion,
          selected: null,
          focus,
        });
  const zoneMedals = ZONES.flatMap((z) => {
    const state = zoneState(links, z);
    if (state === null) return [];
    const count = links.filter((l) => l.zone === z).length;
    return [{ zone: z, state, label: t('lab.cross.zoneLabel', { zone: zoneName(z), state: t(`lab.links.states.${state}`), count }) }];
  });
  const scene =
    weekScene === null
      ? null
      : tab === 'composer'
        ? labSceneFromComposer({
            doses,
            result: composed,
            activePillars,
            weeklyKm: week?.progress.running?.plannedKm ?? 0,
            labels,
            reducedMotion,
            selected: null,
          })
        : tab === 'learn'
          ? question !== null
            ? labSceneWithQuestion(weekScene, question)
            : labSceneWithKnowledge(weekScene, cards)
          : labSceneWithZones(weekScene, zoneMedals, zone);

  // ── Les gestes des liens ────────────────────────────────────────────────────────────────────
  const proposalOf = (link: CrossLink): LabProposal | null => {
    const action = link.actions[0];
    return action !== undefined && action.type === 'proposal' ? action.proposal : null;
  };
  const stagedLinks = links.filter((l) => {
    const p = proposalOf(l);
    return p !== null && staged.includes(p.id);
  });

  const onAction = (link: CrossLink, action: CrossLinkAction) => {
    if (action.type === 'council') {
      hapticSelect();
      setCouncil(action.conflict);
      return;
    }
    if (action.type === 'open') {
      hapticSelect();
      if (action.route === 'learn') setTab('learn');
      else router.push(LINK_ROUTES[action.route]);
      return;
    }
    if (!actionWrites(action)) {
      hapticSelect();
      if (action.proposal.action.type === 'open') router.push(LINK_ROUTES[action.proposal.action.target]);
      return;
    }
    hapticSelect();
    const id = action.proposal.id;
    setStaged((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const writableHere = (change: (typeof composed.changes)[number]) =>
    change.writable && !(change.lever === 'proteinGPerKg' && context.weightKg === null);

  const changeItems: LabChangeItem[] =
    sheet === 'links'
      ? stagedLinks.map((link) => {
          const p = proposalOf(link)!;
          const values = formatLinkValues(p.values, locale, t);
          return {
            id: p.id,
            pillar: p.pair[0] === 'sleep' ? p.pair[1] === 'sleep' ? 'running' : p.pair[1] : p.pair[0],
            title: t(`lab.proposals.${p.kind}.changeTitle`, values),
            detail: t(`lab.proposals.${p.kind}.changeDetail`, values),
            where: t(`lab.proposals.${p.kind}.changeWhere`),
          };
        })
      : composed.changes.filter(writableHere).map((change) => ({
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

  async function applyLinks() {
    for (const link of stagedLinks) {
      const p = proposalOf(link)!;
      if (p.action.type === 'reschedule') {
        await reschedulePlannedSession(p.action.plannedSessionId, p.action.toDayKey);
      } else if (p.action.type === 'lighten') {
        await applyAdaptationForToday(p.action.plannedSessionId, { repsReductionPct: p.action.repsReductionPct, paceSlowdownSPerKm: null });
      }
    }
    setApplied((current) => [...current, ...stagedLinks.map((l) => proposalOf(l)!.id)]);
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

  // 🔴 Un échec doit se voir (leçon CONF-06) : la feuille reste ouverte, avec le message.
  const confirmSheet = () =>
    lockApply(async () => {
      setBusy(true);
      setError(null);
      try {
        if (sheet === 'links') await applyLinks();
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
        // Clore d'abord les expériences du même modèle dont la fenêtre est passée — avec leur
        // verdict figé (LABO-04) : l'index unique de la base ne tolère qu'une ligne `running`.
        for (const done of toClose.filter((e) => e.record.kind === kind)) {
          await finishLabExperiment(done.record.id, done.verdict);
        }
        await startLabExperiment(kind, nextMondayKey(todayKey));
        hapticConfirm();
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
  const otherPillars =
    !otherHydrated || otherHidden || threePillars
      ? null
      : activePillars.length === 2 && activePillars.includes('strength') && activePillars.includes('running')
        ? t('lab.cross.otherPillarsMc')
        : t('lab.cross.otherPillarsFew');

  const header = (
    <View style={styles.stageHead}>
      <Text style={[styles.title, { color: stage.ink }]} accessibilityRole="header">
        {t('lab.title')}
      </Text>
      <Text style={[styles.caption, { color: stage.inkMuted }]}>{t(`lab.stage.${tab}`).toUpperCase()}</Text>
    </View>
  );
  const footer = (
    <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}>
      {LAB_TABS.map((key) => {
        const selected = key === tab;
        return (
          <Pressable
            key={key}
            testID={`lab-tab-${key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              hapticSelect();
              setTab(key);
              setZone(null);
              setFocus(null);
            }}
            style={[styles.tab, selected && { backgroundColor: stage.solid }]}
          >
            <Text style={[styles.tabLabel, { color: selected ? stage.onSolid : stage.ink }]} numberOfLines={1}>
              {t(`lab.tabs.${key}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      {scene !== null ? (
        <LabStage
          state={scene}
          caption={t(`lab.stage.${tab}`)}
          height={STAGE_HEIGHT}
          header={header}
          footer={footer}
          onPick={(pillar) => setFocus(pillar === null ? null : [pillar])}
          onPickZone={(picked) => {
            if (tab !== 'cross') return;
            hapticSelect();
            setZone(picked);
          }}
          onLand={() => hapticSelect()}
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.body} testID="lab-body">
        {tab === 'cross' && week !== undefined ? (
          <LabCrossPanel
            links={links}
            learning={learning}
            week={week}
            zone={zone}
            zoneLabel={zone === null ? null : zoneName(zone)}
            onClearZone={() => setZone(null)}
            staged={staged}
            applied={applied}
            onOpenLink={(link) => {
              hapticSelect();
              router.push(linkHref(link.id));
            }}
            onAction={onAction}
            onOpenLearn={() => setTab('learn')}
            otherPillars={otherPillars}
            onHideOther={() => useLabOtherPillars.getState().hide()}
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

        {tab === 'learn' ? (
          <View style={styles.learn} testID="lab-learn-panel">
            <View style={styles.learnHead}>
              <Text style={[styles.lead, { color: colors.text }]}>{t('lab.learn.lead')}</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>{t('lab.learn.sub')}</Text>
            </View>
            <LabWhyPanel
              questions={questions}
              selectedId={question?.id ?? null}
              runningExperiments={runningKinds}
              canNarrate={settings?.aiConsentAt != null}
              onSelect={(id) => {
                setQuestionId(id);
                setFocus(null);
              }}
              onStartExperiment={startExperiment}
              onOpenLink={(id) => router.push(linkHref(id, 'learn'))}
              availableLinks={links.map((l) => l.id)}
            />
            <LabKnownPanel cards={cards} experiments={experiments} todayKey={todayKey} onStop={stopExperiment} />
          </View>
        ) : null}

        {tab === 'cross' && stagedLinks.length > 0 ? (
          <Button label={t('lab.cross.apply', { count: stagedLinks.length })} onPress={() => setSheet('links')} />
        ) : null}
        {tab === 'composer' && writableChanges > 0 ? (
          <Button label={t('lab.composer.apply', { count: writableChanges })} onPress={() => setSheet('formula')} />
        ) : null}
        {tab === 'composer' && composed.changes.length > writableChanges ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>{t('lab.composer.notWritable')}</Text>
        ) : null}
        {/* Les échecs hors feuille (lancer ou arrêter une expérience) se disent ici. */}
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

      {council !== null ? (
        <CouncilSheet
          visible
          conflict={council}
          // Leçon CONF-06 (revue du 30/09/2026) : un choix qui ne s'écrit pas doit se voir.
          onKeepMainGoal={() => {
            void keepMainGoal(council).catch(() => Alert.alert(t('lab.apply.error')));
            setCouncil(null);
          }}
          onKeepPillarGoal={() => {
            void keepPillarGoal(council).catch(() => Alert.alert(t('lab.apply.error')));
            setCouncil(null);
          }}
          onClose={() => setCouncil(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: 20, paddingBottom: 40, gap: 18 },
  stageHead: { gap: 2 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -0.8 },
  caption: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.1 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, borderWidth: 1 },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
  learn: { gap: 20 },
  learnHead: { gap: 6 },
  lead: { fontFamily: fontFamily.displayBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  sub: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
