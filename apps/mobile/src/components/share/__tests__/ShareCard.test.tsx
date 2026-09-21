/**
 * US PARTAGE-01 — smoke test de la carte partageable.
 *
 * Ce qui est vérifié est le **contrat de l'US**, pas le rendu pixel :
 *  - **aucune donnée de santé** sur l'image (décision D7) — c'est la règle qu'on ne peut pas
 *    rattraper une fois l'image partie sur un réseau public ;
 *  - une séance **sans record** n'affiche pas de section vide ;
 *  - une course **sans tracé exploitable** rend quand même sa carte (chiffres seuls), sans planter.
 *
 * `react-native-svg` est du natif → mocké, comme dans `charts-smoke.test.tsx`.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ShareCard, type ShareCardData } from '../ShareCard';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: 'svg' }, children);
  return { __esModule: true, default: Stub, Path: Stub, Circle: Stub };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}));

const runData: ShareCardData = {
  kind: 'run',
  points: [
    { lat: 45.777, lng: 3.087 },
    { lat: 45.787, lng: 3.097 },
  ],
  startedAtMs: new Date(2026, 6, 29, 18, 5).getTime(),
  stats: { distance: '12,4 km', duration: '1 h 02 min', pace: "5'00 /km" },
};

const workoutData: ShareCardData = {
  kind: 'workout',
  startedAtMs: new Date(2026, 6, 29, 18, 5).getTime(),
  stats: { exercises: 4, sets: 12, volume: '8 200,0 kg', duration: '65 min' },
  records: ['Développé couché · 105,0 kg'],
};

describe('ShareCard', () => {
  it('affiche les chiffres de la course', async () => {
    const { getByText } = await render(<ShareCard data={runData} size={320} />);
    expect(getByText('12,4 km')).toBeTruthy();
    expect(getByText("5'00 /km")).toBeTruthy();
  });

  it('trace le parcours en SVG — jamais une capture de carte native', async () => {
    const { queryAllByTestId } = await render(<ShareCard data={runData} size={320} />);
    expect(queryAllByTestId('svg').length).toBeGreaterThan(0);
  });

  it('rend la carte SANS tracé quand le GPS n’a rien donné, sans planter', async () => {
    // Tous les points confondus : `isDrawableTrack` est faux, les chiffres portent seuls la carte.
    const stuck: ShareCardData = {
      ...runData,
      points: [
        { lat: 45.777, lng: 3.087 },
        { lat: 45.777, lng: 3.087 },
      ],
    };
    const { getByText, queryAllByTestId } = await render(<ShareCard data={stuck} size={320} />);
    expect(getByText('12,4 km')).toBeTruthy();
    expect(queryAllByTestId('svg')).toHaveLength(0);
  });

  it('affiche les records d’une séance qui en a', async () => {
    const { getByText } = await render(<ShareCard data={workoutData} size={320} />);
    expect(getByText('Développé couché · 105,0 kg')).toBeTruthy();
    expect(getByText('share.workout.records')).toBeTruthy();
  });

  it('n’affiche PAS de section records vide quand il n’y en a aucun', async () => {
    const { queryByText, getByText } = await render(
      <ShareCard data={{ ...workoutData, records: [] }} size={320} />,
    );
    expect(queryByText('share.workout.records')).toBeNull();
    // Les chiffres, eux, restent là : la carte n'est jamais vide.
    expect(getByText('8 200,0 kg')).toBeTruthy();
  });

  it('borne les records affichés à 3 — au-delà la carte devient une liste illisible', async () => {
    const many = ['A · 1 kg', 'B · 2 kg', 'C · 3 kg', 'D · 4 kg', 'E · 5 kg'];
    const { queryByText } = await render(
      <ShareCard data={{ ...workoutData, records: many }} size={320} />,
    );
    expect(queryByText('C · 3 kg')).toBeTruthy();
    expect(queryByText('D · 4 kg')).toBeNull();
  });

  it('ne porte AUCUNE donnée de santé (D7) : ni poids de corps, ni mensuration, ni bien-être', async () => {
    // Le tonnage soulevé est une donnée d'activité, pas de santé — il reste autorisé. Ce qui est
    // interdit, c'est le poids DE CORPS, les circonférences et les indicateurs subjectifs. Ce test
    // fige l'intention : si un jour quelqu'un ajoute le poids à la carte, il échoue.
    const { toJSON } = await render(<ShareCard data={workoutData} size={320} />);
    const rendered = JSON.stringify(toJSON());
    for (const forbidden of ['weight.', 'bodyWeight', 'measurements.', 'wellbeing.']) {
      expect(rendered).not.toContain(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------
// US PARTAGE-02 — la variante transparente
// ---------------------------------------------------------------------------

/**
 * Parcourt l'arbre rendu et collecte les nœuds d'un type donné.
 *
 * On passe par `toJSON()` plutôt que par les requêtes de RNTL : ce qu'on vérifie ici n'est ni un
 * texte ni un rôle, c'est un **style** — la présence d'un fond, celle d'un halo.
 */
type Noeud = { type?: string; props?: { style?: unknown }; children?: unknown };

function noeuds(racineJson: unknown, type: string): Noeud[] {
  const out: Noeud[] = [];
  const visiter = (n: unknown): void => {
    if (n === null || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(visiter);
      return;
    }
    const node = n as Noeud;
    if (node.type === type) out.push(node);
    visiter(node.children);
  };
  visiter(racineJson);
  return out;
}

const aplati = (n: Noeud) => StyleSheet.flatten(n.props?.style) as Record<string, unknown>;

/** Style de la vue racine — la seule vue carrée de `size` × `size` que le composant produise. */
const racine = async (variant?: 'full' | 'transparent', data: ShareCardData = runData) => {
  const { toJSON } = await render(
    <ShareCard data={data} size={300} {...(variant ? { variant } : {})} />,
  );
  const root = noeuds(toJSON(), 'View').find((v) => aplati(v).width === 300)!;
  return aplati(root);
};

/** Styles de tous les textes de la carte. */
const stylesDeTexte = async (variant: 'full' | 'transparent', data: ShareCardData = runData) => {
  const { toJSON } = await render(<ShareCard data={data} size={300} variant={variant} />);
  return noeuds(toJSON(), 'Text').map(aplati);
};

describe('variante transparente (US PARTAGE-02)', () => {
  it('🔴 `full` garde son fond opaque — PARTAGE-01 est en recette, rien ne doit bouger (R2)', async () => {
    const sansVariante = await racine();
    const avecFull = await racine('full');
    expect(sansVariante.backgroundColor).toBe('#1c130c');
    // Ne pas passer la prop et passer `full` doivent produire exactement le même fond.
    expect(avecFull.backgroundColor).toBe(sansVariante.backgroundColor);
  });

  it('🔴 `transparent` retire le fond — c’est LUI que `captureRef` traduit en canal alpha', async () => {
    expect((await racine('transparent')).backgroundColor).toBe('transparent');
  });

  it('🔴 chaque texte porte son halo en transparent (R6)', async () => {
    // Sur fond transparent, le contraste est INCONNAISSABLE : l'arrière-plan est la photo de
    // l'utilisateur. Un seul texte sans halo devient illisible sur une photo claire.
    const styles = await stylesDeTexte('transparent');
    expect(styles.length).toBeGreaterThan(0);
    expect(styles.every((s) => typeof s.textShadowColor === 'string')).toBe(true);
    expect(styles.every((s) => typeof s.textShadowRadius === 'number' && (s.textShadowRadius as number) > 0)).toBe(true);
  });

  it('aucun halo en `full` : il n’a rien à compenser sur un fond connu', async () => {
    const styles = await stylesDeTexte('full');
    expect(styles.every((s) => s.textShadowColor === undefined)).toBe(true);
  });

  it('une séance transparente porte aussi ses halos', async () => {
    const styles = await stylesDeTexte('transparent', workoutData);
    expect(styles.every((s) => typeof s.textShadowColor === 'string')).toBe(true);
  });
});
