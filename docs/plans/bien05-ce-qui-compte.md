# Plan — BIEN-05 · Ce qui compte

> Spec : [bien05-ce-qui-compte.md](../specs/functional/us/bien05-ce-qui-compte.md) · roadmap 1.34.
> Lot en une vague avec BIEN-02 → BIEN-07 (voir le [plan de BIEN-02](bien02-pilier-bien-etre.md)).

## Étapes

1. **Moteur** `packages/shared/src/wellbeing-links.ts` (nouveau, pur) : `WELLBEING_LINK_IDS` (9),
   `WELLBEING_LINKS` (portée, unité, pilier, sens défavorable, disponibilité), seuils nommés
   (`WELLBEING_LINK_MIN_CASES` 8, `SOLID_CASES` 14, `THRESHOLDS` par unité, fenêtre 90 jours),
   `compareGroups`, `buildWellbeingLinks`, `recentPoorNights`, `isKnownLink`, `linkProgress`.
2. **Registre** `cross-links.ts` : lien `wellbeing` (après `recovery`), lentille / surface / route
   `wellbeing`, graphique `effects`, entrées `wellbeingEnabled?` et `wellbeing?` ; constructeur
   discover (`wellbeingCases`) / adjust (`adjust.<nuit>`) / holdsKnown / holdsNone.
3. **Repositories** : `wellbeing-pillar-repository.ts` (`useWellbeingLinksSummary` : 90 jours de
   check-ins, séances avec tonnage et clé de groupe, sorties avec effort perçu, apports), branché dans
   `cross-links-repository.tsx`.
4. **Écrans** : `components/lab/CrossLinkChart.tsx` (forme `effects`, barres rapportées au seuil de
   bruit de leur unité), `LinkLens.tsx`, `link-routes.ts` ; `sections/InsightsSection.tsx` (écho,
   nuits, régularité, moyennes 30 jours).
5. **i18n** : `lab.links.wellbeing.*`, `rows`, `figures`, `missing`, `source`, `surfaces`, `routes`,
   `lab.fiche.chart.effects*`, `wellbeingHub.insights.*`.

## Tests

- Shared : `wellbeing-links.test.ts` (chaque croisement, disponibilité, seuils, stades),
  `cross-links.test.ts` (les trois états du lien Bien-être).
- Mobile : `link-texts-coverage.test.ts` (🔴 chaque texte produit existe en FR et EN — situations
  couvrant les trois états et les quatre stades de chaque croisement), `cross-link-chart.test.tsx`
  (forme `effects` : signe, unité, « rien de visible », largeur des barres), `lab-screen.test.tsx`.

## Reporté

« Cette règle ne me correspond pas », passerelle vers l'enquête, historique figé du lien.
