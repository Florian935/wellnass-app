/**
 * US DASH-01 (§7.1) puis IA-LAB-01, puis PRISME-01 — `ai-assist` : le **seul** endroit d'où l'app peut
 * parler à un modèle.
 *
 * ── Pourquoi une fonction serveur, et pas un appel direct depuis l'app ───────────────────────────
 * Une clé de fournisseur embarquée dans un APK est une clé publique : n'importe qui peut la lire
 * dans le bundle et la dépenser. Elle vit donc dans les secrets du projet Supabase, et l'app n'a
 * jamais que son propre JWT.
 *
 * Quatre gardes, dans cet ordre, et aucun appel au modèle avant que les quatre soient passés :
 *   1. **JWT** — qui appelle ? (Supabase vérifie déjà la signature ; on relit l'utilisateur.)
 *   2. **Consentement** — `ai_consent_at` pour le Labo IA, `prisme_consent_at` **et le fournisseur
 *      auquel il a été donné** pour Prisme (PRISME-01 R6). Sans consentement, rien ne sort.
 *   3. **Taille** — une photo, un texte ou un contexte trop lourds sont refusés avant d'atteindre le
 *      réseau du fournisseur, et avant de consommer le quota.
 *   4. **Quota** — compteur serveur par (utilisateur, jour UTC, type), **réservé atomiquement** avant
 *      l'appel (`ai_reserve_quota`) et rendu si le fournisseur échoue. Compté dans l'app, il suffirait
 *      de réinstaller pour le remettre à zéro ; lu puis écrit, deux appels simultanés passaient.
 *
 * ── Ce qui n'est pas conservé ────────────────────────────────────────────────────────────────────
 * Ni la photo, ni la question, ni le contexte, ni le repas décrit, ni la réponse. `ai_usage` ne porte
 * qu'un **compteur**, et aucun journal ne recopie le contenu d'une réponse de fournisseur.
 *
 * ── Deux fournisseurs, deux réglages (IA-LAB-01, puis PRISME-01 DD1) ─────────────────────────────
 * `providers.ts` porte les adaptateurs.
 *  - Le **Labo IA** (`coach`, et `photo` / `ask` dormants) suit `AI_PROVIDER` — Gemini gratuit
 *    compris, parce qu'il ne voit que des **données factices** (`supabase/scripts/ia-purge-et-dataset.sql`).
 *  - **Prisme** (`narrate`, `meal_text`) suit `PRISME_PROVIDER`, qui **n'accepte que des fournisseurs
 *    qui n'entraînent pas leurs modèles sur nos requêtes** : Prisme envoie de vraies données. Gemini
 *    n'y est jamais autorisé ; Mistral seulement avec `MISTRAL_TRAINING_OPTOUT=verified`.
 *
 * ── Déploiement (manuel, par un humain) ──────────────────────────────────────────────────────────
 *   npx supabase secrets set PRISME_PROVIDER=groq GROQ_API_KEY=...   # Prisme — console.groq.com
 *   # …ou Mistral (en service depuis le 05/10/2026), APRÈS avoir coupé dans admin.mistral.ai ›
 *   # API › Confidentialité « Autoriser l'utilisation de vos appels API pour entraîner… » :
 *   npx supabase secrets set PRISME_PROVIDER=mistral MISTRAL_API_KEY=... MISTRAL_TRAINING_OPTOUT=verified
 *   npx supabase secrets set GEMINI_API_KEY=...                      # Labo IA — palier gratuit
 *   npx supabase functions deploy ai-assist --use-api
 * Sans `MISTRAL_TRAINING_OPTOUT=verified`, `status` répond « indisponible » (`reason: provider`).
 *
 * `npx` : le CLI est une dépendance du projet, pas un binaire global. `--use-api` : sans lui le
 * bundle se fait dans Docker, que personne n'a ici (même contrainte que `db:reset`).
 */

import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import {
  callProvider,
  readPrismeProviderConfig,
  readProviderConfig,
  type MediaType,
  type ProviderConfig,
} from './providers.ts';

/**
 * Quotas quotidiens, **miroir** de `AI_DAILY_QUOTA` (`@wellness/shared`). Dupliqués ici parce que la
 * fonction ne partage pas le bundle de l'app : c'est le serveur qui fait foi, le client n'affiche
 * qu'un reste indicatif.
 *
 * `coach` est plus bas que `ask` alors qu'il est le mode d'exploration : une réponse d'analyse coûte
 * dix fois le contexte d'une reformulation, et le palier gratuit de Gemini plafonne autour de
 * 1 500 appels/jour **pour tout le projet** — un seul testeur ne doit pas pouvoir l'épuiser.
 *
 * PRISME-01 (DD9) — `narrate` et `meal_text` : 6 par jour chacun pendant la bêta. Le palier gratuit
 * est commun à toute la famille.
 */
const DAILY_QUOTA = { photo: 10, ask: 30, coach: 20, narrate: 6, meal_text: 6 } as const;
type QuotaKind = keyof typeof DAILY_QUOTA;

/** 4 Mo de base64 ≈ 3 Mo d'image : au-delà, c'est une photo non redimensionnée côté app. */
const MAX_IMAGE_BASE64_BYTES = 4 * 1024 * 1024;
const MAX_PROMPT_CHARS = 4000;
/** Le contexte agrégé de `coach` et `narrate`. ~8 000 caractères ≈ 2 500 jetons. */
const MAX_CONTEXT_CHARS = 8000;
const MAX_QUESTION_CHARS = 500;
/** PRISME-01 — la consigne d'un bilan (`buildBilanPrompt`) est plus longue qu'une question du labo. */
const MAX_NARRATE_QUESTION_CHARS = 1200;
/** PRISME-01 (R10) — la partie non reconnue d'une phrase de repas, pas plus. */
const MAX_MEAL_TEXT_CHARS = 300;
/** PRISME-01 (DD15) — Prisme est réservé aux 18 ans et plus. */
const ADULT_AGE_YEARS = 18;

/**
 * Budget de sortie par type d'appel.
 *
 * 🔴 **8192 pour `coach`, et ce n'est pas du confort.** Chez Gemini, ce budget est **commun au
 * raisonnement interne et à la réponse** (voir `providers.ts`). À 2048, le modèle épuisait tout en
 * réfléchissant et rendait une réponse **vide** — l'échec constaté à la première recette. Une
 * réponse de 250 mots pèse ~400 jetons : le reste est la marge de raisonnement, et elle doit être
 * généreuse parce qu'on ne contrôle pas vers quel modèle `gemini-flash-latest` pointe.
 *
 * PRISME-01 — `narrate` et `meal_text` ont un budget **à eux** (le défaut de 1 024 tombait dans le même
 * piège avec `gpt-oss-120b`, modèle à raisonnement) ; l'effort de raisonnement est bas côté Groq, et
 * une réponse coupée (`finish_reason: length`) est un échec, jamais un texte passé au garde-fou.
 */
const MAX_TOKENS: Record<QuotaKind, number> = { photo: 2048, ask: 512, coach: 8192, narrate: 1500, meal_text: 1000 };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * La consigne de l'analyse de photo. Elle demande **des aliments et des grammes**, jamais des
 * calories : le calcul calorique se fait côté client à partir du catalogue (R5 de la spec). Un
 * modèle qui donnerait « 640 kcal » produirait un chiffre invérifiable, impossible à corriger en
 * ajustant une portion, et incohérent avec le reste du journal.
 */
const PHOTO_SYSTEM = [
  "Tu es un assistant qui identifie les aliments d'une photo de repas.",
  'Réponds UNIQUEMENT par un objet JSON, sans texte autour, sans bloc de code.',
  'Format : {"items":[{"name":"...","grams":123,"confidence":0.0}]}',
  '- name : le nom courant de l\'aliment, en français, au singulier, sans marque.',
  '- grams : la quantité estimée en grammes, un nombre entier plausible (10 à 1500).',
  '- confidence : ta confiance dans cette ligne, entre 0 et 1.',
  "N'invente pas de calories ni de macronutriments : ils sont calculés ailleurs.",
  'Si la photo ne montre pas de nourriture, réponds {"items":[]}.',
  'Au plus 12 aliments.',
].join('\n');

/**
 * La consigne de reformulation. Le client a **déjà calculé** la réponse ; le modèle ne fait que la
 * dire mieux (§7.3). Il ne doit donc produire aucun nombre qui ne serait pas dans ce qu'on lui
 * donne — c'est la règle qui garantit qu'aucun chiffre affiché ne vient d'un modèle.
 */
const ASK_SYSTEM = [
  'Tu reformules une réponse déjà calculée par une application de sport et de nutrition.',
  'Réponds UNIQUEMENT par un objet JSON : {"headline":"..."}.',
  'headline : une phrase, 140 caractères au maximum, dans la langue du texte fourni.',
  "N'ajoute AUCUN chiffre, AUCUNE donnée et AUCUN conseil qui ne soit pas dans le texte fourni.",
  "Ton neutre et direct. Jamais de culpabilisation, jamais d'injonction médicale.",
].join('\n');

/**
 * La consigne du **labo** (IA-LAB-01). Contrairement aux deux autres, elle autorise le modèle à
 * raisonner sur les chiffres qu'on lui donne : c'est précisément ce qu'on veut évaluer.
 *
 * 🔴 Les garde-fous ne sont pas décoratifs — l'analyse §9 les liste comme le premier risque de cette
 * surface : un assistant sport/nutrition peut produire un conseil faux ou dangereux (blessure,
 * trouble alimentaire, pathologie non connue). Trois règles dures : pas de diagnostic, pas de
 * chiffre inventé, et l'aveu explicite quand la donnée manque.
 */
const COACH_SYSTEM = [
  "Tu es un coach sportif et nutritionnel expérimenté, qui analyse les données d'une personne",
  "dans une application de suivi (musculation, course à pied, alimentation).",
  '',
  'RÈGLES ABSOLUES :',
  "1. N'utilise QUE les chiffres du bloc DONNÉES. N'en invente aucun, n'en extrapole aucun.",
  '   Si une donnée manque pour répondre, dis-le explicitement plutôt que de supposer.',
  '2. Aucun diagnostic médical, aucune prescription. Devant un signe inquiétant (douleur',
  "   persistante, perte de poids rapide, rapport à l'alimentation préoccupant), invite à",
  '   consulter un professionnel de santé, sans dramatiser.',
  "3. Pas de culpabilisation, pas d'injonction. La personne décide ; tu éclaires.",
  '',
  'FORME :',
  '- Réponds en texte simple, dans la langue de la question.',
  '- Va droit au fait : le constat avant le conseil.',
  '- Cite les chiffres sur lesquels tu t\'appuies, pour que la personne puisse vérifier.',
  '- Quand tu recommandes quelque chose, dis à quoi on verra que ça marche.',
  '- 250 mots au maximum.',
].join('\n');

/**
 * PRISME-01 — la voix de **Prisme**. Elle raconte ce que l'app a déjà calculé ; le garde-fou des
 * nombres, côté app, vérifie qu'elle n'a rien inventé (R2). La consigne demande aussi ce que le
 * garde-fou ne peut pas vérifier : ne rien calculer, ne rien recommander d'autre, ne rien reprocher.
 */
const NARRATE_SYSTEM = [
  "Tu es Prisme, l'assistant d'une application de sport et de nutrition. Tu racontes à une personne",
  "ce que l'application a déjà calculé pour elle.",
  '',
  'RÈGLES ABSOLUES :',
  "1. N'utilise QUE les chiffres du bloc DONNÉES, tels quels. N'en calcule aucun : ni écart, ni total,",
  '   ni pourcentage.',
  "2. Ne recommande rien d'autre que la décision ou l'expérience fournie, s'il y en a une.",
  '3. Aucun diagnostic médical, aucune prescription, aucun régime.',
  "4. Pas de culpabilisation, pas d'injonction : tu constates, la personne décide.",
  '',
  'FORME :',
  '- Tutoie la personne. Phrases courtes. Commence par ce qui a été fait.',
  '- Réponds en texte simple, sans titre ni liste, dans la langue de la consigne.',
].join('\n');

/**
 * PRISME-01 — le repas décrit. Miroir de `PHOTO_SYSTEM`, avec deux différences : les noms dans la
 * **langue de l'app** (ils sont rapprochés d'un catalogue traduit), et un plat composé décomposé en
 * ingrédients (« poke bowl saumon avocat » n'est pas dans CIQUAL ; riz, saumon et avocat, si).
 */
function mealTextSystem(lang: 'fr' | 'en'): string {
  const language = lang === 'en' ? 'en anglais' : 'en français';
  return [
    'Tu identifies les aliments décrits par une personne pour un repas.',
    'Réponds UNIQUEMENT par un objet JSON, sans texte autour, sans bloc de code.',
    'Format : {"items":[{"name":"...","grams":123,"confidence":0.0}]}',
    `- name : le nom courant de l'aliment, ${language}, au singulier, sans marque. Un plat composé est décomposé en ses ingrédients principaux.`,
    '- grams : la quantité estimée en grammes, un entier plausible (10 à 1500). Sans quantité précisée, une portion usuelle pour un adulte.',
    '- confidence : ta confiance dans cette ligne, entre 0 et 1.',
    "N'invente pas de calories ni de macronutriments : ils sont calculés ailleurs.",
    'Si le texte ne décrit aucun aliment, réponds {"items":[]}.',
    'Au plus 12 aliments.',
  ].join('\n');
}

const KINDS = ['photo', 'ask', 'coach', 'status', 'consent', 'narrate', 'meal_text'] as const;
type Kind = (typeof KINDS)[number];

type AiRequest = {
  kind: Kind;
  /** `photo` : image encodée en base64 **nue** (sans préfixe `data:`). */
  imageBase64?: string;
  imageMediaType?: MediaType;
  /** `ask` : la réponse déterministe à reformuler. */
  prompt?: string;
  /** `coach`, `narrate` : le contexte agrégé (jamais de journal brut) et la question / consigne. */
  context?: string;
  question?: string;
  /** `consent` : accorder (`true`) ou retirer (`false`) ; `adult` confirme les 18 ans si la date manque. */
  grant?: boolean;
  adult?: boolean;
  /** `meal_text` : la partie non reconnue de la phrase, et la langue de l'app. */
  text?: string;
  lang?: 'fr' | 'en';
};

// deno-lint-ignore no-explicit-any
type Admin = any;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const env = (key: string) => Deno.env.get(key);

/**
 * L'âge déclaré, ou `null` si la date de naissance est inconnue (souvent : elle n'est pas enregistrée
 * à l'inscription et l'onboarding se passe). C'est **déclaratif**, et assumé (spec DD15).
 */
async function readAgeYears(admin: Admin, userId: string): Promise<number | null> {
  const { data } = await admin.from('profiles').select('birth_date').eq('user_id', userId).maybeSingle();
  const birth = typeof data?.birth_date === 'string' ? new Date(`${data.birth_date}T00:00:00Z`) : null;
  if (!birth || Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

async function readPrismeConsent(admin: Admin, userId: string): Promise<{ at: string | null; provider: string | null }> {
  const { data } = await admin
    .from('user_settings')
    .select('prisme_consent_at, prisme_consent_provider')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  return { at: data?.prisme_consent_at ?? null, provider: data?.prisme_consent_provider ?? null };
}

/**
 * PRISME-01 (DD6) — le statut de Prisme : disponibilité, fournisseur, accord, restes du jour.
 * **Gratuit et non décompté** : il n'appelle aucun modèle. Le texte d'accord de l'app est composé à
 * partir d'ici, jamais écrit en dur (R6).
 */
async function prismeStatus(admin: Admin, userId: string, usageDate: string): Promise<Response> {
  const prisme = readPrismeProviderConfig(env);
  const [consent, age, usage] = await Promise.all([
    readPrismeConsent(admin, userId),
    readAgeYears(admin, userId),
    admin.from('ai_usage').select('kind, count').eq('user_id', userId).eq('usage_date', usageDate).in('kind', ['narrate', 'meal_text']),
  ]);

  const used = (kind: 'narrate' | 'meal_text'): number =>
    (usage.data ?? []).find((row: { kind: string; count: number }) => row.kind === kind)?.count ?? 0;
  const remaining = {
    narrate: Math.max(0, DAILY_QUOTA.narrate - used('narrate')),
    meal_text: Math.max(0, DAILY_QUOTA.meal_text - used('meal_text')),
  };

  if (age !== null && age < ADULT_AGE_YEARS) {
    return json({ available: false, reason: 'age', provider: null, consent, remaining }, 200);
  }
  if (!prisme.ok) {
    return json({ available: false, reason: prisme.reason, provider: null, consent, remaining }, 200);
  }
  return json({ available: true, reason: null, provider: prisme.info, consent, remaining }, 200);
}

/**
 * PRISME-01 (DD3) — accorder ou retirer l'accord à Prisme, **par le serveur**. Une écriture locale
 * remonte par PowerSync en différé : le premier « Prisme raconte » juste après « Activer » prendrait
 * un refus. L'accord porte le fournisseur courant ; le retrait efface les deux colonnes.
 */
async function prismeConsent(admin: Admin, userId: string, body: AiRequest, usageDate: string): Promise<Response> {
  let patch: { prisme_consent_at: string | null; prisme_consent_provider: string | null };

  if (body.grant === false) {
    patch = { prisme_consent_at: null, prisme_consent_provider: null };
  } else if (body.grant === true) {
    const prisme = readPrismeProviderConfig(env);
    if (!prisme.ok) return json({ error: 'ai_unavailable', reason: prisme.reason }, 503);
    const age = await readAgeYears(admin, userId);
    if (age !== null && age < ADULT_AGE_YEARS) return json({ error: 'not_allowed', reason: 'age' }, 403);
    if (age === null && body.adult !== true) return json({ error: 'adult_required' }, 400);
    patch = { prisme_consent_at: new Date().toISOString(), prisme_consent_provider: prisme.info.id };
  } else {
    return json({ error: 'bad_request' }, 400);
  }

  const { data, error } = await admin
    .from('user_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('id');
  if (error) {
    console.error('[ai-assist] accord Prisme non enregistré', error.message);
    return json({ error: 'ai_failed' }, 502);
  }
  // Aucune ligne de réglages côté serveur : l'app ne l'a pas encore synchronisée. Rien à accorder.
  if (!data || data.length === 0) return json({ error: 'settings_missing' }, 409);

  return prismeStatus(admin, userId, usageDate);
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  // ── ① Qui appelle ? ───────────────────────────────────────────────────────────────────────────
  // Client « utilisateur » (clé anon + le JWT de l'appelant) pour lire l'identité : c'est la seule
  // façon de ne pas croire l'app sur parole quant à l'utilisateur qu'elle prétend être.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) return json({ error: 'unauthorized' }, 401);

  let body: AiRequest;
  try {
    body = (await request.json()) as AiRequest;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const kind = body.kind;
  if (!(KINDS as readonly string[]).includes(kind)) return json({ error: 'bad_request' }, 400);

  // Client « service » : il contourne la RLS, donc il lit le consentement, écrit l'accord Prisme et
  // réserve le quota. Il ne sert qu'à ça, et sa clé ne quitte jamais cette fonction.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  // Jour **UTC** : le quota est une protection de coût. Le même jour sert à la réservation et à sa
  // restitution, même si minuit tombe entre les deux.
  const usageDate = new Date().toISOString().slice(0, 10);

  // ── PRISME-01 : statut et accord, avant tout contrôle de fournisseur ───────────────────────────
  // `status` doit pouvoir répondre « indisponible » quand rien n'est configuré : c'est justement ce
  // que l'app a besoin de savoir pour ne pas afficher de bouton mort (DD6).
  if (kind === 'status') return prismeStatus(admin, userId, usageDate);
  if (kind === 'consent') return prismeConsent(admin, userId, body, usageDate);

  // ── ② Le fournisseur et le consentement, lus côté serveur ─────────────────────────────────────
  let providerConfig: ProviderConfig;

  if (kind === 'narrate' || kind === 'meal_text') {
    const prisme = readPrismeProviderConfig(env);
    if (!prisme.ok) return json({ error: 'ai_unavailable', reason: prisme.reason }, 503);
    const age = await readAgeYears(admin, userId);
    if (age !== null && age < ADULT_AGE_YEARS) return json({ error: 'not_allowed', reason: 'age' }, 403);
    // L'accord doit avoir été donné **à ce fournisseur** : en changer le redemande (R6).
    const consent = await readPrismeConsent(admin, userId);
    if (!consent.at || consent.provider !== prisme.info.id) return json({ error: 'consent_required' }, 403);
    providerConfig = prisme.config;
  } else {
    // Aucune clé posée = surface éteinte, et **aucun coût**. C'est l'état par défaut du dépôt.
    const config = readProviderConfig(env);
    if (!config) return json({ error: 'ai_unavailable' }, 503);
    const { data: settings } = await admin
      .from('user_settings')
      .select('ai_consent_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!settings?.ai_consent_at) return json({ error: 'consent_required' }, 403);
    providerConfig = config;
  }

  // ── ③ La taille, avant le réseau du fournisseur et avant le quota ─────────────────────────────
  let system: string;
  let prompt: string;
  let image: { base64: string; mediaType: MediaType } | undefined;
  let wantsJson = false;

  if (kind === 'photo') {
    const base64 = body.imageBase64 ?? '';
    if (base64.length === 0) return json({ error: 'bad_request' }, 400);
    if (base64.length > MAX_IMAGE_BASE64_BYTES) return json({ error: 'image_too_large' }, 413);
    system = PHOTO_SYSTEM;
    prompt = 'Quels aliments et quelles quantités vois-tu ?';
    image = { base64, mediaType: body.imageMediaType ?? 'image/jpeg' };
  } else if (kind === 'ask') {
    const text = body.prompt ?? '';
    if (text.trim().length === 0 || text.length > MAX_PROMPT_CHARS) {
      return json({ error: 'bad_request' }, 400);
    }
    system = ASK_SYSTEM;
    prompt = text;
  } else if (kind === 'meal_text') {
    const text = (body.text ?? '').trim();
    if (text.length === 0 || text.length > MAX_MEAL_TEXT_CHARS) return json({ error: 'bad_request' }, 400);
    system = mealTextSystem(body.lang === 'en' ? 'en' : 'fr');
    prompt = text;
    wantsJson = true;
  } else {
    // `coach` et `narrate` : un contexte agrégé et une question (labo) ou une consigne (bilan).
    const context = body.context ?? '';
    const question = body.question ?? '';
    const maxQuestion = kind === 'narrate' ? MAX_NARRATE_QUESTION_CHARS : MAX_QUESTION_CHARS;
    if (question.trim().length === 0 || question.length > maxQuestion) {
      return json({ error: 'bad_request' }, 400);
    }
    if (context.length > MAX_CONTEXT_CHARS) return json({ error: 'context_too_large' }, 413);
    system = kind === 'narrate' ? NARRATE_SYSTEM : COACH_SYSTEM;
    // La question **après** les données : un modèle suit mieux une consigne placée en dernier, et
    // ça évite qu'une question longue noie le contexte chiffré au-dessus d'elle.
    prompt =
      kind === 'narrate' ? `DONNÉES\n${context}\n\nCONSIGNE\n${question}` : `DONNÉES\n${context}\n\nQUESTION\n${question}`;
  }

  // ── ④ Le quota, réservé avant l'appel ─────────────────────────────────────────────────────────
  const quota = DAILY_QUOTA[kind];
  const { data: reserved, error: reserveError } = await admin.rpc('ai_reserve_quota', {
    p_user: userId,
    p_kind: kind,
    p_quota: quota,
    p_day: usageDate,
  });
  if (reserveError) {
    console.error('[ai-assist] réservation du quota impossible', reserveError.message);
    return json({ error: 'ai_failed' }, 502);
  }
  if (reserved === null || reserved === undefined) return json({ error: 'quota_exceeded', quota, used: quota }, 429);

  // ── L'appel ───────────────────────────────────────────────────────────────────────────────────
  const result = await callProvider(providerConfig, {
    system,
    prompt,
    maxTokens: MAX_TOKENS[kind],
    ...(image ? { image } : {}),
    ...(wantsJson ? { json: true } : {}),
  });

  if (!result.ok) {
    // Un quota consommé par une panne serait une double peine : la réservation est rendue.
    const { error: releaseError } = await admin.rpc('ai_release_quota', {
      p_user: userId,
      p_kind: kind,
      p_day: usageDate,
    });
    if (releaseError) console.error('[ai-assist] quota non rendu', releaseError.message);

    if (result.kind === 'refused') return json({ error: 'refused' }, 422);
    if (result.kind === 'misconfigured') {
      // Voir `classifyHttpError` : le détail d'une erreur de configuration remonte volontairement,
      // parce qu'il parle de notre projet et jamais de l'utilisateur. Sans lui, une faute de frappe
      // dans `GEMINI_MODEL` est indiscernable d'une panne depuis le téléphone.
      console.error('[ai-assist] configuration fournisseur invalide', result.detail);
      return json(
        { error: 'ai_misconfigured', provider: providerConfig.provider, detail: result.detail },
        502,
      );
    }
    // Le `detail` d'un échec est **facultatif** et n'est rempli que par des cas où il décrit le
    // comportement du MODÈLE (réponse vide, raison d'arrêt), jamais l'infrastructure ni
    // l'utilisateur. Le taire rendrait ces cas indiagnosticables depuis le téléphone — c'est ce qui
    // a coûté une passe de recette le 16/09/2026.
    console.error('[ai-assist] appel modèle en échec', result.detail ?? '');
    return result.detail
      ? json({ error: 'ai_failed', detail: result.detail }, 502)
      : json({ error: 'ai_failed' }, 502);
  }

  // Le **texte brut** du modèle. Pour `photo`, `ask` et `meal_text`, c'est le client qui le valide
  // (zod, `parseAiJson`) et qui calcule les calories depuis son catalogue ; pour `narrate`, le garde-fou
  // des nombres le relit contre le dossier (PRISME-01 R2) ; pour `coach`, il est affiché tel quel,
  // **dans le labo uniquement** : c'est une surface d'évaluation, et c'est la sortie brute qu'on juge.
  //
  // `provider` et `model` sont renvoyés pour dire **qui a répondu** : comparer deux fournisseurs sans
  // le savoir à l'écran n'aurait aucune valeur, et l'analytique de Prisme compte les refus par
  // fournisseur.
  return json(
    {
      text: result.text,
      used: reserved,
      quota,
      provider: providerConfig.provider,
      model: providerConfig.model,
    },
    200,
  );
});
