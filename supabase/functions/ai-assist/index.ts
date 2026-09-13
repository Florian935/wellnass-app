/**
 * US DASH-01 (§7.1) — `ai-assist` : le **seul** endroit d'où l'app peut parler à un modèle.
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
 *   4. **Taille** — une photo trop lourde est refusée avant d'atteindre le réseau du fournisseur.
 *
 * ── Ce qui n'est pas conservé ────────────────────────────────────────────────────────────────────
 * Ni la photo, ni la question, ni la réponse. `ai_usage` ne porte qu'un **compteur**. C'est ce qui
 * permet à la politique de confidentialité de le dire sans réserve, et à la déclaration Play
 * « Données collectées » de ne pas gagner une catégorie de plus.
 *
 * ── Déploiement (manuel, par un humain) ──────────────────────────────────────────────────────────
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy ai-assist
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.125.0';
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

/**
 * Quotas quotidiens, **miroir** de `AI_DAILY_QUOTA` (`@wellness/shared`). Dupliqués ici parce que la
 * fonction ne partage pas le bundle de l'app : c'est le serveur qui fait foi, le client n'affiche
 * qu'un reste indicatif.
 */
const DAILY_QUOTA: Record<string, number> = { photo: 10, ask: 30 };

/** 4 Mo de base64 ≈ 3 Mo d'image : au-delà, c'est une photo non redimensionnée côté app. */
const MAX_IMAGE_BASE64_BYTES = 4 * 1024 * 1024;
const MAX_PROMPT_CHARS = 4000;

/**
 * Le modèle. Une seule constante, à un seul endroit — changer de modèle ne doit jamais demander de
 * toucher à l'app, qui ne connaît que le nom de la fonction.
 */
const MODEL = 'claude-opus-5';

/** Réponses courtes et structurées : ni l'une ni l'autre des deux tâches n'écrit un paragraphe. */
const MAX_TOKENS = 2048;

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
  "Si la photo ne montre pas de nourriture, réponds {\"items\":[]}.",
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

type AiRequest = {
  kind: 'photo' | 'ask';
  /** `photo` : image encodée en base64 **nue** (sans préfixe `data:`). */
  imageBase64?: string;
  imageMediaType?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** `ask` : la réponse déterministe à reformuler. */
  prompt?: string;
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

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    // Le secret n'est posé que par un humain : sans lui, la fonction refuse proprement plutôt que
    // de laisser le SDK échouer avec un message de fournisseur.
    return json({ error: 'ai_unavailable' }, 503);
  }

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
  if (kind !== 'photo' && kind !== 'ask') return json({ error: 'bad_request' }, 400);

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
  if (kind === 'photo') {
    const image = body.imageBase64 ?? '';
    if (image.length === 0) return json({ error: 'bad_request' }, 400);
    if (image.length > MAX_IMAGE_BASE64_BYTES) return json({ error: 'image_too_large' }, 413);
  } else if ((body.prompt ?? '').trim().length === 0 || (body.prompt ?? '').length > MAX_PROMPT_CHARS) {
    return json({ error: 'bad_request' }, 400);
  }

  // ── L'appel ───────────────────────────────────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey });
  let text: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: kind === 'photo' ? PHOTO_SYSTEM : ASK_SYSTEM,
      messages: [
        kind === 'photo'
          ? {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: body.imageMediaType ?? 'image/jpeg',
                    data: body.imageBase64 ?? '',
                  },
                },
                { type: 'text', text: 'Quels aliments et quelles quantités vois-tu ?' },
              ],
            }
          : { role: 'user', content: body.prompt ?? '' },
      ],
    });

    // Un refus du modèle n'est pas une erreur HTTP : il faut le lire avant le contenu.
    if (response.stop_reason === 'refusal') return json({ error: 'refused' }, 422);

    text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
  } catch (error) {
    // Le message du fournisseur ne remonte jamais au client : il peut contenir des détails d'infra.
    console.error('[ai-assist] appel modèle en échec', error);
    return json({ error: 'ai_failed' }, 502);
  }

  if (text.length === 0) return json({ error: 'ai_failed' }, 502);

  // ── Le compteur, après un appel réussi ────────────────────────────────────────────────────────
  // Incrémenté seulement si le modèle a répondu : un quota consommé par une panne serait une double
  // peine. `upsert` sur l'index unique (user, jour, type).
  const { error: usageError } = await admin
    .from('ai_usage')
    .upsert(
      { user_id: userId, usage_date: usageDate, kind, count: used + 1, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,usage_date,kind' },
    );
  if (usageError) console.error('[ai-assist] compteur de quota non mis à jour', usageError);

  // Le **texte brut** du modèle : c'est le client qui le valide (zod, `parseAiJson`) et qui calcule
  // les calories depuis son catalogue. Rien de ce qui est affiché ne sort d'ici sans être vérifié.
  return json({ text, used: used + 1, quota }, 200);
});
