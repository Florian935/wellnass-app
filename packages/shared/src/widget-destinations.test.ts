import { describe, expect, it } from 'vitest';

import { INSIGHT_ORDER } from './insights';
import {
  CONDITIONAL_BY_NATURE,
  HOME_WIDGET_IDS_V1,
  KEPT_ON_HOME,
  WIDGET_DESTINATIONS,
} from './widget-destinations';
import { HOME_WIDGET_IDS } from './widgets';

/**
 * Ce fichier est le garde-fou de la règle R1 d'INSIGHTS-02 : « aucun signal ne disparaît ».
 * Il tourne **avant** le dégonflage et doit rester vrai après.
 */

describe('table des destinations', () => {
  it('couvre les 21 widgets d’avant le dégonflage, sans exception', () => {
    expect(HOME_WIDGET_IDS_V1).toHaveLength(21);
    for (const id of HOME_WIDGET_IDS_V1) {
      expect(WIDGET_DESTINATIONS[id]).toBeDefined();
    }
  });

  it('ne contient aucun doublon', () => {
    expect(new Set(HOME_WIDGET_IDS_V1).size).toBe(HOME_WIDGET_IDS_V1.length);
  });

  it('conserve exactement 7 widgets sur l’accueil', () => {
    expect(KEPT_ON_HOME).toHaveLength(7);
  });

  it('retire donc 14 widgets, chacun avec une destination', () => {
    const moved = HOME_WIDGET_IDS_V1.filter((id) => WIDGET_DESTINATIONS[id].kind !== 'home');
    expect(moved).toHaveLength(14);
  });
});

describe('cartes d’insight — réservées aux signaux conditionnels par nature', () => {
  it('n’accepte `alert-insight` que pour les alertes', () => {
    for (const id of HOME_WIDGET_IDS_V1) {
      const dest = WIDGET_DESTINATIONS[id];
      if (dest.kind !== 'alert-insight') continue;
      // Un signal permanent rangé derrière une carte conditionnelle serait invisible la plupart du
      // temps : au plus 3 cartes s'affichent, avec un quota de famille et une porte de fraîcheur.
      expect(CONDITIONAL_BY_NATURE).toContain(id);
    }
  });

  it('pointe des identifiants qui existent réellement dans le moteur', () => {
    for (const id of HOME_WIDGET_IDS_V1) {
      const dest = WIDGET_DESTINATIONS[id];
      if (dest.kind !== 'alert-insight') continue;
      expect(INSIGHT_ORDER as readonly string[]).toContain(dest.id);
    }
  });

  it('ne range aucun signal permanent derrière une carte d’insight', () => {
    // Formulé à l'envers du test précédent, exprès : c'est l'erreur que la relecture du cadrage a
    // trouvée (6 signaux « déjà dans INSIGHT_ORDER » pris pour des destinations acquises).
    const permanents = HOME_WIDGET_IDS_V1.filter((id) => !CONDITIONAL_BY_NATURE.includes(id));
    for (const id of permanents) {
      expect(WIDGET_DESTINATIONS[id].kind).not.toBe('alert-insight');
    }
  });
});

describe('destinations d’écran', () => {
  it('déclarent une route et un chemin lisible', () => {
    for (const id of HOME_WIDGET_IDS_V1) {
      const dest = WIDGET_DESTINATIONS[id];
      if (dest.kind !== 'screen') continue;
      expect(dest.route.startsWith('/')).toBe(true);
      expect(dest.path.length).toBeGreaterThan(0);
    }
  });

  it('rangent bien 8 widgets sur un écran', () => {
    const screens = HOME_WIDGET_IDS_V1.filter((id) => WIDGET_DESTINATIONS[id].kind === 'screen');
    expect(screens).toHaveLength(8);
  });

  it('donnent un chemin distinct de la seule route — la recette suit des gestes, pas des URL', () => {
    for (const id of HOME_WIDGET_IDS_V1) {
      const dest = WIDGET_DESTINATIONS[id];
      if (dest.kind !== 'screen') continue;
      expect(dest.path).not.toBe(dest.route);
    }
  });
});

describe('cohérence avec le registre réel', () => {
  it('n’oublie aucun widget du registre courant', () => {
    // Si quelqu'un ajoute un widget d'accueil sans lui donner de destination, il échappera au
    // prochain dégonflage — et c'est exactement comme ça qu'on est arrivé à 21.
    for (const id of HOME_WIDGET_IDS) {
      expect(HOME_WIDGET_IDS_V1 as readonly string[]).toContain(id);
    }
  });

  it('conserve sur l’accueil exactement ce que le registre courant déclare', () => {
    expect([...KEPT_ON_HOME].sort()).toEqual([...HOME_WIDGET_IDS].sort());
  });
});
