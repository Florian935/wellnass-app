/**
 * US IA-LAB-01 — les **adaptateurs de fournisseur** de la fonction `ai-assist`.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────────────────────────────
 * `index.ts` porte les gardes (JWT, consentement, quota, taille) ; il ne doit rien savoir du
 * fournisseur. Ici vit la seule chose qui change quand on bascule de Gemini vers Anthropic : la
 * forme de la requête HTTP et l'endroit où lire le texte dans la réponse.
 *
 * C'est la mise en œuvre de `docs/product/ia-integration-analyse.md` §7.4 : **le fournisseur est un
 * réglage**. On explore sur un palier gratuit, on bascule sur le fournisseur cible sans toucher à
 * l'app — qui ne connaît qu'un nom de fonction.
 *
 * ── Pourquoi `fetch` et pas les SDK ──────────────────────────────────────────────────────────────
 * Un SDK par fournisseur, c'est un import `npm:` de plus à démarrage froid pour deux appels REST
 * dont on n'utilise ni le streaming ni les outils. Les deux adaptateurs tiennent en 60 lignes.
 */

/** Les fournisseurs câblés. Le nom est celui attendu dans la variable `AI_PROVIDER`. */
export const AI_PROVIDERS = ['gemini', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export type ProviderRequest = {
  system: string;
  prompt: string;
  maxTokens: number;
  /** Présente uniquement pour `kind: 'photo'`. Base64 **nu**, sans préfixe `data:`. */
  image?: { base64: string; mediaType: MediaType };
};

export type ProviderResult =
  | { ok: true; text: string }
  /**
   * `refused` : le modèle a refusé (garde-fou de sécurité côté fournisseur). Ce n'est pas une panne.
   * `misconfigured` : 4xx de configuration — mauvais identifiant de modèle, clé invalide, projet non
   *   activé. `detail` est **remonté au client**, contrairement à toute autre erreur : voir la note
   *   au-dessus de `classifyHttpError`.
   * `failed` : tout le reste (5xx, réseau, réponse vide, JSON illisible).
   */
  | { ok: false; kind: 'refused' | 'misconfigured' | 'failed'; detail?: string };

export type ProviderConfig = {
  provider: AiProvider;
  model: string;
  apiKey: string;
};

/**
 * Lit la configuration dans l'environnement de la fonction.
 *
 * **Le fournisseur se déduit de la clé présente** quand `AI_PROVIDER` n'est pas posée : c'est ce qui
 * permet de basculer en posant un seul secret, sans avoir à se souvenir d'en poser deux. Gemini
 * passe en premier parce que c'est le palier gratuit — le chemin d'exploration est le chemin par
 * défaut, le payant se demande explicitement.
 *
 * `null` si aucune clé n'est posée : la fonction répond alors `ai_unavailable`, et **rien n'est
 * facturé**. C'est l'état du dépôt tant que personne n'a posé de secret.
 */
export function readProviderConfig(env: (key: string) => string | undefined): ProviderConfig | null {
  const geminiKey = env('GEMINI_API_KEY');
  const anthropicKey = env('ANTHROPIC_API_KEY');

  const declared = env('AI_PROVIDER')?.trim().toLowerCase();
  const provider: AiProvider | null =
    declared === 'gemini' || declared === 'anthropic'
      ? declared
      : geminiKey
        ? 'gemini'
        : anthropicKey
          ? 'anthropic'
          : null;

  if (!provider) return null;

  if (provider === 'gemini') {
    if (!geminiKey) return null;
    return {
      provider,
      // `-latest` et non un numéro de version : Google renomme ses modèles Flash plusieurs fois par
      // an (3.5 → 3.7 → 3.8 en 2026), et un identifiant figé finit en 404 sans que personne n'ait
      // rien changé. `GEMINI_MODEL` permet d'épingler une version précise pour comparer.
      model: env('GEMINI_MODEL')?.trim() || 'gemini-flash-latest',
      apiKey: geminiKey,
    };
  }

  if (!anthropicKey) return null;
  return {
    provider,
    model: env('ANTHROPIC_MODEL')?.trim() || 'claude-sonnet-5',
    apiKey: anthropicKey,
  };
}

/**
 * ⚠️ **Exception délibérée à la règle « le message du fournisseur ne remonte jamais ».**
 *
 * Un 400/401/403/404 d'un fournisseur d'inférence est une erreur de **configuration** — modèle
 * inconnu, clé révoquée, API non activée sur le projet — et son message ne contient jamais de donnée
 * d'utilisateur : il parle de notre projet, pas de la personne qui a posé la question. Le taire
 * transformerait une faute de frappe dans `GEMINI_MODEL` en « l'IA ne marche pas », sans aucun moyen
 * de savoir pourquoi depuis le téléphone.
 *
 * Tout le reste (429, 5xx, réseau) reste opaque : ça, ça peut parler d'infrastructure.
 */
function classifyHttpError(status: number, body: string): ProviderResult {
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return { ok: false, kind: 'misconfigured', detail: body.slice(0, 400) };
  }
  return { ok: false, kind: 'failed' };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Gemini — https://generativelanguage.googleapis.com (v1beta, `generateContent`)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

async function callGemini(config: ProviderConfig, request: ProviderRequest): Promise<ProviderResult> {
  const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
  if (request.image) {
    parts.push({
      inline_data: { mime_type: request.image.mediaType, data: request.image.base64 },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          // Basse mais non nulle : on veut des réponses reproductibles pour comparer deux
          // fournisseurs sur la même question, sans figer la formulation au point de ne plus rien
          // apprendre d'une seconde exécution.
          temperature: 0.4,
        },
      }),
    },
  );

  if (!response.ok) return classifyHttpError(response.status, await response.text());

  const payload = (await response.json()) as GeminiResponse;

  // Un blocage de sécurité n'est pas un échec HTTP chez Gemini : il arrive en 200 avec un candidat
  // vide et une raison. Le lire avant le texte, sinon on renvoie « panne » pour un refus.
  const blocked =
    payload.promptFeedback?.blockReason ??
    (payload.candidates?.[0]?.finishReason === 'SAFETY' ? 'SAFETY' : undefined);
  if (blocked) return { ok: false, kind: 'refused' };

  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();

  return text.length > 0 ? { ok: true, text } : { ok: false, kind: 'failed' };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Anthropic — https://api.anthropic.com/v1/messages
// ─────────────────────────────────────────────────────────────────────────────────────────────────

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string;
};

async function callAnthropic(
  config: ProviderConfig,
  request: ProviderRequest,
): Promise<ProviderResult> {
  const content: Array<Record<string, unknown>> = [];
  if (request.image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: request.image.mediaType, data: request.image.base64 },
    });
  }
  content.push({ type: 'text', text: request.prompt });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) return classifyHttpError(response.status, await response.text());

  const payload = (await response.json()) as AnthropicResponse;
  if (payload.stop_reason === 'refusal') return { ok: false, kind: 'refused' };

  const text = (payload.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim();

  return text.length > 0 ? { ok: true, text } : { ok: false, kind: 'failed' };
}

/** Aiguille vers l'adaptateur. Une panne réseau est un `failed`, jamais une exception qui remonte. */
export async function callProvider(
  config: ProviderConfig,
  request: ProviderRequest,
): Promise<ProviderResult> {
  try {
    return config.provider === 'gemini'
      ? await callGemini(config, request)
      : await callAnthropic(config, request);
  } catch (error) {
    console.error('[ai-assist] appel fournisseur en échec', error);
    return { ok: false, kind: 'failed' };
  }
}
