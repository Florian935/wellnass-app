# Plan — CONF-07 · Accessibilité : solde des non-conformités WCAG AA

Spec : [conf07-accessibilite.md](../specs/functional/us/conf07-accessibilite.md) · branche
`fix/conf07-accessibilite` · roadmap **9.11 / 9.12**.

> **Volume réel : très faible.** 5 constantes hexadécimales et un fichier de test. Ce qui coûte dans
> cette US, ce n'est pas le code — c'est la **décision D1** (§4 de la spec) et le **coup d'œil humain**
> qui confirme que l'app n'a pas terni.

## Ordre de build

L'ordre est **inversé par rapport à l'habitude** : le test d'abord, et il doit être **rouge** avant
la correction. C'est tout l'intérêt — la première passe a échoué faute de mesure, donc on pose la
mesure avant le correctif, et on la regarde échouer sur les 5 paires connues.

### Étape 1 — Le garde-fou, en rouge *(≈ 1 h)*

**Nouveau** : `packages/shared/src/contrast.ts` + `packages/shared/src/contrast.test.ts`.

- Fonctions pures : `relativeLuminance(hex)`, `contrastRatio(a, b)`. Aucune dépendance.
- Le test importe la palette et parcourt une **table de paires explicite** — `[fg, bg, seuil, usage]`
  — reprise de §0 de la spec, avec pour chaque ligne la **justification du seuil** en commentaire.
- ⚠️ **La palette vit dans `apps/mobile/src/theme/colors.ts`, pas dans `packages/shared`.** Deux
  options, à trancher à l'écriture :
  - **(a)** déplacer `palettes` dans `packages/shared` et le réexporter depuis mobile — plus propre,
    mais touche les imports de 126 appels `useTheme` indirectement ;
  - **(b)** garder la palette côté mobile et écrire le test dans **`apps/mobile`** (Jest), en
    important seulement les helpers depuis `shared`. **Recommandé** : diff minimal, et le test vit à
    côté de ce qu'il protège.
  → Retenir **(b)** sauf objection.
- **Attendu à la fin de l'étape : 5 assertions rouges.** Si le test est vert d'emblée, c'est la
  table de paires qui est fausse — pas la palette.

### Étape 2 — Les 3 correctifs du thème clair *(≈ 15 min)*

[colors.ts](../../apps/mobile/src/theme/colors.ts), bloc `light` :

| Rôle | Avant | Après |
|---|---|---|
| `success` | `#7c8a5b` | `#66714b` |
| `warnText` | `#a97b1f` | `#8a6419` |
| `amber` | `#cc9544` | `#b47f31` |

- **Ne pas toucher `chartGreen`** (règle R3) — il reste `#7c8a5b`. Ajouter le commentaire qui
  explique pourquoi les deux tokens divergent désormais, sinon quelqu'un « corrigera » l'écart.
- Commenter chaque valeur avec son ratio, comme le fait déjà la première passe.
- 3 des 5 assertions passent au vert.

### Étape 3 — La décision D1, puis le thème sombre *(≈ 10 min, mais bloqué)*

⛔ **Ne pas démarrer avant l'arbitrage de Damien ou Florian** (spec §4).

- Si D1 est **acceptée** : `accentText` sombre `#ffffff` → `#1c150e` (3,29 → 5,48). 4ᵉ assertion verte.
- Si D1 est **refusée** : consigner l'écart comme assumé dans la spec **et** dans le test (paire
  marquée « écart accepté, décision du JJ/MM/AAAA »), pour que le rouge ne devienne pas du bruit
  qu'on finit par ignorer.
- D2 (`accent`/`surface` = 4,45) : même traitement. Recommandation = écart assumé.

### Étape 4 — Solde documentaire *(≈ 30 min)*

- **Roadmap 9.12** : la remarque actuelle affirme « le clair passe désormais AA sur texte **et**
  composants ». **C'est faux et il faut le corriger** — la première passe n'avait mesuré que 3 paires.
  Passer 9.12 à ✅ seulement si D1 est acceptée ; sinon 🟡 avec l'écart nommé.
- **Roadmap 9.11** : passer à ✅. La vérification à 1,5× est faite, et la spec §0.3 documente
  pourquoi *ne pas* poser de `maxFontSizeMultiplier` en masse est le bon choix.
- **BACKLOG.md** : retirer CONF-07 des P0. Il n'en restera que **2** (LANCE-00, LANCE-01) — tous deux
  hors-code.
- CHANGELOG + `node scripts/etat.mjs` via [`/commit`](../../.claude/commands/commit.md).

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `apps/mobile/src/theme/colors.ts` | 4 constantes (3 clair + 1 sombre si D1 acceptée) |
| `apps/mobile/src/theme/__tests__/contrast.test.ts` | **nouveau** — le garde-fou |
| `packages/shared/src/contrast.ts` | **nouveau** — helpers purs `contrastRatio` |
| `docs/roadmap/roadmap.md` | 9.11 → ✅ · 9.12 → ✅ ou 🟡 · récap · journal |
| `BACKLOG.md` | retrait de CONF-07 des P0 |

## Tests prévus

- `contrastRatio` sur des paires de référence connues (noir/blanc = 21, blanc/blanc = 1) — valide le
  calcul lui-même avant de lui faire juger la palette.
- La table des paires de la spec §0, sur les **deux** thèmes.
- **Non-régression** : `chartGreen` reste ≥ 3,0 et **inchangé** en valeur.

## Migration / sync rules

**Aucune migration. Aucune sync rule à redéployer.** Le diff est constant côté données.

## Risques

- 🟠 **Le risque n'est pas technique, il est esthétique.** Trois couleurs s'assombrissent dans le
  thème clair. Le critère de recette n°6 (« l'app ne paraît pas plus terne ») est le vrai juge, et il
  est subjectif : prévoir un aller-retour possible sur les valeurs, en gardant la règle R1.
- 🟠 **D1 est très visible** — chaque bouton plein du mode par défaut. À montrer sur capture avant
  d'acter, d'où la maquette.
- 🟢 Aucun risque de régression fonctionnelle : le diff ne touche ni logique, ni données, ni i18n.
