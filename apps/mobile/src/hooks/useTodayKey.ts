/**
 * Le jour courant, **réactif** — l'unique source d'horloge autorisée dans un composant ou un hook.
 *
 * ── Le bug que ce module corrige (30/07/2026) ─────────────────────────────────────────────────────
 * `experiments.reactCompiler` est activé ([app.json](../../app.json)). React Compiler mémoïse les
 * valeurs calculées au rendu ; quand une valeur n'a **aucune entrée réactive** — ce qui est le cas
 * de `localDayKey(new Date())`, qui ne dépend d'aucune prop, d'aucun state, d'aucun hook — il la
 * classe **constante** et la range dans un slot `useMemoCache` **mount-only**, évalué une seule
 * fois, pour la durée de vie de l'instance.
 *
 * Sur les hooks montés dans le layout racine (`useStreakData`, `useWeeklyReview`), l'instance vit
 * aussi longtemps que le process JS, qu'Android conserve en arrière-plan. Sur les onglets, aucun
 * `unmountOnBlur` n'est configuré : un onglet monté au premier affichage ne se démonte jamais.
 * Résultat : la requête « et aujourd'hui ? » interrogeait éternellement le **jour du montage**.
 *
 * Et la classe de bugs est **invisible là où on la chercherait** :
 * - en **dev**, `enableResetCacheOnSourceFileChanges: !isProduction` réinitialise le cache à chaque
 *   sauvegarde de fichier ;
 * - sous **Jest**, `babel-preset-expo` n'applique le plugin que si l'appelant pose
 *   `supportsReactCompiler`, ce que seul le transformer Metro fait — jamais `babel-jest`.
 *
 * Elle ne se manifeste donc qu'en **build release**. D'où le test de non-régression
 * `packages/shared`-indépendant qui **compile** les repositories et échoue si un slot mount-only
 * lit l'horloge : c'est le seul garde-fou qui puisse la voir.
 *
 * ── Le principe du correctif ──────────────────────────────────────────────────────────────────────
 * **Une seule valeur réactive**, la clé du jour, et tout le reste en dérive. C'est ce qui rend le
 * correctif sûr : une fois la racine réactive, chaque valeur calculée à partir d'elle tombe dans un
 * scope mémoïsé **keyé sur elle**, donc se rafraîchit avec elle. Il n'y a pas à auditer les
 * dérivations une par une.
 *
 * ⚠️ **Règle à tenir** : dans le corps d'un composant ou d'un hook, ne jamais appeler `new Date()`
 * ni `Date.now()`. Utiliser ces hooks. Dans un **callback d'événement**, en revanche, `new Date()`
 * est correct et attendu — la closure lit l'horloge à l'appel, pas au rendu.
 *
 * ── Quand la valeur se rafraîchit ─────────────────────────────────────────────────────────────────
 * Au **retour au premier plan**, seul moment où l'app peut constater un changement de jour sans
 * minuteur. Un `setInterval` de veille de minuit serait plus précis mais réveillerait l'app pour
 * rien : l'utilisateur qui ne revient pas ne voit aucun écran, donc aucune valeur périmée.
 */

import { useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { localDateFromDayKey, localDayKey, localMidnightDaysAgo } from '@wellness/shared';

/**
 * Clé du jour local courant (`AAAA-MM-JJ`), rafraîchie au retour au premier plan.
 *
 * C'est **la** primitive : préférer dériver de sa valeur plutôt que d'ajouter une autre source
 * d'horloge.
 */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => localDayKey(new Date()));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      // Garde d'idempotence : sans elle, chaque retour au premier plan re-render tous les abonnés.
      setKey((current) => {
        const next = localDayKey(new Date());
        return next === current ? current : next;
      });
    });
    return () => sub.remove();
  }, []);

  return key;
}

/**
 * Minuit local du jour courant, sous forme de `Date`, réactif.
 *
 * Dérivé de `useTodayKey()` — donc une seule source d'horloge. Pour les helpers de
 * `@wellness/shared` qui prennent une date de référence injectable (`localMidnightDaysAgo`,
 * `rollingWeekStarts`, `lastClosedWeek`, `startOfWeek`…).
 *
 * ⚠️ C'est **minuit**, pas l'instant courant. Aucun appelant n'a besoin de l'heure ici, et exposer
 * un instant à la seconde ferait rentrer une valeur qui change à chaque rafraîchissement — donc des
 * re-rendus en cascade et des requêtes re-souscrites pour rien.
 */
export function useTodayDate(): Date {
  const todayKey = useTodayKey();
  return useMemo(() => localDateFromDayKey(todayKey), [todayKey]);
}

/**
 * Borne basse d'une fenêtre glissante de `days` jours **incluant aujourd'hui**, en clé de jour local.
 *
 * `days = 7` renvoie donc J-6, pas J-7 : la convention du dépôt compte les jours **inclusivement**
 * (cf. `ROLLING_WEEK_DAYS - 1`). C'est la source d'une erreur de bord classique, d'où ce hook plutôt
 * qu'un `- 1` recopié à chaque appel.
 */
export function useWindowStartKey(days: number): string {
  const today = useTodayDate();
  return useMemo(() => localDayKey(localMidnightDaysAgo(days - 1, today)), [days, today]);
}

/**
 * Même fenêtre que `useWindowStartKey`, mais en **instant UTC ISO** — pour comparer aux colonnes
 * `timestamptz` répliquées en TEXT (`created_at`, `finished_at`, `started_at`).
 *
 * Le passage par minuit local puis `toISOString()` est le patron du dépôt (cf. `utcBounds()` dans
 * `weekly-review-repository.ts`) : comparer une clé de jour locale à un instant UTC déborderait d'un
 * côté ou de l'autre selon le fuseau.
 */
export function useWindowStartUtc(days: number): string {
  const today = useTodayDate();
  return useMemo(
    () => localMidnightDaysAgo(days - 1, today).toISOString(),
    [days, today],
  );
}
