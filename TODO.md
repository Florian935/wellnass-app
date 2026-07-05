# TODO — Wellness App

Suivi **vivant** des tâches. On y ajoute les US au fur et à mesure qu'elles entrent dans le
pipeline ; la commande [`/commit`](.claude/commands/commit.md) coche ce qui vient d'être livré.

- Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait
- Le **backlog complet** (179 US, V0.1 → V1.1) vit dans
  [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) — ne pas le recopier ici, seulement
  remonter les US actives.
- Rappel workflow (voir [CLAUDE.md](CLAUDE.md)) : **spec → plan → design → validation → code**.
  Chaque US = une branche (`feature/…`, `fix/…`, `chore/…`).

*Dernière mise à jour : 05/07/2026*

---

## 🚧 En cours

- _(rien pour l'instant)_

---

## ⏭️ À faire prochainement (avant / début V0.1)

### Décisions bloquantes à trancher
- [x] Confirmer **PowerSync** via le spike ([spike-001](docs/specs/technical/spike-001-powersync.md)) — ✅ **validé le 05/07/2026** (voir [ADR-001](docs/adr/ADR-001-moteur-sync-offline.md)), débloque le modèle de données
- [ ] Trancher **Mapbox vs MapLibre** (fournisseur de cartes, running V0.5)
- [ ] Source des **GIF d'exercices** — exercises-dataset vs ExerciseDB (avant V0.2)
- [ ] Source de la **base d'aliments** — CIQUAL + OpenFoodFacts + plan de traduction EN (avant V0.4)

### Scaffolding (fondations, à poser avant tout code fonctionnel)
- [ ] Initialiser le **monorepo** (`apps/mobile`, `apps/admin`, `packages/shared`)
- [ ] Créer l'**app Expo** (React Native + TypeScript + Expo Router + Zustand)
- [ ] Mettre en place le **dev build Expo** (Expo Go insuffisant — module natif PowerSync)
- [ ] Provisionner **Supabase** (Postgres + Auth + Storage + RLS) — cf. [runbook-provisioning-spike](docs/specs/technical/runbook-provisioning-spike.md)
- [ ] Poser l'infra **i18n** (i18next + expo-localization, FR + EN, aucune chaîne en dur)
- [ ] Renseigner la section **Commandes** de [CLAUDE.md](CLAUDE.md) (build / test / lint / typecheck / migrations / seed)

---

## 📋 Backlog par version

Voir [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md). Ordre de build :
**V0.1** socle & compte → **V0.2/V0.3** muscu → **V0.4** alimentation → **V0.5** running →
**V0.6** dashboard & sync cloud → **V0.7** admin → **V0.8** bêta → **V1.0** lancement → **V1.1** post-lancement.

Les US remontent ici (dans « À faire prochainement » puis « En cours ») dès qu'elles
démarrent leur cycle spec → plan → design → validation → code.

---

## ✅ Fait

- [x] Phase de cadrage : fusion des cadrages Florian + Damien, arbitrages A→H, roadmap versionnée (04/07/2026)
- [x] Process de travail : workflow spec→plan→design→validation→code, branches, `/commit` (revue + CHANGELOG + push `dev`) (05/07/2026)
- [x] Fichiers de config dépôt : `.gitignore` + `.gitattributes` (normalisation LF) (05/07/2026)
