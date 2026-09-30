/**
 * Le conteneur de la carte de contradiction — US GUID-01, volet E.
 *
 * Sépare **la décision d'afficher** (ici) de **l'affichage** (`GoalConflictCard`), pour que
 * l'accueil reste une liste de blocs et non un endroit où l'on branche des règles métier.
 *
 * ── Quatre conditions, et il faut les quatre ────────────────────────────────────────────────────
 *  1. une contradiction existe réellement (`detectGoalConflicts`) ;
 *  2. le régime n'est pas `autonomous` — qui a demandé le silence l'obtient (`dispositionFor`) ;
 *  3. la règle n'a pas été rejetée, et le stockage local a fini de se charger ;
 *  4. il n'y en a **qu'une** à l'écran (plafond ADR-007).
 *
 * ── Ce que « résoudre » veut dire ───────────────────────────────────────────────────────────────
 * Aucune des deux actions ne « corrige » quoi que ce soit : elles **alignent** l'un des deux
 * réglages sur l'autre. Rien n'est supprimé, tout est réversible depuis l'écran d'origine — c'est
 * la condition pour qu'un bouton qui change un réglage de fond reste acceptable sur un accueil.
 */

import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  detectGoalConflicts,
  dispositionFor,
  effectiveRegime,
  firstVisibleConflict,
  resolveActivePillars,
} from '@wellness/shared';
import { CouncilSheet } from '@/components/dashboard/CouncilSheet';
import { GoalConflictCard } from '@/components/dashboard/GoalConflictCard';
import { guidanceSourceOf } from '@/data/guidance';
import { keepMainGoal as resolveKeepMainGoal, keepPillarGoal as resolveKeepPillarGoal } from '@/data/goal-conflict-resolution';
import { useProfile } from '@/data/repositories/profile-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useDismissedRules } from '@/stores/dismissed-rules-store';

export function GoalConflictBanner() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();
  const { runnerProfile } = useRunnerProfile();
  const dismissed = useDismissedRules((s) => s.dismissed);
  const hydrated = useDismissedRules((s) => s.hydrated);
  const dismiss = useDismissedRules((s) => s.dismiss);
  // US CONS-01 — le Conseil s'ouvre à la demande : c'est lui qui interroge la base, pas l'accueil.
  const [councilOpen, setCouncilOpen] = useState(false);

  useEffect(() => {
    void useDismissedRules.getState().hydrate();
  }, []);

  // Le régime de nutrition gouverne cette carte : c'est le réglage que la règle la plus fréquente
  // met en cause. `goalConflict` n'est jamais `apply` — on ne résout pas un conflit d'intention à
  // la place de quelqu'un, même en mode guidé.
  const regime = effectiveRegime(guidanceSourceOf(profile), 'nutrition');
  if (dispositionFor('goalConflict', regime) === 'silent') return null;

  // Tant que le stockage n'a pas répondu, on n'affiche rien : montrer une règle déjà rejetée, même
  // une fraction de seconde, revient à ignorer le rejet.
  if (!hydrated) return null;

  // Décision H (revue du 30/09/2026) : l'objectif d'un pilier désactivé ne se reproche pas — même
  // règle que le lien « objectifs » du Labo.
  const activePillars = resolveActivePillars(settings?.activePillars);
  const conflicts = detectGoalConflicts({
    mainGoal: profile?.mainGoal ?? null,
    nutritionObjective: activePillars.includes('nutrition') ? (nutritionProfile?.objective ?? null) : null,
    runnerObjective: activePillars.includes('running') ? (runnerProfile?.objective ?? null) : null,
  });
  const conflict = firstVisibleConflict(conflicts, dismissed);
  if (!conflict) return null;

  // Les deux issues vivent dans `goal-conflict-resolution` (LIENS-01) : la fiche du Labo propose les
  // mêmes, et un même choix doit écrire la même chose partout.
  // Leçon CONF-06 (revue du 30/09/2026) : un choix qui ne s'écrit pas doit se voir.
  const failed = () => Alert.alert(t('lab.apply.error'));
  const keepMainGoal = () => {
    void resolveKeepMainGoal(conflict).catch(failed);
  };
  const keepPillarGoal = () => {
    void resolveKeepPillarGoal(conflict).catch(failed);
  };

  return (
    <>
      <GoalConflictCard
        conflict={conflict}
        onKeepMainGoal={keepMainGoal}
        onKeepPillarGoal={keepPillarGoal}
        onDismissRule={() => dismiss(conflict.rule)}
        /*
          US CONS-01 — seule `bulkVsCut` est chiffrable : les deux issues d'`enduranceVsMass`
          changent des intentions dont la conséquence demanderait RN-17, non construite. Pas de
          lien plutôt qu'un lien vers une page vide.
        */
        onOpenCouncil={conflict.rule === 'bulkVsCut' ? () => setCouncilOpen(true) : undefined}
      />
      <CouncilSheet
        visible={councilOpen}
        conflict={conflict}
        onKeepMainGoal={keepMainGoal}
        onKeepPillarGoal={keepPillarGoal}
        onClose={() => setCouncilOpen(false)}
      />
    </>
  );
}
