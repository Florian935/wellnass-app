/**
 * L'heure de lancement de l'app (US CARDIO-02, R14).
 *
 * ⚠️ Une constante de module ne suffit pas : `inlineRequires` est actif (`metro.config.js`), un module
 * n'est donc évalué qu'au premier usage — l'heure retenue aurait été celle du premier affichage du hub
 * Course, pas celle du lancement. `markAppLaunched()` est appelé au chargement du layout racine, le
 * seul module évalué à coup sûr au démarrage.
 *
 * Sert à distinguer une synchronisation **de ce lancement** (`lastSyncedAt` postérieur) d'une
 * synchronisation mémorisée d'un lancement précédent.
 */

let launchedAt: number | null = null;

/** Retient l'heure de lancement ; les appels suivants ne la changent pas. */
export function markAppLaunched(now: number = Date.now()): void {
  if (launchedAt === null) launchedAt = now;
}

/** L'heure de lancement, retenue au premier appel si `markAppLaunched` n'a pas tourné. */
export function appLaunchedAt(): number {
  markAppLaunched();
  return launchedAt!;
}
