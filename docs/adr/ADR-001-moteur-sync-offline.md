# ADR-001 — Moteur de synchronisation offline-first

- **Statut** : ✅ **Accepté et confirmé** — PowerSync retenu, **confirmé par le [spike 001](../specs/technical/spike-001-powersync.md)** le 05/07/2026.
- **Date** : 30/06/2026 (proposé) · 04/07/2026 (accepté après arbitrages de cadrage) · **05/07/2026 (confirmé par le spike)**
- **Décideurs** : les 2 devs (Florian + Damien), pilotage technique délégué à Claude Code.
- **Lié à** : décision de cadrage [B — Moteur de synchro offline](../../SYNTHESE-CADRAGE.md) · principe offline-first structurant.

---

## Contexte

La V1 exige un fonctionnement **offline-first complet** : logging de séance, historique, templates et consultation doivent marcher **sans réseau** (réalité terrain en salle, mais aussi en course), avec **synchro en arrière-plan** vers Supabase au retour du réseau, et **gestion des conflits** (utilisation multi-appareils).

Or **Supabase n'offre pas de solution offline native**. Il faut donc :
1. une **base de données locale** (SQLite) sur l'appareil ;
2. une **couche de synchronisation** bidirectionnelle local ↔ Postgres/Supabase ;
3. une **stratégie de résolution de conflits**.

Écrire cette couche de synchro à la main est **le plus gros risque technique du projet** pour une équipe de 2 personnes. Le périmètre V1 à 3 piliers (muscu + running + nutrition) accentue ce risque : le running produit des **données volumineuses** (traces GPS) qui devront transiter par la même couche de synchro.

## Options envisagées

### A — PowerSync *(retenu)*
Service managé conçu spécifiquement pour l'offline-first sur Postgres/Supabase : SQLite local + synchro bidirectionnelle automatique + résolution de conflits.
- **+** Élimine le risque de synchro maison : on n'écrit pas le protocole. SDK React Native. Pensé pour Supabase.
- **−** Service managé supplémentaire (coût à l'échelle, couplage fournisseur). Nécessite un **dev build** (module natif, pas Expo Go). Modèle de données contraint par les *sync rules*.

### B — WatermelonDB + synchro custom
Base locale SQLite éprouvée pour RN, mais synchro contre Supabase **codée à la main**.
- **+** Pas de service tiers, archi maîtrisée.
- **−** On porte toute la complexité synchro/conflits en interne = risque technique majeur assumé.

### C — Legend-State + plugin Supabase
État observable + persistance + synchro Supabase offline-first intégrée.
- **+** DX moderne, léger, optimiste par défaut.
- **−** Plus jeune, schéma/migrations à notre charge, moins de recul à grande échelle.

## Décision

**Option A — PowerSync**, parce que c'est l'option qui **neutralise le mieux le risque de synchro maison** pour une petite équipe, tout en étant pensée pour Supabase. Décision actée le 04/07/2026 lors de la mise en commun des cadrages.

**Conditionnelle** : la décision est **figée sous réserve de confirmation par le [spike 001](../specs/technical/spike-001-powersync.md)** (compat dev build Expo + synchro réelle + comportement offline/conflits + tenue sur données volumineuses GPS). En cas d'échec du spike → repli sur **C (Legend-State)** puis **B (WatermelonDB)**.

## Résultat du spike 001 (05/07/2026) — ✅ CONFIRMÉ

Mini-app Expo jetable (React Native + Expo SDK 54, dev build Android sur Pixel 6a) branchée sur une instance PowerSync Cloud reliée à un projet Supabase (table jouet `todos`). Les 6 critères de réussite ont été déroulés :

| # | Critère | Verdict |
|---|---------|---------|
| 1 | Build (dev build Expo + module natif PowerSync) | ✅ Compile et tourne sur Pixel 6a |
| 2 | Écriture offline (mode avion) persistante localement | ✅ Instantané, persistant après fermeture, reprise auto au retour réseau |
| 3 | Synchro montante (upload → Supabase) | ✅ |
| 4 | Synchro descendante (Supabase → app) | ✅ |
| 5 | Conflit même donnée (tel offline vs édition Supabase) | ✅ *Last-write-wins* côté client, déterministe, sans corruption — **configurable** dans `uploadData` |
| 6 | DX / effort pour 2 devs | ✅ Raisonnable (client ≈ 5 fichiers), à condition de connaître 2 pièges de config (ci-dessous) |

**Verdict : PowerSync est validé.** Aucun critère bloquant (1–4) n'a échoué ; le repli C/B n'est pas activé.

### Pièges de configuration rencontrés (à intégrer au provisioning)
1. **Auth Supabase → PowerSync** : Supabase signe ses JWT avec des **clés asymétriques ES256** (nouveau système *JWT Signing Keys*). Il faut activer **« Use Supabase Auth »** dans PowerSync → *Client Auth* (champ *JWT Secret* laissé vide), sinon la connexion de streaming est rejetée en **401 `PSYNC_S2101`** — l'upload continue de marcher (il tape direct sur Supabase), mais **rien ne descend**, ce qui masque la cause.
2. **Sync Streams `edition: 3`** : le nouveau format exige **`auto_subscribe: true`** sur le stream, sinon le client ne s'abonne à rien et **ne reçoit aucune donnée descendante** (connexion pourtant « saine »).

### Réserve — reste à valider
- **Tenue sur données volumineuses (traces GPS running)** : **non couverte** par ce spike (table jouet uniquement). À éprouver avant/pendant la V0.5 (running), comme prévu.
- Comportement de la **reprise réseau** à re-tester hors artefacts du dev build (couplage app ↔ Metro).

## Conséquences

- **Dev build Expo obligatoire** dès le départ (Expo Go insuffisant, module natif). À poser en V0.1 de la roadmap.
- Le **modèle de données** sera conçu en tenant compte des contraintes PowerSync (*sync rules*, identifiants, buckets). Le spike conditionne donc le modèle de données : **à mener avant de figer les tables**.
- La **résolution de conflits** est déléguée à l'outil (plus de *last-write-wins* codé à la main comme envisagé initialement côté Dams).
- Dépendance à un **service externe** supplémentaire à provisionner et monitorer (coût à surveiller à l'échelle).
- Comportement à valider tôt sur les **traces GPS running** (volumétrie).
- Si le spike échoue, cet ADR est révisé (repli C, puis B) **avant** tout investissement dans le repo réel.
