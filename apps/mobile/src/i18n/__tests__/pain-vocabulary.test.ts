/**
 * US DOUL-01 (R6) — le vocabulaire du journal ne doit **jamais** glisser vers le médical.
 *
 * Ce test existe parce que la règle est facile à enfreindre de bonne foi : en écrivant « pense à te
 * reposer » ou « consulte si ça persiste », on croit être bienveillant, et on produit un **conseil de
 * santé** que rien ne fonde. C'est exactement la ligne que MUSC-F14 a refusé de franchir, et que
 * `SubstitutionSection.test.tsx` garde déjà de son côté.
 *
 * Le mot autorisé est « zone sensible ». « Douleur » reste permis comme **niveau** déclaré par
 * l'utilisateur (`pain.levels.pain`) — c'est lui qui le dit, pas l'app.
 */

import fr from '../locales/fr.json';
import en from '../locales/en.json';

/**
 * Vocabulaire interdit — il **affirme** quelque chose de médical, ou prescrit une conduite.
 *
 * Volontairement court et concret : une liste fourre-tout attraperait des faux positifs et finirait
 * désactivée.
 */
const FORBIDDEN_FR = [
  'blessure',
  'blessé',
  'lésion',
  'pathologie',
  'guérison',
  'guéri',
  'consulte',
  'médecin',
  'kiné',
  'repos conseillé',
  'arrête',
  'diagnostic',
];

const FORBIDDEN_EN = [
  'injury',
  'injured',
  'lesion',
  'pathology',
  'healing',
  'healed',
  'see a doctor',
  'physician',
  'physio',
  'rest advised',
  'stop training',
  'diagnosis',
];

/** Aplatit toutes les valeurs textuelles d'un objet i18n. */
function textsOf(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (node !== null && typeof node === 'object') {
    return Object.values(node as Record<string, unknown>).flatMap(textsOf);
  }
  return [];
}

describe('vocabulaire du journal des zones sensibles (R6)', () => {
  it('le namespace `pain` existe dans les deux langues', () => {
    expect(fr.pain).toBeDefined();
    expect(en.pain).toBeDefined();
  });

  // ⚠️ Ce paquet tourne sous **Jest**, pas Vitest : `expect(valeur, message)` n'existe pas ici
  // (« Expect takes at most one argument »). On fait donc porter le contexte par l'assertion
  // elle-même — comparer la liste des fautifs à `[]` affiche les chaînes coupables dans le diff,
  // ce qui est même plus lisible qu'un message.
  it('n’emploie aucun terme médical en FR', () => {
    const texts = textsOf(fr.pain).map((s) => s.toLocaleLowerCase());
    const guilty = FORBIDDEN_FR.flatMap((word) =>
      texts.filter((s) => s.includes(word)).map((s) => `${word} → ${s}`),
    );
    expect(guilty).toEqual([]);
  });

  it('n’emploie aucun terme médical en EN', () => {
    const texts = textsOf(en.pain).map((s) => s.toLocaleLowerCase());
    const guilty = FORBIDDEN_EN.flatMap((word) =>
      texts.filter((s) => s.includes(word)).map((s) => `${word} → ${s}`),
    );
    expect(guilty).toEqual([]);
  });

  it('couvre les 18 zones dans les deux langues, sans clé vide', () => {
    // Une clé manquante afficherait sa **clé brute** à l'écran — le défaut corrigé le 05/08/2026,
    // où « back » s'affichait au lieu de « Dos » sur trois surfaces.
    expect(Object.keys(fr.pain.zones)).toHaveLength(18);
    expect(Object.keys(en.pain.zones).sort()).toEqual(Object.keys(fr.pain.zones).sort());
    for (const label of [...textsOf(fr.pain.zones), ...textsOf(en.pain.zones)]) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('couvre les 3 niveaux dans les deux langues', () => {
    expect(Object.keys(fr.pain.levels).sort()).toEqual(['blocking', 'discomfort', 'pain']);
    expect(Object.keys(en.pain.levels).sort()).toEqual(['blocking', 'discomfort', 'pain']);
  });

  it('distingue `shoulders` de `shoulder_joint` par des libellés différents', () => {
    // Critère de recette 4 : les deux doivent être distinguables. La forme le fait sur le schéma,
    // le libellé doit le faire dans la liste accessible.
    expect(fr.pain.zones.shoulders).not.toBe(fr.pain.zones.shoulder_joint);
    expect(en.pain.zones.shoulders).not.toBe(en.pain.zones.shoulder_joint);
  });
});
