# Plan — PRISME-01 · Prisme raconte

Spec : [prisme01-prisme-raconte.md](../specs/functional/us/prisme01-prisme-raconte.md) · 02/10/2026,
révisé après relecture le même jour · branche `feature/prisme01-prisme-raconte` · analyse :
[analyse-assistant-prisme-2026-10.md](../product/analyse-assistant-prisme-2026-10.md).

Un seul lot de recette, huit étapes. Les briques pures d'abord, le serveur ensuite, les écrans en
dernier — même ordre que NARR-01 et IA-LAB-01.

## Ordre de build

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | **Contrats partagés** : types d'appel, `PrismeStatus`, quotas miroir, besoin d'accord | `packages/shared/src/ai-assist.ts`, `settings.ts`, `index.ts` | `ai-assist.test.ts` (+ `status` validé par zod, `needsPrismeConsent`) |
| 2 | **Les dossiers** du soir et de la semaine, liste blanche | `packages/shared/src/prisme-dossiers.ts` **(neuf)** | `prisme-dossiers.test.ts` **(neuf)**, dont le test-garde de liste blanche |
| 3 | **Le garde-fou** : langue, longueur par usage, invites | `packages/shared/src/ai-narration.ts` | `ai-narration.test.ts` (+ cas FR / EN, § Étape 3) |
| 4 | **Humeur basse en cours** : prédicat sans délai ni fermeture | `packages/shared/src/wellbeing.ts` | `wellbeing.test.ts` (+ cas) |
| 5 | **Migration** : accord Prisme, réservation atomique du quota | `supabase/migrations/<horodatage>_prisme_consent_quota.sql`, `apps/mobile/src/powersync/schema.ts`, `apps/mobile/src/data/repositories/settings-repository.ts` | — (SQL), recette § Étape 6 |
| 6 | **Serveur** : `status`, `consent`, `narrate`, `meal_text`, `PRISME_PROVIDER`, adaptateur compatible OpenAI, âge, quotas réservés | `supabase/functions/ai-assist/index.ts`, `providers.ts` | recette par appels réels (Deno hors runner) |
| 7 | **Plomberie app** : client, statut, accord, identité de Prisme | `lib/ai/ai-client.ts`, `lib/ai/prisme.ts` **(neuf)**, `stores/prisme-store.ts` **(neuf)**, `components/prisme/*` **(neuf)**, `app/settings.tsx` | `ai-client.test.ts`, `prisme.test.ts`, tests de composants |
| 8 | **Les surfaces** : carte du soir, bilan hebdo, recours de la saisie rapide ; i18n, analytics, docs | `components/dashboard/EveningCard.tsx` **(neuf)**, `hooks/useEveningFacts.ts` **(neuf)**, `app/(tabs)/index.tsx`, `app/review.tsx`, `app/meal-quick-entry.tsx`, `i18n/locales/{fr,en}.json`, `lib/analytics.ts` | tests d'écran, `locale-parity.test.ts` |

## Étape 1 — les contrats partagés

- `AI_DAILY_QUOTA = { photo: 10, ask: 30, coach: 20, narrate: 6, meal_text: 6 }` — **miroir** de
  `DAILY_QUOTA` dans la fonction (commentaire de garde existant). `photo` et `ask` restent dormants.
- `PrismeStatus` (zod) : `{ available: boolean, reason?: 'provider' | 'age' | 'unconfigured',
  provider: { id, label, country, trains: false, retention: string } | null,
  consent: { at: string | null, provider: string | null }, remaining: { narrate, meal_text } }`.
  `trains` est le littéral `false` : un fournisseur qui entraîne n'est jamais renvoyé disponible.
- `needsPrismeConsent(local, status)` : vrai si `prisme_consent_at` est nul **ou** si
  `prisme_consent_provider !== status.provider.id`.
- `settings.ts` : `prismeConsentAt`, `prismeConsentProvider`.

## Étape 2 — les dossiers

```ts
export type EveningFacts = {
  dayLabel: string;
  sessions: readonly { type: 'strength' | 'run' | 'other'; minutes: number; tonnageKg?: number;
    setsDone?: number; setsPlanned?: number; records?: number; distanceKm?: number; paceSPerKm?: number }[];
  plate: { kcal: number; targetKcal: number | null; kcalGap: number | null; proteinG: number;
    targetProteinG: number | null; proteinGap: number | null; carbsG: number; meals: number } | null;
  week: { done: number; goal: number } | null;
  tomorrow: { type: 'strength' | 'run' | 'other'; time: string | null; distanceKm: number | null } | null;
  realLife: boolean;
};
export function buildEveningDossier(facts: EveningFacts, t: Translate): NarrationDossier;
export function eveningFingerprint(facts: EveningFacts): string; // « ta journée a bougé »
export function buildWeekDossier(review: WeeklyReview, goals: readonly WeekGoal[],
  activePillars: ActivePillars, t: Translate): NarrationDossier;
```

- Réutilise `NarrationDossier` (NARR-01) : garde-fou et `dossierNumbers` marchent tels quels.
- **Les écarts** (`kcalGap`, `proteinGap`) sont calculés par l'appelant, avec la même règle que
  l'affichage : sans eux, « il te manque 32 g » serait refusé (spec R5).
- **Test-garde de liste blanche** : les clés de `EveningFacts` et de `WeekGoal` sont figées dans le
  test ; aucun champ texte libre (titre, nom, note) n'y figure. En ajouter un fait échouer le test avec
  un renvoi à la spec R4 (patron de `ai-context.test.ts`).
- `WeekGoal` = `{ type, ratioPct }` : le type d'objectif, jamais son nom saisi.
- Un pilier inactif ne produit aucune ligne (pas de zéros, IA-LAB-01 R5).

## Étape 3 — le garde-fou

- `extractNumbers(text, lang)` : en `en`, la virgule suivie de trois chiffres est un séparateur de
  milliers (« 12,480 » → 12 480) ; en `fr`, elle reste décimale. Les espaces (fines, insécables) restent
  des séparateurs de milliers dans les deux langues.
- `checkNarration(text, allowed, { lang, maxChars })` : `maxChars` 400 pour un dossier (défaut, NARR-01
  et CONS-01 inchangés), 500 pour les bilans.
- `buildNarrationPrompt` gagne les variantes `evening` et `week` : « n'emploie QUE ces chiffres » ;
  « ne calcule aucune différence » ; « ne propose rien d'autre que la décision indiquée » (R16) ;
  « journée en mode vie réelle : aucun reproche » (R12).
- Cas de test ajoutés : « 2 140 kcal » (espace fine), « 6 h 05 », « 118 g sur 150 g », « 68 % » contre
  `0.68`, un écart non fourni (« il te manque 32 g » sans 32 dans le dossier) → refusé, et en anglais
  « 12,480 kg » accepté contre 12 480, « 12,900 kg » refusé.

## Étape 4 — l'humeur basse en cours

`isLowMoodOngoing(rows, todayKey)` : le seuil de `shouldShowLowMoodCard` (5 humeurs à 1-2 parmi les 7
dernières notées sur 14 jours) **sans** le délai de 14 jours ni la fermeture de la carte.
`shouldShowLowMoodCard` l'appelle, puis applique son délai : une seule définition du seuil. Tests : seuil
atteint et carte fermée → vrai ; carte montrée il y a 3 jours → vrai.

## Étape 5 — la migration

```sql
alter table public.user_settings
  add column if not exists prisme_consent_at timestamptz,
  add column if not exists prisme_consent_provider text;

-- Réserve une unité de quota, atomiquement. Renvoie le nouveau compte, ou null si le plafond est atteint.
create or replace function public.ai_reserve_quota(p_user uuid, p_kind text, p_quota int)
  returns int language plpgsql security definer set search_path = public as $$ … $$;
create or replace function public.ai_release_quota(p_user uuid, p_kind text)
  returns void language plpgsql security definer set search_path = public as $$ … $$;
revoke all on function public.ai_reserve_quota(uuid, text, int) from public, anon, authenticated;
revoke all on function public.ai_release_quota(uuid, text) from public, anon, authenticated;
```

- `ai_reserve_quota` : `insert … on conflict (user_id, usage_date, kind) do update set count =
  ai_usage.count + 1 where ai_usage.count < p_quota returning count` — une seule instruction, donc
  aucune course entre deux appels.
- Cycle sans Docker du CLAUDE.md : `db:new` → `db:push:dry` → `db:push` → `db:types` → registre
  `MIGRATIONS.md`.
- `schema.ts` : deux colonnes texte, avec le commentaire de garde CYCLE-01 (huitième et neuvième de la
  table). `settings-repository.ts` : le mappage camelCase ↔ snake_case aux quatre endroits où vit
  `ai_consent_at` (lecture, écriture, valeurs par défaut, sérialisation).
- PowerSync : `select *` — pas de sync rule à coller ; **contrôler dans le dashboard** que les colonnes
  remontent (DASH-01 §8).

## Étape 6 — le serveur

Ordre de traitement :

1. `OPTIONS`, méthode ;
2. JWT ;
3. **`status`** et **`consent`** — avant tout contrôle de fournisseur (aujourd'hui, l'absence de
   fournisseur répond 503 avant le JWT) ;
4. fournisseur du **type d'appel** : `coach` → `AI_PROVIDER` (inchangé) ; `narrate`, `meal_text` →
   `PRISME_PROVIDER`, **refusé** s'il n'est pas dans la liste des autorisés (`groq`, `anthropic`,
   `mistral` seulement avec `MISTRAL_TRAINING_OPTOUT=verified`) ;
5. âge : `profiles.birth_date` connue et < 18 ans → `not_allowed` (`age`) ;
6. accord : `coach` → `ai_consent_at` ; `narrate`, `meal_text` → `prisme_consent_at` et
   `prisme_consent_provider` = fournisseur courant, sinon `consent_required` ;
7. taille (`meal_text` ≤ 300 caractères ; contexte ≤ 8 000) ;
8. **réservation du quota** (`ai_reserve_quota`) ; `null` → `quota_exceeded` ;
9. appel ; en cas d'échec, `ai_release_quota`.

**`consent`** : `{ kind: 'consent', grant: true, adult: boolean }` écrit `prisme_consent_at = now()` et
`prisme_consent_provider` = fournisseur courant, par le client de service ; refusé si le fournisseur
n'est pas autorisé, ou si la date de naissance est inconnue et `adult` n'est pas vrai. Renvoie le statut.

**Adaptateur compatible OpenAI** (dans `providers.ts`, sans dépendance) :

- préréglages `groq` (`https://api.groq.com/openai/v1/chat/completions`, `GROQ_API_KEY`, `GROQ_MODEL`,
  défaut à confirmer au code — `openai/gpt-oss-120b`) et `mistral`
  (`https://api.mistral.ai/v1/chat/completions`, `MISTRAL_API_KEY`, `MISTRAL_MODEL`, défaut
  `mistral-small-latest`) ; les identifiants bougent (leçon IA-LAB-01 §3.1) ;
- **budgets de sortie par type** (`narrate` 1 500, `meal_text` 1 000) et, pour un modèle à raisonnement,
  un effort de raisonnement bas : le piège Gemini du 16/09 (budget mangé par le raisonnement, réponse
  vide) vaut pour `gpt-oss-120b` ;
- `finish_reason: 'length'` → échec `truncated`, jamais un texte coupé passé au garde-fou ;
- `response_format: { type: 'json_object' }` pour `meal_text` ; un 400 de validation JSON du
  fournisseur (Groq `json_validate_failed`, qui recopie la génération) est un **échec masqué** : ni
  détail renvoyé, ni contenu journalisé (spec R11). À vérifier sur le vrai fournisseur au code.

**Consignes système** : `NARRATE_SYSTEM` (voix de Prisme : tutoiement, constat d'abord, aucun chiffre
hors données, aucune différence calculée, aucune recommandation hors décision fournie, aucun diagnostic,
aucune culpabilisation, langue du texte fourni) et `MEAL_TEXT_SYSTEM` (miroir de `PHOTO_SYSTEM` :
aliments et grammes en JSON, **noms dans la langue indiquée**, portion usuelle quand la quantité est
implicite, jamais de calories, 12 aliments au plus).

**Recette serveur** (pas de runner Deno) — suite d'appels `curl` écrite dans RECETTES : `status` sans
fournisseur ; `status` avec `PRISME_PROVIDER=gemini` (indisponible) ; `narrate` sans accord (403) ;
`consent` puis `narrate` ; accord donné à un autre fournisseur (403) ; deux `narrate` simultanés au
dernier quota (un seul passe) ; `meal_text` de 301 caractères (400) ; compte de moins de 18 ans (403).

## Étape 7 — la plomberie de l'app

- `ai-client.ts` : types `status`, `consent`, `narrate`, `meal_text` ; codes `not-allowed`,
  `truncated`.
- `prisme-store.ts` (Zustand, mémoire) : dernier `status` de la session ; textes du soir et de la
  semaine indexés par jour / semaine **et** empreinte ; verrou d'appel en cours (un double appui ne
  part qu'une fois). Rien sur disque.
- `lib/ai/prisme.ts` : `tellEvening`, `tellWeek` (dossier → `narrate` → garde-fou → issue),
  `askMeal` (texte non reconnu → `meal_text` → `parseAiJson`, coupé à 12 **avant** validation →
  rapprochement par `bestMatchIndex` / `rankFoodMatches`, comme la saisie locale). Sur
  `consent_required` : relire `status`, rouvrir la feuille. Erreurs traduites en `prisme.errors.*`.
- `mealPhotoResultSchema` : la borne `.max(12)` jette aujourd'hui toute réponse plus longue ; on coupe
  la liste avant de valider plutôt que de modifier le schéma de la photo (dormante).
- `usePrismeVisibility()` (entrée visible : accord donné ou à donner, dernier statut connu disponible,
  majeur) et `usePrismeCallable()` (réseau présent) — **deux** notions (spec DD7).
- `components/prisme/` : `PrismeMark` (décoratif), `PrismeTell` (bouton → lecture → texte vérifié ou
  refus, région vivante, « D'où ça vient »), `PrismeConsentSheet` (textes composés depuis `status` :
  nom, pays, `trains`, `retention` ; case « 18 ans ou plus » si la date est absente),
  `PrismeSettingsSection` (accord, fournisseur, ce qui part, retrait — local, marche hors ligne).
- **Développement seulement** (`__DEV__`) : une option « simuler un chiffre inventé » qui remplace la
  réponse par un texte contenant un nombre absent, pour recetter le refus (spec critère 8).

## Étape 8 — les surfaces

- **Carte du soir** `EveningCard`, zone 1 de l'accueil, `dayMoment(hour) === 'evening'`.
  `useEveningFacts` assemble les faits (séances terminées du jour, journal et cibles avec leurs écarts,
  objectif de semaine, planning de demain, mode vie réelle) — **ni pas, ni nuit, ni bien-être**. Pas de
  carte si aucun fait ; pas de bouton si `isLowMoodOngoing`.
- **Bilan hebdo** : `PrismeTell` **sous** les chiffres ; dossier `buildWeekDossier(review, goals,
  activePillars)`, avec les objectifs et piliers que l'écran lit déjà.
- **Saisie rapide** (`meal-quick-entry.tsx`) : sous les lignes « non trouvé », « Demander à Prisme »
  avec le texte exact qui part ; les lignes rendues remplacent les non trouvées dans la même revue ;
  « Ajouter » reste le seul geste qui écrit.
- **i18n** : bloc `prisme` FR + EN.
- **Analytics** (si accepté) : `prisme_told`, `prisme_rejected`, `prisme_meal_asked`, avec deux
  propriétés ajoutées à `ALLOWED_PROP_KEYS` : `provider` (identifiant technique) et `surface`
  (`evening` | `week` | `meal`). Sans elles, le taux de refus ne se compare pas d'un fournisseur à
  l'autre.
- **Docs** : RECETTES (critères de la spec §14 + suite `curl` + grille de ton du critère 12),
  front-matter, CHANGELOG, roadmap, ETAT.

**Grille de ton (critère 12)** : sur trois tirages en mode vie réelle, aucun texte ne contient
« devrais », « dois », « il faut », « oublié », « rattraper », « manqué », « dommage », ni leur
équivalent anglais. La grille n'est pas un test automatique : c'est une aide de recette.

## Ce qui n'est PAS touché

- Le **Labo IA** : son écran, son accord, `AI_PROVIDER`, le type `coach` — sauf la réservation atomique
  du quota, qui le protège aussi.
- **NARR-01 et CONS-01** : en recette, ils gardent `coach` et l'accord du Labo IA (spec Q1).
- `buildWeeklyReview`, `buildLabQuestions`, `buildMorningBrief`, `parseMealText` : aucun calcul
  nouveau ; on les lit.
- La photo (PRISME-02), l'accès testeurs (ACCES-IA), RevenueCat (D6).

## Risques

| Risque | Parade |
|---|---|
| Faux refus du garde-fou sur des textes justes | Cas de test de l'étape 3 ; mesurer `prisme_rejected` par fournisseur avant d'élargir |
| Palier gratuit épuisé par la famille | Quotas réservés atomiquement ; `status` montre les restes ; bascule de fournisseur par variable |
| Modèle gratuit faible en français | Comparer Groq et Mistral sur les mêmes dossiers (dossiers factices dans le Labo IA) avant d'ouvrir |
| Prisme dans le build Play avant ACCES-IA et la mise à jour de la politique | Spec §11 : exclusion du build de soumission |

## Effort

1,5 à 2 semaines en un seul lot de recette, après le retrait de la photo, de l'accès testeurs et du
second accord. Aucune dépendance native : recettable en dev client + Metro, sauf la migration et le
déploiement de la fonction (gestes humains).
