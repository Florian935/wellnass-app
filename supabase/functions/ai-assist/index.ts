/**
 * US DASH-01 (§7.1) puis IA-LAB-01 — `ai-assist` : le **seul** endroit d'où l'app peut parler à un
 * modèle.
 *
 * ── Pourquoi une fonction serveur, et pas un appel direct depuis l'app ───────────────────────────
 * Une clé de fournisseur embarquée dans un APK est une clé publique : n'importe qui peut la lire
 * dans le bundle et la dépenser. Elle vit donc dans les secrets du projet Supabase, et l'app n'a
 * jamais que son propre JWT.
 *
 * Quatre gardes, dans cet ordre, et aucun appel au modèle avant que les quatre soient passés :
 *   1. **JWT** — qui appelle ? (Supabase vérifie déjà la signature ; on relit l'utilisateur.)
 *   2. **Consentement** — `user_settings.ai_consent_at` non nul. Sans consentement, rien ne sort.
 *   3. **Quota** — compteur serveur par (utilisateur, jour UTC, type). Compté dans l'app, il
 *      suffirait de réinstaller pour le remettre à zéro.
 *   4. **Taille** — une photo ou un contexte trop lourds sont refusés avant d'atteindre le réseau
 *      du fournisseur.
 *
 * ── Ce qui n'est pas conservé ────────────────────────────────────────────────────────────────────
 * Ni la photo, ni la question, ni le contexte, ni la réponse. `ai_usage` ne porte qu'un **compteur**.
 * C'est ce qui permet à la politique de confidentialité de le dire sans réserve, et à la déclaration
 * Play « Données collectées » de ne pas gagner une catégorie de plus.
 *
 * ── Le fournisseur est un réglage (IA-LAB-01, analyse §7.4) ──────────────────────────────────────
 * `providers.ts` porte les adaptateurs ; ce fichier ne sait pas qui répond. `AI_PROVIDER=gemini`
 * (palier gratuit, exploration) ou `anthropic` (cible, payant) — sans rien changer dans l'app.
 *
 * 🔴 **Le palier gratuit de Gemini peut utiliser les requêtes pour entraîner ses modèles.** Il ne
 * doit donc voir que des **données factices** : voir `supabase/scripts/ia-purge-et-dataset.sql` et
 * `docs/product/ia-integration-analyse.md` §7.2.
 *
 * ── Déploiement (manuel, par un humain) ──────────────────────────────────────────────────────────
 *   npx supabase secrets set GEMINI_API_KEY=...          # palier gratuit — aistudio.google.com
 *   npx supabase functions deploy ai-assist --use-api
 *
 * `npx` : le CLI est une dépendance du projet, pas un binaire global. `--use-api` : sans lui le
 * bundle se fait dans Docker, que personne n'a ici (même contrainte que `db:reset`).
 */

import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { callProvider, readProviderConfig, type MediaType } from './providers.ts';

/**
 * Quotas quotidiens, **miroir** de `AI_DAILY_QUOTA` (`@wellness/shared`). Dupliqués ici parce que la
 * fonction ne partage pas le bundle de l'app : c'est le serveur qui fait foi, le client n'affiche
 * qu'un reste indicatif.
 *
 * `coach` est plus bas que `ask` alors qu'il est le mode d'exploration : une réponse d'analyse coûte
 * dix fois le contexte d'une reformulation, et le palier gratuit de Gemini plafonne autour de
 * 1 500 appels/jour **pour tout le projet** — un seul testeur ne doit pas pouvoir l'épuiser.
 */
const DAILY_QUOTA: Record<string, number> = { photo: 10, ask: 30, coach: 20 };

/** 4 Mo de base64 ≈ 3 Mo d'image : au-delà, c'est une photo non redimensionnée côté app. */
const MAX_IMAGE_BASE64_BYTES = 4 * 1024 * 1024;
const MAX_PROMPT_CHARS = 4000;
/** Le contexte agrégé de `coach`. ~8 000 caractères ≈ 2 500 jetons : large pour 90 jours résumés. */
const MAX_CONTEXT_CHARS = 8000;
const MAX_QUESTION_CHARS = 500;

/** Réponses courtes et structurées pour `photo`/`ask` ; `coach` a le droit de développer. */
const MAX_TOKENS: Record<string, number> = { photo: 2048, ask: 512, coach: 2048 };

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

type AiRequest = {
  kind: 'photo' | 'ask' | 'coach';
  /** `photo` : image encodée en base64 **nue** (sans préfixe `data:`). */
  imageBase64?: string;
  imageMediaType?: MediaType;
  /** `ask` : la réponse déterministe à reformuler. */
  prompt?: string;
  /** `coach` : le contexte agrégé (jamais de journal brut) et la question. */
  context?: string;
  question?: string;
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Aucune clé posée = surface éteinte, et **aucun coût**. C'est l'état par défaut du dépôt.
  const providerConfig = readProviderConfig((key) => Deno.env.get(key));
  if (!providerConfig) return json({ error: 'ai_unavailable' }, 503);

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
  if (kind !== 'photo' && kind !== 'ask' && kind !== 'coach') {
    return json({ error: 'bad_request' }, 400);
  }

  // ── ② Le consentement, lu côté serveur ────────────────────────────────────────────────────────
  // Client « service » : il contourne la RLS, donc il lit le consentement et écrit le quota. Il ne
  // sert qu'à ça, et sa clé ne quitte jamais cette fonction.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data: settings } = await admin
    .from('user_settings')
    .select('ai_consent_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!settings?.ai_consent_at) return json({ error: 'consent_required' }, 403);

  // ── ③ Le quota, du jour UTC ───────────────────────────────────────────────────────────────────
  const usageDate = new Date().toISOString().slice(0, 10);
  const quota = DAILY_QUOTA[kind] ?? 0;

  const { data: usage } = await admin
    .from('ai_usage')
    .select('id, count')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .eq('kind', kind)
    .maybeSingle();

  const used = usage?.count ?? 0;
  if (used >= quota) return json({ error: 'quota_exceeded', quota, used }, 429);

  // ── ④ La taille, avant le réseau du fournisseur ───────────────────────────────────────────────
  let system: string;
  let prompt: string;
  let image: { base64: string; mediaType: MediaType } | undefined;

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
  } else {
    const context = body.context ?? '';
    const question = body.question ?? '';
    if (question.trim().length === 0 || question.length > MAX_QUESTION_CHARS) {
      return json({ error: 'bad_request' }, 400);
    }
    if (context.length > MAX_CONTEXT_CHARS) return json({ error: 'context_too_large' }, 413);
    system = COACH_SYSTEM;
    // La question **après** les données : un modèle suit mieux une consigne placée en dernier, et
    // ça évite qu'une question longue noie le contexte chiffré au-dessus d'elle.
    prompt = `DONNÉES\n${context}\n\nQUESTION\n${question}`;
  }

  // ── L'appel ───────────────────────────────────────────────────────────────────────────────────
  const result = await callProvider(providerConfig, {
    system,
    prompt,
    maxTokens: MAX_TOKENS[kind] ?? 1024,
    ...(image ? { image } : {}),
  });

  if (!result.ok) {
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
    console.error('[ai-assist] appel modèle en échec');
    return json({ error: 'ai_failed' }, 502);
  }

  // ── Le compteur, après un appel réussi ────────────────────────────────────────────────────────
  // Incrémenté seulement si le modèle a répondu : un quota consommé par une panne serait une double
  // peine. `upsert` sur l'index unique (user, jour, type).
  const { error: usageError } = await admin.from('ai_usage').upsert(
    {
      user_id: userId,
      usage_date: usageDate,
      kind,
      count: used + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,usage_date,kind' },
  );
  if (usageError) console.error('[ai-assist] compteur de quota non mis à jour', usageError);

  // Le **texte brut** du modèle. Pour `photo` et `ask`, c'est le client qui le valide (zod,
  // `parseAiJson`) et qui calcule les calories depuis son catalogue — rien de ce qui est affiché ne
  // sort d'ici sans être vérifié. Pour `coach`, le texte est affiché tel quel, **dans le labo
  // uniquement** : c'est une surface d'évaluation, et c'est justement la sortie brute qu'on juge.
  //
  // `provider` et `model` sont renvoyés pour que le labo dise **qui a répondu** : comparer deux
  // fournisseurs sans le savoir à l'écran n'aurait aucune valeur.
  return json(
    {
      text: result.text,
      used: used + 1,
      quota,
      provider: providerConfig.provider,
      model: providerConfig.model,
    },
    200,
  );
});
