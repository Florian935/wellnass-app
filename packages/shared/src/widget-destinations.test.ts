import { describe, expect, it } from 'vitest';

import { INSIGHT_ORDER } from './insights';
import {
  CONDITIONAL_BY_NATURE,
  HOME_WIDGET_IDS_V1,
  HOME_WIDGET_IDS_WITH_DESTINATION,
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

  it('conserve exactement 8 widgets dans la grille de l’accueil', () => {
    // 7 au dégonflage (INSIGHTS-02), **8 depuis VIE-01** qui a ajouté `real-life` le même jour —
    // seul id né après le snapshot, d'où la liste compagne `HOME_WIDGET_IDS_POST_V1`.
    //
    // Toujours 8 après ACCUEIL-01/04 (09/09/2026), et c'est un équilibre exact, pas une
    // coïncidence : `today-session` a quitté la grille pour la zone épinglée (`home-pinned`) et
    // `weight` y est revenu. Le plafond `MAX_HOME_WIDGETS` n'a donc pas eu à bouger.
    expect(KEPT_ON_HOME).toHaveLength(8);
  });

  it('garde `today-session` sur l’accueil, mais épinglé hors grille', () => {
    // Le distinguer de `home` n'est pas cosmétique : un widget de grille est masquable par
    // l'utilisateur, une zone épinglée est garantie à l'écran.
    const dest = WIDGET_DESTINATIONS['today-session'];
    expect(dest.kind).toBe('home-pinned');
    if (dest.kind === 'home-pinned') expect(dest.zone.length).toBeGreaterThan(0);
  });

  it('ne laisse aucun widget d’avant sans destination, quelle qu’elle soit', () => {
    // La règle R1 d'INSIGHTS-02 (« aucun signal ne disparaît ») ne dit pas *où* va un signal, elle
    // dit qu'il va quelque part. On compte donc ce qui a quitté la grille, sans présumer de la
    // forme : 13 rangés ailleurs + `today-session` promu = 14, le compte d'origine.
    const moved = HOME_WIDGET_IDS_V1.filter((id) => WIDGET_DESTINATIONS[id].kind !== 'home');
    expect(moved).toHaveLength(14);
    for (const id of moved) expect(WIDGET_DESTINATIONS[id]).toBeDefined();
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

  it('rangent bien 7 widgets sur un écran', () => {
    // 8 au dégonflage, **7 depuis ACCUEIL-04** : `weight` est revenu sur l'accueil, sa destination
    // « Muscu › Progression › Mensurations » n'a donc plus de raison d'être.
    const screens = HOME_WIDGET_IDS_V1.filter((id) => WIDGET_DESTINATIONS[id].kind === 'screen');
    expect(screens).toHaveLength(7);
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
    //
    // On compare à l'**union** (snapshot figé + ajouts postérieurs) et non à `V1` seul : un widget né
    // après le dégonflage doit déclarer sa destination sans pour autant réécrire le snapshot.
    for (const id of HOME_WIDGET_IDS) {
      expect(HOME_WIDGET_IDS_WITH_DESTINATION as readonly string[]).toContain(id);
    }
  });

  it('conserve sur l’accueil exactement ce que le registre courant déclare', () => {
    expect([...KEPT_ON_HOME].sort()).toEqual([...HOME_WIDGET_IDS].sort());
  });
});
