/**
 * MUSC-F13 — la carte de contexte adapte ses **suppléments** au niveau d'affichage
 * (`simplified` / `normal` / `detailed`), sans jamais toucher aux repères de base.
 *
 * ── Ce que l'US MUSCU-UX01 change au contrat, et ce qu'elle n'y change pas ──────────────────────
 * Inchangé : quel supplément apparaît à quel niveau. C'est la règle de MUSC-F13, portée par
 * `workoutFieldVisibility`, et elle est intacte.
 *
 * Changé : **où** ils apparaissent. Les suppléments du niveau `detailed` (type de série, RPE, note,
 * superset) sont regroupés derrière un repli unique au lieu d'être empilés — ils servent à quelques
 * séries par séance. Les tests ouvrent donc le repli avant de vérifier leur présence.
 *
 * Et surtout : **la saisie et la validation ne sont plus dans cette carte**. Elles vivent dans
 * `SetActionBar`, fixée en bas de l'écran et identique aux trois niveaux (règle R4-1) — c'est
 * précisément ce qui rend le changement de niveau sans risque, et donc proposable depuis la séance.
 * Le test le vérifie explicitement : aucun niveau ne doit faire apparaître un bouton de validation
 * ici.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import '@/i18n';
import { CurrentSetCard } from './CurrentSetCard';
import { palettes } from '@/theme/colors';
import fr from '@/i18n/locales/fr.json';

const colors = palettes.light;

const baseProps = {
  exerciseName: 'Développé couché',
  sets: [
    { id: 's1', done: true, label: '80×8' },
    { id: 's2', done: false, label: null },
    { id: 's3', done: false, label: null },
  ],
  currentRang: 1,
  restSeconds: 90,
  lastPerfLabel: '80 kg × 8/8/7',
  suggestionLabel: 'Essaie 82,5 kg',
  plannedLabel: '80 kg',
  deltaLabel: '▲ +2.5',
  setType: 'normal' as const,
  onSetType: jest.fn(),
  rpe: null,
  onSetRpe: jest.fn(),
  note: '',
  supersetLink: { status: 'linkable' as const },
  onAddSet: jest.fn(),
  colors,
};

/**
 * Ouvre le repli des suppléments s'il est présent ; sinon ne fait rien.
 *
 * `render` est asynchrone dans cette version de RNTL : son type de retour est une `Promise`, d'où
 * le `Awaited` — sans lui, le helper reçoit la promesse et non la vue.
 */
const ouvrirSupplements = async (vue: Awaited<ReturnType<typeof render>>) => {
  const toggle = vue.queryByText(fr.workout.extras.title);
  if (!toggle) return;
  await act(async () => {
    fireEvent.press(toggle);
  });
};

describe('CurrentSetCard — niveaux d’affichage (MUSC-F13)', () => {
  it('simplified : aucun supplément, mais les repères de base restent', async () => {
    const vue = await render(<CurrentSetCard {...baseProps} level="simplified" />);

    // Les repères que tout le monde doit voir, quel que soit le niveau.
    expect(vue.getByText('Développé couché')).toBeTruthy();
    expect(vue.getByText('80 kg × 8/8/7')).toBeTruthy();
    expect(vue.getByText('80 kg')).toBeTruthy();

    // Aucun supplément : ni repli, ni échauffement, ni suggestion, ni écart.
    expect(vue.queryByText(fr.workout.extras.title)).toBeNull();
    expect(vue.queryByText(fr.workout.warmupToggle)).toBeNull();
    expect(vue.queryByText('Essaie 82,5 kg')).toBeNull();
    expect(vue.queryByText('▲ +2.5')).toBeNull();
  });

  it('normal : échauffement, suggestion et écart, mais rien du repli', async () => {
    const vue = await render(<CurrentSetCard {...baseProps} level="normal" />);

    expect(vue.getByText(fr.workout.warmupToggle)).toBeTruthy();
    expect(vue.getByText('Essaie 82,5 kg')).toBeTruthy();
    expect(vue.getByText('▲ +2.5')).toBeTruthy();

    // Le repli n'existe pas à ce niveau : il n'aurait rien à contenir.
    expect(vue.queryByText(fr.workout.extras.title)).toBeNull();
  });

  it('detailed : le repli existe, et contient type, intensité, note et superset', async () => {
    const vue = await render(<CurrentSetCard {...baseProps} level="detailed" />);

    // Fermé par défaut : ces réglages servent à quelques séries, pas à toutes.
    expect(vue.queryByText(fr.workout.setType.dropset)).toBeNull();

    await ouvrirSupplements(vue);

    expect(vue.getByText(fr.workout.setType.dropset)).toBeTruthy();
    expect(vue.getByText('RPE série')).toBeTruthy();
    expect(vue.getByPlaceholderText(fr.workout.exerciseNote.placeholder)).toBeTruthy();
    expect(vue.getByText(fr.workout.superset.link)).toBeTruthy();
  });

  // ⚠️ Un cas de test par niveau, et **pas** une boucle avec `unmount()` : démonter au milieu d'un
  // test laisse l'arbre précédent dans un état mort et fait tomber les tests SUIVANTS du fichier.
  // Piège déjà rencontré le 09/08/2026 sur `strength-widgets.test.tsx`, et retombé dedans ici.
  it.each(['simplified', 'normal', 'detailed'] as const)(
    '🔴 au niveau %s, ni saisie ni validation dans la carte',
    async (level) => {
      // Règle R4-1 : elles vivent dans la barre fixe. Si elles revenaient ici, le geste
      // redeviendrait dépendant du niveau d'affichage — le défaut que l'US corrige.
      const vue = await render(<CurrentSetCard {...baseProps} level={level} />);
      await ouvrirSupplements(vue);

      expect(vue.queryByText(fr.workout.validateSet)).toBeNull();
      expect(vue.queryByText(fr.workout.reps)).toBeNull();
    },
  );

  it('🔴 la frise montre les séries faites, pas seulement le rang', async () => {
    // « Série 2/3 » disait où on en était sans jamais montrer ce qui avait déjà été posé.
    const vue = await render(<CurrentSetCard {...baseProps} level="simplified" />);

    expect(vue.getByText('80×8')).toBeTruthy();
    expect(vue.getByText('Série 2/3')).toBeTruthy();
  });

  it('le repos est affiché en lecture, sans contrôle de réglage', async () => {
    // Il occupait une ligne éditable sur chaque série, à tous les niveaux, alors que c'est un
    // réglage d'exercice. Il se règle désormais depuis le menu ou l'écran de repos.
    const vue = await render(<CurrentSetCard {...baseProps} level="detailed" />);

    expect(vue.getByText('90 s')).toBeTruthy();
    expect(vue.queryByText(fr.workout.restTitle)).toBeNull();
  });
});
