/**
 * US ADMIN-01 — message de confirmation d'archivage.
 *
 * Lot 4 de [strategie-tests.md](../../../../docs/specs/technical/strategie-tests.md).
 *
 * Brique pure, mais **c'est elle qui porte la valeur de l'US** : on n'archive plus en aveugle. Les
 * trois cas doivent rester **distincts**, et c'est la seule chose qui compte ici — si « aucun
 * usage » et « décompte indisponible » finissaient par produire le même texte, l'admin
 * archiverait un contenu référencé partout en croyant qu'il ne sert à rien. Un rendu vert dans le
 * navigateur ne dit pas lequel des trois messages s'est affiché.
 */

import { describe, expect, it } from 'vitest';
import type { UsageSummary } from '@wellness/shared';

import { archiveConfirmMessage } from './archive-confirm';
import { fr } from '../i18n/fr';

const BASE = 'Archiver cet exercice (et ses traductions) ?';

const summary = (over: Partial<UsageSummary>): UsageSummary => ({
  lines: [],
  total: 0,
  isUnused: false,
  unavailable: false,
  ...over,
});

describe('archiveConfirmMessage', () => {
  it('liste les usages puis demande confirmation', () => {
    const message = archiveConfirmMessage(
      BASE,
      summary({
        lines: [
          { key: 'workout_sets', count: 12 },
          { key: 'exercise_plans', count: 3 },
        ],
      }),
    );

    expect(message).toContain(BASE);
    expect(message).toContain(fr.archive.usageIntro);
    expect(message).toContain('12 séries réalisées');
    expect(message).toContain('3 exercices planifiés dans des programmes');
    expect(message).toContain(fr.archive.usageConfirm);
  });

  it('dit explicitement qu’il n’y a aucun usage — une liste vide se lirait comme un bug', () => {
    const message = archiveConfirmMessage(BASE, summary({ isUnused: true }));

    expect(message).toContain(fr.archive.usageNone);
    expect(message).not.toContain(fr.archive.usageIntro);
  });

  it('avertit quand le décompte est indisponible, au lieu de laisser croire à un zéro', () => {
    const message = archiveConfirmMessage(BASE, summary({ unavailable: true }));

    expect(message).toContain(fr.archive.usageUnavailable);
    expect(message).toContain(fr.archive.usageConfirm);
    expect(message).not.toContain(fr.archive.usageNone);
  });

  it('fait primer « indisponible » sur « aucun usage » quand les deux sont posés', () => {
    // Combinaison théoriquement impossible, mais l'ordre des branches est un choix de sûreté :
    // face au doute, on avertit plutôt que de rassurer.
    const message = archiveConfirmMessage(
      BASE,
      summary({ unavailable: true, isUnused: true }),
    );

    expect(message).toContain(fr.archive.usageUnavailable);
    expect(message).not.toContain(fr.archive.usageNone);
  });

  it('produit trois messages deux à deux différents', () => {
    const withUsage = archiveConfirmMessage(
      BASE,
      summary({ lines: [{ key: 'workout_sets', count: 1 }] }),
    );
    const unused = archiveConfirmMessage(BASE, summary({ isUnused: true }));
    const unavailable = archiveConfirmMessage(BASE, summary({ unavailable: true }));

    expect(new Set([withUsage, unused, unavailable]).size).toBe(3);
  });

  it('affiche la clé brute plutôt que rien pour un usage inconnu', () => {
    const message = archiveConfirmMessage(
      BASE,
      summary({ lines: [{ key: 'table_future', count: 2 } as never] }),
    );

    // Un libellé manquant ne doit pas faire disparaître la ligne : mieux vaut « 2 table_future »
    // qu'un décompte tronqué qui sous-estimerait l'usage réel.
    expect(message).toContain('2 table_future');
  });

  it('conserve le texte de base en tête, quel que soit le cas', () => {
    for (const s of [
      summary({ lines: [{ key: 'workout_sets', count: 1 }] }),
      summary({ isUnused: true }),
      summary({ unavailable: true }),
    ]) {
      expect(archiveConfirmMessage(BASE, s).startsWith(BASE)).toBe(true);
    }
  });
});
