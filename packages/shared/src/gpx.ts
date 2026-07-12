import { isValidCoord, type GpsPoint } from './running';

// ---------------------------------------------------------------------------
// Export GPX (GPX 1.1, sans altitude) — logique PURE, sans dépendance native.
//
// Le GPX est TOUJOURS en WGS84 (degrés décimaux) et UTC — indépendant du réglage
// métrique/impérial de l'app. L'altitude (`<ele>`) est différée (US 5.32 : aucune
// altitude captée aujourd'hui).
// ---------------------------------------------------------------------------

/** Créateur annoncé dans l'attribut `creator` du document GPX. */
const GPX_CREATOR = 'Wellness App';

/**
 * Échappe les 5 caractères spéciaux XML pour interpoler du texte utilisateur
 * (le `<name>` de la métadonnée) sans injection. Ordre important : `&` d'abord.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Zero-pad un entier sur 2 chiffres. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Nom de fichier lisible et daté d'une course : `course-AAAA-MM-JJ-HHmm.gpx`.
 *
 * La date/heure est LOCALE (`getFullYear`/`getMonth`/`getDate`/`getHours`/
 * `getMinutes`, PAS UTC) — cohérent avec le libellé daté du `<name>` construit par
 * l'appelant. (Les `<time>` des `<trkpt>` restent, eux, en UTC.) Pas d'espace ni de
 * caractère spécial.
 *
 * @param startedAt - Instant de départ (objet `Date` ou chaîne ISO UTC).
 */
export function gpxFileName(startedAt: Date | string): string {
  const d = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  return `course-${date}-${time}.gpx`;
}

/** Options de construction du document GPX. */
export interface BuildGpxOptions {
  /** Instant de départ (ms depuis epoch, UTC) — base des `<time>` absolus. */
  startedAtMs: number;
  /**
   * Libellé du `<name>` de la métadonnée. Déjà construit par l'appelant (i18n,
   * libellé daté) — `buildGpx` ignore la locale. Échappé XML en interne.
   */
  name: string;
}

/**
 * Construit un document GPX 1.1 (sans altitude) à partir de points GPS.
 *
 * - Un seul `<trk>` → un seul `<trkseg>` → un `<trkpt lat lon>` par point VALIDE.
 * - Chaque `<trkpt>` porte un `<time>` ABSOLU UTC ISO 8601 = `startedAtMs + t*1000`.
 * - Les points invalides (`isValidCoord` : null island `(0,0)`, hors bornes, non
 *   fini) sont écartés — sécurité pour d'anciennes traces enregistrées avant le fix
 *   d'ingestion.
 * - Le `name` est échappé XML.
 *
 * Fonction PURE, déterministe, sans dépendance native ni I/O.
 *
 * @returns La chaîne GPX, ou `null` si moins de 2 points valides après filtrage
 *          (défensif : le bouton n'aurait pas dû s'afficher).
 */
export function buildGpx(
  points: ReadonlyArray<GpsPoint>,
  opts: BuildGpxOptions,
): string | null {
  const valid = points.filter((p) => isValidCoord(p.lat, p.lng));
  if (valid.length < 2) return null;

  const name = escapeXml(opts.name);
  const startTime = new Date(opts.startedAtMs).toISOString();

  const trkpts = valid
    .map((p) => {
      const time = new Date(opts.startedAtMs + p.t * 1000).toISOString();
      return (
        `      <trkpt lat="${p.lat}" lon="${p.lng}">\n` +
        `        <time>${time}</time>\n` +
        `      </trkpt>`
      );
    })
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="${GPX_CREATOR}" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata>\n` +
    `    <name>${name}</name>\n` +
    `    <time>${startTime}</time>\n` +
    `  </metadata>\n` +
    `  <trk>\n` +
    `    <trkseg>\n` +
    `${trkpts}\n` +
    `    </trkseg>\n` +
    `  </trk>\n` +
    `</gpx>\n`
  );
}
