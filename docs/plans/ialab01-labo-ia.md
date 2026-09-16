# Plan d'implémentation — US IA-LAB-01 (Labo IA)

> [Spec](../specs/functional/us/ialab01-labo-ia.md) ·
> [analyse §7](../product/ia-integration-analyse.md) · branche : **`dev`** (demande de Florian,
> 15/09/2026 — lot unique, recette unique).

## Ordre de build retenu

Du plus contraint au plus libre : la brique pure d'abord (elle fixe le contrat de ce qui peut
sortir), le serveur ensuite, l'écran en dernier. L'inverse aurait laissé l'écran décider de ce qu'il
envoie — c'est-à-dire laisser la minimisation RGPD se décider dans un composant React.

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | **Doc** — volet « tester en gratuit » | `docs/product/ia-integration-analyse.md` (§7 neuf, §7→8, 8→9, 9→10) | — |
| 2 | **Contrat de sortie** — liste blanche + sérialisation | `packages/shared/src/ai-context.ts` **(neuf)**, `index.ts` | `ai-context.test.ts` **(neuf, 12 cas)** |
| 3 | **Quota `coach`** + libellés de fournisseur | `packages/shared/src/ai-assist.ts` | existants |
| 4 | **Adaptateurs de fournisseur** | `supabase/functions/ai-assist/providers.ts` **(neuf)** | — *(Deno, hors runner)* |
| 5 | **Gardes + type `coach`** | `supabase/functions/ai-assist/index.ts` | — *(Deno, hors runner)* |
| 6 | **Client** — restauré de `622339f2^`, étendu | `apps/mobile/src/lib/ai/ai-client.ts` **(restauré)** | `ai-client.test.ts` **(restauré + 4 cas)** |
| 7 | **Assemblage du contexte** — câblage SQL | `apps/mobile/src/data/repositories/ai-context-repository.ts` **(neuf)** | couvert par (2) |
| 8 | **Écran + section Réglages + route** | `ai-lab.tsx` **(neuf)**, `AiLabSection.tsx` **(neuf)**, `settings.tsx`, `_layout.tsx` | `locale-parity` |
| 9 | **i18n** FR + EN | `i18n/locales/{fr,en}.json` (bloc `aiLab`) | `locale-parity.test.ts` |
| 10 | **Jeu de données factices** | `supabase/scripts/ia-purge-et-dataset.sql` **(neuf)** | — *(joué à la main)* |
| 11 | **Suivi** | spec, plan, RECETTES §67, roadmap 7.31, CHANGELOG, ETAT | `node scripts/etat.mjs` |

## Décisions prises en cours de route

**`fetch` plutôt que les SDK, dans la fonction Edge.** Un SDK par fournisseur = un import `npm:` de
plus à démarrage froid, pour deux appels REST dont on n'utilise ni le streaming ni les outils. Les
deux adaptateurs tiennent en 60 lignes chacun. Effet de bord utile : l'import
`npm:@anthropic-ai/sdk` disparaît de la fonction.

**Le fournisseur se déduit de la clé présente** quand `AI_PROVIDER` n'est pas posée, Gemini d'abord.
Le chemin d'exploration est ainsi le chemin par défaut : on bascule en posant **un seul** secret.

**Le détail des erreurs 4xx remonte au client** (voir spec §3.2). C'est une entorse volontaire à
« le message du fournisseur ne sort jamais », bornée aux erreurs de configuration.

**`AVG` ignore les NULL** pour le sommeil : la moyenne se calcule sur les nuits renseignées, pas sur
les jours de check-in. Le sommeil est facultatif (LABO-01) ; compter les jours vides comme des nuits
de zéro heure aurait divisé la moyenne par trois.

**Deux bornes de fenêtre** dans le repository (`windowIso` **et** `windowDayKey`). Les tables de
journal sont datées en date locale, celles d'événement en instant UTC. Comparer les deux en SQLite
« marche » lexicographiquement et donne un résultat faux d'un jour selon le fuseau.

**Le script SQL résout les exercices par nom, pas par UUID.** Les identifiants du `seed.sql` ne sont
pas fiables : le seed n'est joué que par `db:reset`, qui suppose Docker — que personne n'a. Le
contenu du cloud vient du back-office, avec d'autres identifiants. D'où : résolution par nom, repli
sur « n'importe quel exercice de ce groupe musculaire », et échec bruyant si la bibliothèque est vide.

**Le script s'adapte à une base dont LABO-01 n'est pas poussée.** `daily_wellbeing.sleep_minutes` et
`lab_experiments` n'existaient pas sur le cloud au moment de l'écriture (registre `MIGRATIONS.md`).
Détection par `information_schema` / `to_regclass`, insertion dynamique du sommeil : le script
dégrade le signal S3 au lieu d'échouer à mi-parcours.

## Correction du 16/09/2026 — le contexte ne portait aucune tendance

La première recette a fait tourner
[`ia-verification.sql`](../../supabase/scripts/ia-verification.sql) et sorti « allure 332 s/km
contre 332 s/km » : S5 paraissait absent. Deux défauts distincts derrière ce symptôme.

**Le mien, dans la requête de vérification** : elle comparait « les 21 derniers jours » à **tout
l'historique**, qui contient les semaines de progression. Le signal s'y diluait.

**Le vrai, dans le contexte envoyé au modèle** — et c'est celui qui comptait : `AiSnapshot` ne
portait que des agrégats sur 90 jours. Une allure moyenne, une moyenne calorique, une charge max
sans dimension temporelle. **Cinq des six signaux plantés sont des évolutions** ; aucun n'était
atteignable. Le labo aurait rendu un verdict sévère sur un modèle à qui l'on n'avait pas donné de
quoi répondre.

Corrigé en trois temps :

1. `AiTrend { recent, previous }` sur chaque mesure (poids, calories, protéines, allure, énergie,
   stress, sommeil, pas) plus `progression` par exercice, fenêtres de **28 jours**
   (`AI_TREND_WINDOW_DAYS`). Section `TENDANCES` en fin de contexte, avec l'écart en pourcentage —
   calculé, jamais commenté.
2. Requêtes à double fenêtre dans le repository (`MAX/AVG/SUM(CASE WHEN …)`, un seul parcours par
   table). L'allure est **pondérée par la distance**, recomposée en TypeScript : `AVG` des allures
   donnerait autant de poids à un 5 km qu'à un 20 km.
3. Jeu de données : S3 et S5 alignés sur 28 jours, dégradation d'allure portée de 18 à 30 s. Un
   signal plus court que la fenêtre de comparaison n'est pas lisible.

10 tests de plus, dont un qui vérifie qu'une comparaison à moitié vide est **tue** plutôt que rendue
à moitié, et un qui vérifie que le rendu ne porte aucun mot de jugement.

**Ce que ça dit du garde-fou** : le test-garde de liste blanche a bien échoué à l'ajout des champs,
comme prévu. Mais aucun test ne pouvait attraper ce défaut-là — il ne portait pas sur ce que le
contexte contient, mais sur ce qu'il **permet de conclure**. Seule la confrontation à des données
réelles l'a révélé. C'est l'argument pour avoir écrit `ia-verification.sql` avant d'interroger le
modèle, et pas après.

## Ce qui n'est pas automatisable

Trois gestes humains, dans cet ordre, avant toute recette :

1. `npx supabase secrets set GEMINI_API_KEY=…` (clé gratuite — <https://aistudio.google.com/apikey>)
2. `npx supabase functions deploy ai-assist --use-api`
3. Jouer `supabase/scripts/ia-purge-et-dataset.sql` dans le SQL Editor du cloud

Tant que (1) n'est pas fait, la fonction répond `ai_unavailable` et **rien n'est facturé** : c'est
l'état sûr par défaut du dépôt.

## Vérifications passées

- `npm run typecheck` — 3 workspaces, 0 erreur.
- `npm run test` — 2 988 tests Vitest (`packages/shared`) + 3 215 tests Jest (`apps/mobile`),
  196 suites, **exit 0** (lu sans pipe, cf. l'avertissement de CLAUDE.md).
- `npm run lint` — exit 0.
