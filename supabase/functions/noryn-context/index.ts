/**
 * US NORYN-01 — `noryn-context` : Noryn, l'orchestrateur personnel de Florian, lit deux synthèses
 * Wellness en lecture seule (`GET context/day?date=…`, `GET context/week?start=…`). Contrat : dépôt
 * Noryn, `docs/08-WELLNESS-CONTRACT.md`. Spec : `docs/specs/functional/us/noryn01-noryn-context.md`.
 *
 * ── Une coquille, rien d'autre ───────────────────────────────────────────────────────────────────
 * Ce fichier ne fait que brancher les secrets, le client Supabase et `Deno.serve`. Toute la logique
 * (jeton, fenêtre, isolation au seul propriétaire, synthèses, contrat) vit dans
 * `packages/shared/src/noryn/`, testée sous Vitest, et arrive ici par `./core.bundle.js` — un fichier
 * **généré** par esbuild au déploiement (décision D2), ignoré par git, effacé après.
 *
 * ── Ce qui n'est pas conservé ────────────────────────────────────────────────────────────────────
 * Rien. Aucun journal du contenu, de l'en-tête `Authorization`, de la date demandée : le journal ne
 * reçoit qu'un code fixe (`noryn-context: db_error`…).
 *
 * ── Déploiement (manuel, par un humain) ──────────────────────────────────────────────────────────
 *   npx supabase secrets set NORYN_TOKEN_SHA256=<empreinte hex> NORYN_OWNER_USER_ID=<uuid du compte>
 *   npm run noryn:deploy
 * Il refuse un arbre non commité, construit `core.bundle.js`, lance
 * `supabase functions deploy noryn-context --use-api`, puis efface le bundle : un déploiement lancé à la
 * main, sans lui, échoue (fichier absent) au lieu d'envoyer un bundle périmé.
 * `verify_jwt = false` est posé dans `supabase/config.toml` pour cette seule fonction.
 * `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis d'office aux fonctions.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createNorynHandler } from './core.bundle.js';

const url = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Sans URL ni clé, la source répond « indisponible » (503) : jamais un 200.
const client =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

const handle = createNorynHandler({
  env: (name: string) => Deno.env.get(name),
  client,
  log: (code: string) => console.error(`noryn-context: ${code}`),
});

Deno.serve(async (req: Request) => {
  const res = await handle({ method: req.method, url: req.url, headers: req.headers });
  return new Response(res.body, { status: res.status, headers: res.headers });
});
