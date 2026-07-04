# ADR-001 — Moteur de synchronisation offline-first

- **Statut** : 🟡 **Proposé** — à **valider par un spike** avant d'être figé (voir [spike-001-powersync.md](../specs/technical/spike-001-powersync.md)).
- **Date** : 2026-06-30
- **Décideurs** : les 2 devs (porteur + ami), pilotage technique délégué à Claude Code.
- **Lié à** : décision de cadrage [D8 — Offline-first complet](../product/cadrage.md).

---

## Contexte

Le MVP1 exige un fonctionnement **offline-first complet** (D8) : logging, historique, templates et consultation doivent marcher **sans réseau** (réalité terrain en salle), avec **synchro en arrière-plan** vers Supabase au retour du réseau, et **gestion des conflits**.

Or **Supabase n'offre pas de solution offline native**. Il faut donc :
1. une **base de données locale** (SQLite) sur l'appareil ;
2. une **couche de synchronisation** bidirectionnelle local ↔ Postgres/Supabase ;
3. une **stratégie de résolution de conflits**.

Écrire cette couche de synchro à la main est **le plus gros risque technique du projet** (cf. risque R2 du PRD) pour une équipe de 2 personnes.

## Options envisagées

### A — PowerSync *(retenu, à valider)*
Service managé conçu spécifiquement pour l'offline-first sur Postgres/Supabase : SQLite local + synchro bidirectionnelle automatique + résolution de conflits.
- **+** Élimine le risque R2 : on n'écrit pas le protocole de synchro. SDK React Native. Pensé pour Supabase.
- **−** Service managé supplémentaire (coût à l'échelle, couplage fournisseur). Nécessite un **dev build** (module natif, pas Expo Go).

### B — WatermelonDB + synchro custom
Base locale SQLite éprouvée pour RN, mais synchro contre Supabase **codée à la main**.
- **+** Pas de service tiers, archi maîtrisée.
- **−** On porte toute la complexité synchro/conflits = **risque R2 assumé en interne**.

### C — Legend-State + plugin Supabase
État observable + persistance + synchro Supabase offline-first intégrée.
- **+** DX moderne, léger, optimiste par défaut.
- **−** Plus jeune, schéma/migrations à notre charge, moins de recul à grande échelle.

## Décision

**Option A — PowerSync**, parce que c'est l'option qui **neutralise le mieux le risque R2** pour une petite équipe, tout en étant pensée pour Supabase.

**Conditionnelle** : la décision n'est **figée qu'après un spike de validation** réussi (compat Expo + synchro réelle + comportement offline/conflits). En cas d'échec du spike → repli sur **C (Legend-State)** puis **B (WatermelonDB)**.

## Conséquences

- Le **modèle de données** sera conçu en tenant compte des contraintes PowerSync (sync rules, identifiants, etc.).
- Le build nécessitera un **dev build Expo** (Expo Go insuffisant) dès le départ.
- Dépendance à un **service externe** supplémentaire à provisionner et monitorer.
- Si le spike échoue, cet ADR est révisé (repli C, puis B) **avant** tout investissement dans le repo réel.
