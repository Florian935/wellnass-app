/**
 * Les chemins vers le brief — US MUSCU-UX03, spec §5.1.
 *
 * Ce qui compte ici tient en une phrase : **le mode classique ne doit jamais voir cet écran.**
 * Cinq écrans appellent ces deux fonctions ; si la condition se relâche, cinq chemins changent de
 * comportement d'un coup pour des gens qui n'ont rien demandé (décision D1).
 */

import {
  briefRouteForSession,
  briefRouteForTemplate,
} from '@/components/workout/immersive/brief-entry';
import { useSessionMode } from '@/stores/session-mode-store';

const setMode = (mode: 'classic' | 'immersive') =>
  useSessionMode.setState({ mode, chosen: true, hydrated: true });

describe('briefRouteForSession', () => {
  it('🔴 ne renvoie rien en mode classique — le chemin existant est conservé tel quel', () => {
    setMode('classic');
    expect(briefRouteForSession('s-1', 'ps-1')).toBeNull();
  });

  it('mène au brief en mode immersif, avec l’occurrence planifiée', () => {
    setMode('immersive');
    expect(briefRouteForSession('s-1', 'ps-1')).toEqual({
      pathname: '/workout-brief',
      params: { sessionId: 's-1', plannedSessionId: 'ps-1' },
    });
  });

  it('omet l’occurrence quand il n’y en a pas (séance lancée depuis la fiche programme)', () => {
    setMode('immersive');
    expect(briefRouteForSession('s-1')).toEqual({
      pathname: '/workout-brief',
      params: { sessionId: 's-1' },
    });
  });

  it('🔴 ne renvoie rien sans identifiant de séance — une séance libre n’a rien à annoncer', () => {
    setMode('immersive');
    expect(briefRouteForSession(null)).toBeNull();
    expect(briefRouteForSession('')).toBeNull();
  });
});

describe('briefRouteForTemplate', () => {
  it('ne renvoie rien en mode classique', () => {
    setMode('classic');
    expect(briefRouteForTemplate('t-1')).toBeNull();
  });

  it('mène au brief en mode immersif', () => {
    setMode('immersive');
    expect(briefRouteForTemplate('t-1')).toEqual({
      pathname: '/workout-brief',
      params: { templateId: 't-1' },
    });
  });
});
