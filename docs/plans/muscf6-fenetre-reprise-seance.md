# US MUSC-F6 — Fenêtre de reprise de séance — Plan d'implémentation

> ⚠️ **Workflow projet** : ne PAS exécuter avant validation des livrables (spec + plan — **pas de
> maquette** pour l'Option A recommandée, aucun écran ne change).
> 🔴 **Décision requise avant tout code** : Option A (officialiser 3h, doc uniquement) ou Option B
> (fenêtre distincte, vrai chantier) — voir spec §1. Ce plan ne détaille que l'Option A ; si Option B
> est retenue, ce plan est caduc et une nouvelle spec/plan/maquette sont nécessaires (l'US redevient
> un vrai chantier de code + UI).

**Goal :** faire dire à la documentation ce que le code fait déjà — aucun changement de comportement.

**Spec :** [docs/specs/functional/us/muscf6-fenetre-reprise-seance.md](../specs/functional/us/muscf6-fenetre-reprise-seance.md)

---

## Tasks (Option A uniquement)

- [ ] 1. **`docs/specs/functional/musculation.md` §4.4** — remplacer le paragraphe « Abandon de
      séance / reprise » (promesse de popup Pause + fenêtre 4h) par une description fidèle au
      comportement réel : quitter l'écran laisse la séance `active` ; elle reste reprenable via le
      bouton « Reprendre » du hub muscu jusqu'à la clôture automatique après 3h d'inactivité
      (US 3.37, `WORKOUT_AUTO_CLOSE_SECONDS`).
- [ ] 2. **`docs/roadmap/roadmap.md` ligne 3.36** — libellé « Suspendre et reprendre dans les
      4 heures » → « Reprenable jusqu'à la clôture automatique (3h, US 3.37) ». Statut 🟡 → ✅
      (plus d'écart doc/code une fois §4.4 corrigé). Retirer la remarque « seuils 3h/4h à
      réconcilier », devenue caduque.
- [ ] 3. **Récapitulatif de la roadmap** — 3.36 passe 🟡 → ✅ : ajuster les compteurs
      (Partiel −1, Livré +1) et le détail par version (V0.2, cf. ligne existante).
- [ ] 4. **Clôture** : `/commit` — front-matter `etape: code` → `close` directement (§4 de la
      spec : aucun critère de recette, aucune ligne de code applicatif touchée), `ETAT.md`
      régénéré, entrée retirée de BACKLOG.md si présente sous cette forme.
