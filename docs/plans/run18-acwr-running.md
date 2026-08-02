# Plan — RUN-18 · Charge d'entraînement & ACWR (running seul)

Spec : [run18-acwr-running.md](../specs/functional/us/run18-acwr-running.md) ·
branche `feature/run18-acwr-running` · **aucune ligne roadmap** (US d'analyse, catalogue seul).

## Étape 1 — `zone` dans `computeAcwr`, pure et testée *(≈ 30 min)*

`packages/shared/src/training-time.ts` — extension **additive** du type existant :

```ts
export type AcwrZone = 'low' | 'safe' | 'risk';
export type AcwrResult = { ratio: number; zone: AcwrZone; showAlert: boolean };
```

Dans `computeAcwr`, calculer `zone` à partir du même `ratio` déjà produit, avec les bornes déjà
codées ailleurs dans la fonction (`ratio > ACWR_RISK_THRESHOLD` reste la seule condition de
`showAlert`, inchangée) :
- `ratio < 0.8` → `'low'`.
- `0.8 <= ratio <= 1.3` → `'safe'`.
- `ratio > 1.3` → `'risk'`.

Aucun changement de signature, aucun paramètre nouveau. Les appels existants (`useTrainingLoadAlert`,
META-19) ignorent simplement le nouveau champ — pas de code à toucher côté META-19.

**Tests, écrits d'abord** (`training-time.test.ts`, à côté des tests `computeAcwr` existants) :
- Ratio ≈ 1 (déjà testé pour `showAlert`) → `zone === 'safe'`.
- Ratio > 1,3 (déjà testé) → `zone === 'risk'`.
- Ratio < 0,8 (déjà testé) → `zone === 'low'`.
- Bornes pile 0,8 et 1,3 → `'safe'` dans les deux cas (comparaisons inclusives, cas limite explicite
  qu'aucun test existant ne couvre).

## Étape 2 — La section, dans l'écran existant *(≈ 1 h)*

Aucun nouveau hook de repository : calcul **inline** dans
[running-history/index.tsx](../../apps/mobile/src/app/running-history/index.tsx), même patron que
`PredictionsSection` (RUN-14) — la donnée (`useRunHistory()`) est déjà chargée par l'écran.

```ts
function TrainingLoadSection() {
  const { runs } = useRunHistory();
  const acuteStartKey = useWindowStartKey(7);   // @/hooks/useTodayKey, déjà utilisé côté dashboard
  const chronicStartKey = useWindowStartKey(28);

  const byWindow = (startKey: string) =>
    runs
      .filter((r) => r.finishedAt != null && localDayKey(new Date(r.finishedAt)) >= startKey)
      .map((r) => ({ rpe: r.rpe, durationSeconds: r.durationSeconds }));

  const result = computeAcwr({
    acuteSessions: byWindow(acuteStartKey),
    chronicSessions: byWindow(chronicStartKey),
  });

  if (!result) return <Text>{t('running.trainingLoad.empty')}</Text>;   // R5

  const zoneKey = { low: 'zoneLow', safe: 'zoneSafe', risk: 'zoneRisk' }[result.zone];
  // ligne unique, accessible + accessibilityLabel combinant libellé + zone + ratio (spec §7 —
  // PAS le patron `RecordsSection`, ses lignes sont des Pressable donc accessibles par un autre
  // mécanisme ; ici de simples View/Text, à regrouper explicitement)
}
```

- Montée dans l'écran sous « Objectifs estimés » (RUN-14, `PredictionsSection`), avec son propre
  titre de section (`running.trainingLoad.title`) au même niveau que les titres existants (voir la
  liste de `<Text style={styles.sectionTitle}>` dans le corps de `RunningHistoryScreen`).
- Format du ratio : `result.ratio.toFixed(2)` (spec §5 — pas de formatage localisé).
- Aucune couleur d'alerte différenciée entre les 3 zones (spec R4) — même style de texte que le
  reste de l'écran, seul le libellé de zone change.

## Étape 3 — Solde *(≈ 20 min)*

**Pas de ligne roadmap** (rappel front-matter `roadmap: []`). Mettre à jour
[analyses-donnees.md](../product/analyses-donnees.md) : RUN-18 🆕 → ✅ (reste recette), avec note sur
l'alignement du seuil (1,3, pas 1,5 — R2 de la spec). CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/training-time.ts` (+ `.test.ts`) | `AcwrZone`, extension de `AcwrResult`/`computeAcwr` |
| `apps/mobile/src/app/running-history/index.tsx` | nouvelle section `TrainingLoadSection` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `running.trainingLoad.*` (5 clés) |
| `docs/product/analyses-donnees.md` | RUN-18 🆕 → ✅ |

## Migration / sync rules

**Aucune.** Donnée déjà en base (`runs`), calcul pur en lecture seule, aucune nouvelle table.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟢 **Aucun risque de ricochet côté META-19** : l'ajout de `zone` à `AcwrResult` est purement
  additif, aucun appelant existant ne détruit l'objet (`toEqual` n'est utilisé nulle part sur ce
  type dans les tests actuels — vérifié).
- 🟠 **Accessibilité** : le piège identifié en relecture de spec — copier le patron `RecordsSection`
  (qui fonctionne *grâce* à `Pressable`, pas par accident) donnerait des lignes non regroupées pour
  TalkBack. Écrire le test/vérif d'accessibilité en gardant cette différence en tête, pas en copiant
  le fichier voisin sans relire son mécanisme.
- 🟢 Pas de nouvelle notion de risque produit : le seuil et la méthode sont ceux déjà validés et
  livrés par META-19, seule la portée des données change.
