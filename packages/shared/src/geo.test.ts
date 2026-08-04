import { describe, expect, it } from 'vitest';
import { simplifyTrack } from './geo';
import type { GpsPoint } from './running';

const p = (lat: number, lng: number, t: number): GpsPoint => ({ lat, lng, t });

describe('simplifyTrack (Douglas-Peucker)', () => {
  it('trace vide ou 1-2 points → renvoyée telle quelle', () => {
    expect(simplifyTrack([], 5)).toEqual([]);
    const one = [p(48.85, 2.35, 0)];
    expect(simplifyTrack(one, 5)).toEqual(one);
    const two = [p(48.85, 2.35, 0), p(48.86, 2.36, 10)];
    expect(simplifyTrack(two, 5)).toEqual(two);
  });
  it('points quasi-colinéaires → réduits aux 2 extrémités', () => {
    const line = [p(48.8500, 2.3500, 0), p(48.8505, 2.3505, 5), p(48.8510, 2.3510, 10)];
    expect(simplifyTrack(line, 5)).toEqual([line[0], line[2]]);
  });
  it('un détour marqué (> ε) est conservé', () => {
    const detour = [p(48.8500, 2.3500, 0), p(48.8600, 2.3700, 5), p(48.8510, 2.3510, 10)];
    expect(simplifyTrack(detour, 5).length).toBe(3);
  });
  it('ε = 0 → aucune suppression (tous les points conservés)', () => {
    const pts = [p(48.85, 2.35, 0), p(48.851, 2.351, 5), p(48.852, 2.352, 10)];
    expect(simplifyTrack(pts, 0)).toEqual(pts);
  });
  it("conserve toujours les extrémités et l'ordre temporel", () => {
    const pts = Array.from({ length: 20 }, (_, i) => p(48.85 + i * 0.001, 2.35 + i * 0.001, i));
    const out = simplifyTrack(pts, 5);
    expect(out[0]).toEqual(pts[0]);
    expect(out[out.length - 1]).toEqual(pts[pts.length - 1]);
    expect(out.map((x) => x.t)).toEqual([...out.map((x) => x.t)].sort((a, b) => a - b));
  });

  // ── Segment dégénéré : les extrémités du segment de référence sont confondues ──────
  //
  // Cas **réel et fréquent** : une boucle qui revient à son point de départ (un tour de parc,
  // un aller-retour). Douglas-Peucker compare alors chaque point intermédiaire à un segment de
  // longueur nulle — la projection sur la droite porteuse diviserait par zéro. La branche
  // dédiée retombe sur la distance euclidienne au point, et c'est ce qui est vérifié ici.
  describe('boucle fermée (segment de référence dégénéré)', () => {
    const start = p(48.85, 2.35, 0);
    const sameAsStart = p(48.85, 2.35, 60);

    it('mesure la distance au point de départ, sans produire NaN', () => {
      // Le point du milieu est à ~111 m au nord du départ (0,001° de latitude).
      const far = p(48.851, 2.35, 30);
      const out = simplifyTrack([start, far, sameAsStart], 10);

      // 111 m > ε = 10 m → le sommet de la boucle est conservé.
      expect(out).toHaveLength(3);
      expect(out.every((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng))).toBe(true);
    });

    it('supprime un point intermédiaire réellement confondu avec le départ', () => {
      // Un point à ~1 m du départ, sur une boucle : sous le seuil, donc écarté.
      const nearlySame = p(48.850009, 2.35, 30);
      const out = simplifyTrack([start, nearlySame, sameAsStart], 10);

      expect(out).toHaveLength(2);
      expect(out[0]).toEqual(start);
      expect(out[1]).toEqual(sameAsStart);
    });

    it('traite une trace entièrement immobile (tous les points confondus)', () => {
      // GPS figé : trois relevés identiques. Rien à conserver au milieu, et surtout pas de NaN
      // qui se propagerait dans la trace enregistrée.
      const out = simplifyTrack([start, p(48.85, 2.35, 30), sameAsStart], 5);
      expect(out).toEqual([start, sameAsStart]);
    });
  });
});
