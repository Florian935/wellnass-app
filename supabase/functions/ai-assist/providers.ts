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
 * La réponse d'erreur d'un fournisseur d'inférence décrit **son** service et **notre** configuration
 * — modèle inconnu, clé révoquée, quota épuisé, panne de son côté. Elle ne contient jamais de donnée
 * de la personne qui a posé la question : celle-ci est dans la requête, pas dans l'erreur.
 *
 * 🔴 **Aucun échec ne doit être muet.** La première version ne remontait le détail que pour les
 * 4xx de configuration ; tout le reste tombait dans un `failed` sans information, et deux passes de
 * recette y sont passées (16/09/2026). Un 429 « quota épuisé » et une panne 503 appellent des gestes
 * opposés — attendre, ou alerter — et rien à l'écran ne permettait de les distinguer.
 *
 * Le **code** reste distinct : `misconfigured` pour ce qu'on peut corriger nous-mêmes (4xx),
 * `failed` pour ce qu'on subit (429, 5xx). Seul le détail devient systématique.
 */
/**
 * Codes qui méritent une seconde chance, et pas une erreur à l'écran.
 *
 * 🔴 **Constaté en recette le 17/09/2026** : Gemini renvoie `503 UNAVAILABLE — "This model is
 * currently experiencing high demand"` de façon intermittente sur le palier gratuit. Rien de cassé
 * chez nous, rien à corriger : le modèle est saturé pendant quelques secondes. Afficher une erreur
 * pour ça, c'est transformer un hoquet de trois secondes en échec de fonctionnalité.
 *
 * `429` y figure aussi : le palier gratuit plafonne à ~10 requêtes/minute, et deux questions posées
 * coup sur coup suffisent à le toucher. Les 5xx sont des pannes passagères du fournisseur.
 *
 * ⚠️ **Les 4xx de configuration n'y sont PAS.** Une clé invalide le restera à la troisième
 * tentative : réessayer ne ferait que retarder un message qu'il faut lire tout de suite.
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Trois tentatives au total. Au-delà, ce n'est plus un hoquet, et l'attente devient visible. */
const MAX_ATTEMPTS = 3;

/**
 * Attente avant la tentative `n`, en millisecondes : 700, puis 1400. Exponentielle, avec une part
 * aléatoire — sans elle, deux appareils qui butent sur la même saturation repartiraient exactement
 * en même temps et la prolongeraient.
 */
function backoffMs(attempt: number): number {
  return 700 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}

/**
 * `fetch` avec reprise sur les codes transitoires. Seul le **statut** décide : le corps de la
 * réponse n'est pas lu ici, il doit rester consommable par l'appelant.
 *
 * Renvoie aussi le nombre de tentatives, pour que le message d'erreur final puisse dire « après
 * 3 essais » — un échec après une seule tentative et un échec après trois n'appellent pas le même
 * geste de la part de celui qui le lit.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<{ response: Response; attempts: number }> {
  let attempt = 1;
  for (;;) {
    const response = await fetch(url, init);
    if (!RETRYABLE_STATUS.has(response.status) || attempt >= MAX_ATTEMPTS) {
      return { response, attempts: attempt };
    }
    console.warn(`[ai-assist] ${response.status} du fournisseur, tentative ${attempt}/${MAX_ATTEMPTS}`);
    await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
    attempt += 1;
  }
}

function classifyHttpError(status: number, body: string, attempts = 1): ProviderResult {
  const detail =
    `HTTP ${status}` +
    (attempts > 1 ? ` après ${attempts} tentatives` : '') +
    ` — ${body.slice(0, 350)}`;
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return { ok: false, kind: 'misconfigured', detail: body.slice(0, 400) };
  }
  return { ok: false, kind: 'failed', detail };
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
  usageMetadata?: { thoughtsTokenCount?: number; candidatesTokenCount?: number };
};

/**
 * 🔴 **Le piège qui a fait échouer la première recette (16/09/2026).**
 *
 * Sur Gemini 2.5+ et 3.x, `maxOutputTokens` est un budget **commun au raisonnement interne et à la
 * réponse**, et le raisonnement est actif par défaut sur les modèles Flash. Le modèle peut donc
 * dépenser tout le budget à réfléchir et renvoyer un **200** avec `finishReason: "MAX_TOKENS"` et un
 * tableau `parts` **vide**. Vu du client, c'est « la demande a échoué », sans aucune piste.
 *
 * `thinkingBudget: 0` éteint le raisonnement. Le champ appartient à la génération 2.x ; la 3.x
 * attend `thinkingLevel` et **rejette** celui-ci en 400. D'où le repli plus bas : on tente, et si le
 * modèle n'en veut pas, on rejoue sans — plutôt que de deviner à quel modèle `-latest` pointe
 * aujourd'hui, ce qui changera de toute façon dans trois mois.
 */
const THINKING_OFF = { thinkingBudget: 0 };

function geminiBody(request: ProviderRequest, withThinkingConfig: boolean): string {
  const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
  if (request.image) {
    parts.push({
      inline_data: { mime_type: request.image.mediaType, data: request.image.base64 },
    });
  }
  return JSON.stringify({
    system_instruction: { parts: [{ text: request.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: request.maxTokens,
      // Basse mais non nulle : on veut des réponses reproductibles pour comparer deux
      // fournisseurs sur la même question, sans figer la formulation au point de ne plus rien
      // apprendre d'une seconde exécution.
      temperature: 0.4,
      ...(withThinkingConfig ? { thinkingConfig: THINKING_OFF } : {}),
    },
  });
}

async function callGemini(config: ProviderConfig, request: ProviderRequest): Promise<ProviderResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey };

  let { response, attempts } = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: geminiBody(request, true),
  });

  // Repli : le modèle a refusé `thinkingConfig` (génération 3.x). On rejoue sans, une seule fois.
  // Le budget de sortie, lui, reste large — c'est ce qui laisse de la place au raisonnement.
  if (response.status === 400) {
    const body = await response.text();
    if (body.includes('thinking') || body.includes('thinkingConfig')) {
      console.warn('[ai-assist] thinkingConfig refusé par le modèle, seconde tentative sans');
      ({ response, attempts } = await fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: geminiBody(request, false),
      }));
    } else {
      return classifyHttpError(400, body, attempts);
    }
  }

  if (!response.ok) return classifyHttpError(response.status, await response.text(), attempts);

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

  if (text.length > 0) return { ok: true, text };

  // Une réponse vide n'est plus un échec muet : on dit POURQUOI elle est vide. `finishReason` et le
  // compteur de jetons de raisonnement sont des métadonnées du modèle — ils ne portent aucune donnée
  // de l'utilisateur, et sans eux ce cas est indiagnosticable depuis le téléphone.
  const reason = payload.candidates?.[0]?.finishReason ?? 'inconnue';
  const thoughts = payload.usageMetadata?.thoughtsTokenCount;
  return {
    ok: false,
    kind: 'failed',
    detail:
      `Le modèle n'a produit aucun texte (finishReason=${reason}` +
      (thoughts ? `, ${thoughts} jetons de raisonnement` : '') +
      `). Budget de sortie : ${request.maxTokens} jetons.`,
  };
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

  const { response, attempts } = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
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

  if (!response.ok) return classifyHttpError(response.status, await response.text(), attempts);

  const payload = (await response.json()) as AnthropicResponse;
  if (payload.stop_reason === 'refusal') return { ok: false, kind: 'refused' };

  const text = (payload.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim();

  if (text.length > 0) return { ok: true, text };
  return {
    ok: false,
    kind: 'failed',
    detail: `Le modèle n'a produit aucun texte (stop_reason=${payload.stop_reason ?? 'inconnue'}).`,
  };
}

/**
 * Aiguille vers l'adaptateur. Une panne réseau est un `failed`, jamais une exception qui remonte.
 *
 * Le message de l'exception est **nommé** dans le détail : une coupure DNS, un délai dépassé et un
 * JSON illisible produisent tous trois le même écran sans lui, alors qu'ils n'ont ni la même cause
 * ni le même remède. C'est le dernier chemin muet qui restait.
 */
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
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ok: false, kind: 'failed', detail: `Appel au fournisseur impossible — ${message.slice(0, 300)}` };
  }
}
