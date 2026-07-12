import { describe, expect, it } from 'vitest';
import { buildGpx, gpxFileName } from './gpx';
import type { GpsPoint } from './running';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Départ : 12/07/2026 17:27:00 UTC (ms depuis epoch).
const STARTED_AT_MS = Date.parse('2026-07-12T17:27:00.000Z');

const POINTS: GpsPoint[] = [
  { lat: 48.8566, lng: 2.3522, t: 0 },
  { lat: 48.857, lng: 2.353, t: 5 },
  { lat: 48.858, lng: 2.354, t: 12 },
];

// ---------------------------------------------------------------------------
// gpxFileName
// ---------------------------------------------------------------------------
describe('gpxFileName', () => {
  it('produit un nom au format course-AAAA-MM-JJ-HHmm.gpx', () => {
    // Heure locale (dépend du fuseau CI) → on asserte le MOTIF pour éviter la
    // flakiness ; la structure (date + HHmm 4 chiffres + extension) est garantie.
    const name = gpxFileName(new Date('2026-07-12T17:27:00Z'));
    expect(name).toMatch(/^course-\d{4}-\d{2}-\d{2}-\d{4}\.gpx$/);
  });

  it('accepte une chaîne ISO UTC comme entrée', () => {
    const name = gpxFileName('2026-07-12T17:27:00.000Z');
    expect(name).toMatch(/^course-\d{4}-\d{2}-\d{2}-\d{4}\.gpx$/);
  });

  it('utilise la date/heure LOCALE (getHours/getMinutes, pas UTC)', () => {
    // Date locale connue : on construit un Date à partir de composants locaux,
    // le nom doit refléter exactement ces composants.
    const d = new Date(2026, 6, 12, 19, 27, 0); // 12/07/2026 19h27 LOCAL
    expect(gpxFileName(d)).toBe('course-2026-07-12-1927.gpx');
  });

  it('zero-pad l\'heure et les minutes (motif 4 chiffres)', () => {
    const d = new Date(2026, 0, 3, 6, 5, 0); // 03/01/2026 06h05 LOCAL
    expect(gpxFileName(d)).toBe('course-2026-01-03-0605.gpx');
  });
});

// ---------------------------------------------------------------------------
// buildGpx
// ---------------------------------------------------------------------------
describe('buildGpx', () => {
  it('produit un document GPX 1.1 valide', () => {
    const gpx = buildGpx(POINTS, { startedAtMs: STARTED_AT_MS, name: 'Course test' })!;
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('creator="Wellness App"');
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(gpx).toContain('</gpx>');
  });

  it('émet les métadonnées : nom + heure de départ UTC', () => {
    const gpx = buildGpx(POINTS, { startedAtMs: STARTED_AT_MS, name: 'Course test' })!;
    expect(gpx).toContain('<metadata>');
    expect(gpx).toContain('<name>Course test</name>');
    expect(gpx).toContain('<time>2026-07-12T17:27:00.000Z</time>');
  });

  it('émet un seul <trk> avec un seul <trkseg>', () => {
    const gpx = buildGpx(POINTS, { startedAtMs: STARTED_AT_MS, name: 'x' })!;
    expect(gpx.match(/<trk>/g)).toHaveLength(1);
    expect(gpx.match(/<trkseg>/g)).toHaveLength(1);
  });

  it('émet un <trkpt lat lon> par point valide, avec <time> ABSOLU UTC', () => {
    const gpx = buildGpx(POINTS, { startedAtMs: STARTED_AT_MS, name: 'x' })!;
    const trkpts = gpx.match(/<trkpt /g);
    expect(trkpts).toHaveLength(3);
    expect(gpx).toContain('<trkpt lat="48.8566" lon="2.3522">');
    // t=0 → startedAt ; t=5 → +5 s ; t=12 → +12 s.
    expect(gpx).toContain('<time>2026-07-12T17:27:00.000Z</time>');
    expect(gpx).toContain('<time>2026-07-12T17:27:05.000Z</time>');
    expect(gpx).toContain('<time>2026-07-12T17:27:12.000Z</time>');
  });

  it('n\'émet PAS de <ele> (altitude non captée)', () => {
    const gpx = buildGpx(POINTS, { startedAtMs: STARTED_AT_MS, name: 'x' })!;
    expect(gpx).not.toContain('<ele>');
  });

  it('échappe les caractères XML du nom (& < > " \')', () => {
    const gpx = buildGpx(POINTS, {
      startedAtMs: STARTED_AT_MS,
      name: `A & B <c> "d" 'e'`,
    })!;
    expect(gpx).toContain('<name>A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;</name>');
    expect(gpx).not.toContain('<name>A & B');
  });

  it('écarte les points invalides (null island (0,0)) du filtrage', () => {
    const withInvalid: GpsPoint[] = [
      { lat: 48.8566, lng: 2.3522, t: 0 },
      { lat: 0, lng: 0, t: 5 }, // null island → filtré
      { lat: 48.858, lng: 2.354, t: 12 },
    ];
    const gpx = buildGpx(withInvalid, { startedAtMs: STARTED_AT_MS, name: 'x' })!;
    expect(gpx.match(/<trkpt /g)).toHaveLength(2);
    // Le point (0,0) ne doit pas apparaître.
    expect(gpx).not.toContain('lat="0" lon="0"');
  });

  it('écarte les coordonnées hors bornes', () => {
    const withOob: GpsPoint[] = [
      { lat: 48.8566, lng: 2.3522, t: 0 },
      { lat: 91, lng: 2.35, t: 5 }, // hors bornes → filtré
      { lat: 48.858, lng: 2.354, t: 12 },
    ];
    const gpx = buildGpx(withOob, { startedAtMs: STARTED_AT_MS, name: 'x' })!;
    expect(gpx.match(/<trkpt /g)).toHaveLength(2);
  });

  it('retourne null si moins de 2 points valides après filtrage', () => {
    const one: GpsPoint[] = [
      { lat: 48.8566, lng: 2.3522, t: 0 },
      { lat: 0, lng: 0, t: 5 }, // filtré → 1 seul valide
    ];
    expect(buildGpx(one, { startedAtMs: STARTED_AT_MS, name: 'x' })).toBeNull();
  });

  it('retourne null pour un tableau vide', () => {
    expect(buildGpx([], { startedAtMs: STARTED_AT_MS, name: 'x' })).toBeNull();
  });

  it('retourne null si startedAtMs n\'est pas fini (date corrompue) — pas de RangeError', () => {
    expect(buildGpx(POINTS, { startedAtMs: NaN, name: 'x' })).toBeNull();
    expect(buildGpx(POINTS, { startedAtMs: Infinity, name: 'x' })).toBeNull();
  });
});
