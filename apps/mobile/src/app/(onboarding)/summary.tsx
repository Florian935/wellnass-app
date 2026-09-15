/**
 * Onboarding — le récapitulatif (US GUID-01, volet A §3.3).
 *
 * ── Le trou que cet écran referme ────────────────────────────────────────────────────────────────
 * La roadmap **1.11** promet « Résumé des choix + **suggestion d'une première action** ». La
 * cartographie d'ACTIV-01 a constaté le 03/08/2026 que la seconde moitié n'existait pas : l'écran
 * affichait un récapitulatif statique et un bouton générique « Terminer ». Le parcours « 7 jours »
 * a nommé ce manque sans le combler (son jour 1 arrive le lendemain, pas maintenant).
 *
 * Avec l'objectif ET le régime de guidage, on sait enfin quoi proposer — et à qui.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  effectiveGlobalRegime,
  hasChosenRegime,
  rankSuggestedPrograms,
  resolveActivePillars,
  type Pillar,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { completeOnboarding, useProfile } from '@/data/repositories/profile-repository';
import {
  activateProgram,
  duplicateProgram,
  useProgramLibrary,
} from '@/data/repositories/program-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Ordre de priorité de la première action. Repris de CLAUDE.md (ordre de build muscu > course >
 * nutrition) et déjà réutilisé par ACTIV-01 — pour sa seule vertu : être une décision **déjà
 * actée**, et non une préférence produit inventée pour l'occasion.
 */
const FIRST_ACTION_ORDER: readonly Pillar[] = ['strength', 'running', 'nutrition'];

/** Où mène la première action de chaque pilier. */
const FIRST_ACTION_ROUTE: Record<Pillar, string> = {
  strength: '/(tabs)/strength',
  running: '/(tabs)/running',
  nutrition: '/(tabs)/nutrition',
};

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
        {note ? <Text style={[styles.rowNote, { color: colors.textMuted }]}>{note}</Text> : null}
      </View>
    </View>
  );
}

export default function OnboardingSummary() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useProfile();
  const { settings } = useSettings();
  // Tant que les réglages ne sont pas chargés, on suppose tous les piliers actifs.
  const activePillars = resolveActivePillars(settings?.activePillars);

  const guidanceSource = {
    regime: profile?.guidanceRegime ?? null,
    strength: profile?.guidanceStrength ?? null,
    cardio: profile?.guidanceCardio ?? null,
    nutrition: profile?.guidanceNutrition ?? null,
  };
  const regime = effectiveGlobalRegime(guidanceSource);
  // Appliqué ≠ choisi (spec §2.1) : un repli s'affiche COMME un repli. Sans cette distinction, le
  // récapitulatif présenterait « Accompagné » comme une décision de l'utilisateur alors que
  // personne n'a répondu — exactement le bug des ~614 kcal du niveau d'activité.
  const regimeChosen = hasChosenRegime(guidanceSource, 'strength');

  const firstActionPillar = FIRST_ACTION_ORDER.find((p) => activePillars.includes(p)) ?? null;

  /**
   * Le régime `guided` ne se contente pas de montrer la porte : il pose le programme.
   *
   * ⚠️ Un programme **éditorial** ne peut pas être activé directement — `activateProgram` est
   * owner-scopé, et `owner_id IS NULL` est rejeté par la RLS au moment de la synchro (piège
   * documenté dans le repository). On **duplique** d'abord, on active la copie.
   *
   * Réversible : le programme reste changeable depuis le hub, et rien n'est supprimé.
   */
  const { programs, isLoading: libraryLoading } = useProgramLibrary({ pillar: 'strength' });
  const [posting, setPosting] = useState(false);
  /**
   * ⚠️ On teste le **régime** et non `dispositionFor('programSuggestion', …)`, et c'est volontaire :
   * la disposition vaut `propose` dans les deux régimes — l'utilisateur tape un bouton dans les
   * deux cas. Ce qui change ici n'est pas *qui décide* mais **ce qui est proposé** : un programme
   * déjà choisi, ou une liste à trier. Ce n'est donc pas une question de disposition.
   */
  const autoPost = regime === 'guided' && firstActionPillar === 'strength';
  const candidate = autoPost
    ? (rankSuggestedPrograms(programs, {
        trainingLevel: profile?.trainingLevel,
        displayLevel: profile?.workoutDisplayLevel,
        weeklyAvailability: profile?.weeklyAvailability,
      })[0] ?? null)
    : null;

  const postProgram = async () => {
    if (!candidate) return startFirstAction();
    setPosting(true);
    try {
      const copyId = await duplicateProgram(candidate.id);
      await activateProgram(copyId);
    } catch (error) {
      // Le programme n'a pas pu être posé : on n'invente pas un succès, on ouvre simplement le
      // pilier — l'utilisateur choisira lui-même, ce qui reste un parcours valide.
      // ⚠️ Tracé : `duplicateProgram` et `activateProgram` ne sont pas atomiques entre eux, et un
      // échec du second laisserait une copie inactive dans « Mes programmes » sans rien dire.
      console.warn('[GUID-01] pose du programme échouée :', error);
    }
    setPosting(false);
    await startFirstAction();
  };

  const finish = async () => {
    void track(ANALYTICS_EVENTS.onboardingCompleted);
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  const startFirstAction = async () => {
    if (!firstActionPillar) return finish();
    void track(ANALYTICS_EVENTS.onboardingCompleted);
    await completeOnboarding();
    router.replace(FIRST_ACTION_ROUTE[firstActionPillar]);
  };

  const pillarsLabel =
    activePillars.length > 0
      ? activePillars.map((p) => t(`pillars.${p}`)).join(' · ')
      : t('onboarding.summary.none');

  return (
    <FormScreen>
      <ScreenHeader
        title={
          profile?.firstName
            ? t('onboarding.summary.titleNamed', { name: profile.firstName })
            : t('onboarding.summary.title')
        }
        subtitle={t('onboarding.summary.subtitle')}
      />
      <Card>
        <Row label={t('onboarding.summary.pillars')} value={pillarsLabel} />
        <Row
          label={t('onboarding.goal.title')}
          value={
            profile?.mainGoal
              ? t(`onboarding.goal.options.${profile.mainGoal}`)
              : t('onboarding.summary.none')
          }
        />
        <Row
          label={t('guidance.sectionTitle')}
          value={t(`guidance.regimes.${regime}.label`)}
          note={regimeChosen ? undefined : t('guidance.derivedFromGoal')}
        />
      </Card>

      {firstActionPillar ? (
        <View style={[styles.panel, { backgroundColor: colors.panel }]}>
          <Text style={[styles.panelEyebrow, { color: colors.panelAccent }]}>
            {t('onboarding.summary.firstActionEyebrow')}
          </Text>
          <Text style={[styles.panelTitle, { color: colors.panelText }]}>
            {candidate
              ? t('onboarding.summary.firstAction.strength.guidedTitle', { name: candidate.name })
              : t(`onboarding.summary.firstAction.${firstActionPillar}.title`)}
          </Text>
          <Text style={[styles.panelBody, { color: colors.panelMuted }]}>
            {candidate
              ? t('onboarding.summary.firstAction.strength.guidedBody')
              : t(`onboarding.summary.firstAction.${firstActionPillar}.body`)}
          </Text>
          <View style={styles.panelCta}>
            <Button
              label={
                candidate
                  ? t('onboarding.summary.firstAction.strength.guidedCta')
                  : t(`onboarding.summary.firstAction.${firstActionPillar}.cta`)
              }
              // La bibliothèque éditoriale vient de la synchro : sur une première installation
              // elle peut n'être pas encore répliquée. Sans cette attente, le régime guidé
              // dégraderait en silence vers le parcours générique.
              loading={posting || (autoPost && libraryLoading)}
              onPress={() => void (candidate ? postProgram() : startFirstAction())}
            />
          </View>
        </View>
      ) : null}

      <Text style={[styles.note, { color: colors.textMuted }]}>{t('onboarding.summary.note')}</Text>
      <View style={styles.footer}>
        <Button
          label={t('onboarding.summary.cta')}
          variant={firstActionPillar ? 'ghost' : 'primary'}
          onPress={() => void finish()}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontFamily: fontFamily.body, fontSize: 15 },
  rowValueWrap: { flexShrink: 1, alignItems: 'flex-end' },
  rowValue: { fontFamily: fontFamily.bodySemi, fontSize: 15, textAlign: 'right' },
  rowNote: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 0.4, textAlign: 'right' },
  panel: { borderRadius: 18, padding: 16, gap: 6 },
  panelEyebrow: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.1 },
  panelTitle: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.4 },
  panelBody: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  panelCta: { marginTop: 8 },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  footer: { marginTop: 'auto' },
});
