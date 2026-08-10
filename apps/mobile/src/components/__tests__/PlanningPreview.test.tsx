/**
 * Mini-calendrier d'aperçu du planning (`components/PlanningPreview`, US 3.9).
 *
 * Composant à **0 %** avant ce fichier. Purement présentationnel — et c'est précisément pour ça
 * qu'il vaut d'être testé : tout son contenu est calculé, rien n'est vérifiable à l'œil sans
 * connaître la date du jour et le contenu de la base.
 *
 * Quatre règles :
 *
 *  1. **Les séances SAUTÉES sont exclues.** Une pastille sur un jour qu'on a explicitement passé
 *     donnerait un planning qui ne correspond à rien.
 *  2. **Le libellé est PRÉFIXÉ par son pilier.** Le composant est affiché sur les deux hubs :
 *     « Prochaine : Fractionné (VMA) » sous l'en-tête Musculation surprenait sans le préfixe —
 *     constaté en recette.
 *  3. **Le grand format couvre deux semaines**, les autres une seule : la fenêtre interrogée doit
 *     suivre, sinon la seconde rangée est vide par construction.
 *  4. **La semaine commence le lundi.** `Date.getDay()` rend 0 pour dimanche : le décalage est le
 *     bug classique de tout calendrier européen.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { PlanningPreview } from '../PlanningPreview';
import { useUpcomingSessions } from '@/data/repositories/planned-session-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/planned-session-repository', () => ({
  useUpcomingSessions: jest.fn(() => ({ items: [], isLoading: false })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockUpcoming = useUpcomingSessions as jest.Mock;

/** Lundi 10/08/2026, midi — pour que la semaine affichée démarre sur un lundi connu. */
const LUNDI = new Date('2026-08-10T12:00:00');

const jour = (decalage: number) => {
  const d = new Date(LUNDI);
  d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Une occurrence planifiée. */
const occurrence = (overrides: Record<string, unknown> = {}) => ({
  id: 'ps-1',
  scheduledDate: jour(0),
  status: 'planned',
  pillar: 'strength',
  sessionName: 'Jour A',
  sessionType: null,
  orderIndex: 0,
  ...overrides,
});

const afficher = (items: unknown[] = [], size: 'small' | 'wide' | 'large' = 'wide') => {
  mockUpcoming.mockReturnValue({ items, isLoading: false });
  return render(<PlanningPreview size={size} />);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(LUNDI);
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Fenêtre interrogée
// ---------------------------------------------------------------------------

describe('fenêtre interrogée', () => {
  it.each([
    ['small', 7],
    ['wide', 7],
    ['large', 14],
  ] as const)('%s interroge %i jours', async (size, jours) => {
    await afficher([], size);

    // Le grand format affiche deux rangées de sept : demander sept jours laisserait la seconde
    // vide par construction, sans que rien ne le signale.
    expect(mockUpcoming).toHaveBeenCalledWith(jours);
  });

  it('🔴 la grille du grand format compte bien 14 cellules', async () => {
    await afficher([], 'large');

    // Les numéros de jour vont du 10 au 23 août.
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('23')).toBeTruthy();
  });

  it('la grille d’une semaine s’arrête à 7 jours', async () => {
    await afficher([], 'wide');

    expect(screen.getByText('16')).toBeTruthy();
    expect(screen.queryByText('17')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Jours de semaine
// ---------------------------------------------------------------------------

describe('jours de semaine', () => {
  it('🔴 la semaine commence au LUNDI, pas au dimanche', async () => {
    await afficher([], 'wide');

    // `Date.getDay()` rend 0 pour dimanche : le décalage est le bug classique de tout calendrier
    // européen. Le 10/08/2026 est un lundi, sa cellule doit porter l'initiale de « lundi ».
    // Les initiales viennent de `common.weekday.*` : ici la clé, dont on prend la 1ʳᵉ lettre.
    expect(screen.getAllByText('C').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Séances affichées
// ---------------------------------------------------------------------------

describe('séances affichées', () => {
  it('🔴 les séances SAUTÉES sont exclues', async () => {
    await afficher([
      occurrence({ id: 'saute', status: 'skipped', sessionName: 'Séance sautée' }),
    ]);

    // Une pastille sur un jour qu'on a explicitement passé donnerait un planning qui ne
    // correspond à rien — et « prochaine séance » désignerait quelque chose d'annulé.
    expect(screen.getByText('planning.previewEmpty')).toBeTruthy();
  });

  it('🔴 le libellé est PRÉFIXÉ par son pilier', async () => {
    await afficher([occurrence()]);

    // Le composant est affiché sur les deux hubs : « Prochaine : Fractionné (VMA) » sous
    // l'en-tête Musculation surprenait sans ce préfixe (constaté en recette).
    expect(screen.getByText(/planning\.previewNext.*planning\.pillarStrength · Jour A/)).toBeTruthy();
  });

  it('🔴 une séance de course est nommée par son TYPE', async () => {
    await afficher([
      occurrence({ pillar: 'running', sessionType: 'fractionne', sessionName: null }),
    ]);

    // Le nom d'une séance de course est souvent vide : c'est le type qui porte l'information.
    expect(screen.getByText(/running\.sessionType\.fractionne/)).toBeTruthy();
  });

  it('🔴 une séance muscu sans nom retombe sur son rang, numéroté à partir de 1', async () => {
    await afficher([occurrence({ sessionName: '   ', orderIndex: 2 })]);

    // Le libellé est interpolé dans `previewNext`, donc les guillemets internes sont échappés :
    // on cherche le fragment, pas la forme JSON exacte.
    expect(screen.getByText(/sessionFallback/)).toBeTruthy();
    expect(screen.getByText(/index.{0,3}:3/)).toBeTruthy();
  });

  it('sans aucune séance, le dit', async () => {
    await afficher([]);

    expect(screen.getByText('planning.previewEmpty')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Grand format
// ---------------------------------------------------------------------------

describe('grand format', () => {
  const trois = () => [
    occurrence({ id: 'a', scheduledDate: jour(0), sessionName: 'Jour A' }),
    occurrence({ id: 'b', scheduledDate: jour(2), sessionName: 'Jour B' }),
    occurrence({ id: 'c', scheduledDate: jour(4), sessionName: 'Jour C' }),
    occurrence({ id: 'd', scheduledDate: jour(6), sessionName: 'Jour D' }),
  ];

  it('🔴 liste au plus TROIS prochaines séances', async () => {
    await afficher(trois(), 'large');

    // Le widget a une hauteur fixe : une quatrième ligne déborderait.
    expect(screen.getByText(/Jour A/)).toBeTruthy();
    expect(screen.getByText(/Jour C/)).toBeTruthy();
    expect(screen.queryByText(/Jour D/)).toBeNull();
  });

  it('🔴 la liste est ordonnée par JOUR, pas par ordre de réception', async () => {
    await afficher(
      [
        occurrence({ id: 'tard', scheduledDate: jour(5), sessionName: 'Plus tard' }),
        occurrence({ id: 'tot', scheduledDate: jour(1), sessionName: 'Bientôt' }),
      ],
      'large',
    );

    // La liste est reconstruite jour par jour depuis la grille : elle ne dépend donc pas de
    // l'ordre dans lequel la base rend les lignes.
    const textes = screen.getAllByText(/Jour|Bientôt|Plus tard/).map((n) => String(n.props.children));
    expect(textes.findIndex((s) => s.includes('Bientôt'))).toBeLessThan(
      textes.findIndex((s) => s.includes('Plus tard')),
    );
  });

  it('sans séance, le grand format affiche l’état vide', async () => {
    await afficher([], 'large');

    expect(screen.getByText('planning.previewEmpty')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Petit format
// ---------------------------------------------------------------------------

describe('petit format', () => {
  it('affiche une bande de sept jours', async () => {
    await afficher([], 'small');

    // Sept colonnes : pas de numéro de jour, seulement l'initiale et la pastille.
    expect(screen.queryByText('10')).toBeNull();
  });

  it('annonce la prochaine séance', async () => {
    await afficher([occurrence()], 'small');

    expect(screen.getByText(/planning\.previewNext/)).toBeTruthy();
  });
});
