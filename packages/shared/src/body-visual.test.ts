import { describe, expect, it } from 'vitest';
import {
  BODY_GOAL_ZONES,
  BODY_SHAPE_ZONES,
  bodyGoalUsesCurrentBaseline,
  bodyGoalZones,
  bodyVisualDirty,
  bodyVisualDocumentSchema,
  createBodyVisualDocument,
  createBodyVisualGoal,
  parseBodyVisualDocument,
  prepareBodyVisualSave,
  type BodyVisualDocument,
} from './body-visual';

const T1 = '2026-09-12T08:00:00.000Z';
const T2 = '2026-09-12T09:00:00.000Z';

function savedDocument(): BodyVisualDocument {
  return prepareBodyVisualSave(createBodyVisualDocument(), null, T1);
}

describe('schémas de la silhouette', () => {
  it.each([-2.25, 2.25, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejette une proportion hors contrat : %s',
    (value) => {
      const document = createBodyVisualDocument();
      document.baseline.proportions.arms = value;
      expect(bodyVisualDocumentSchema.safeParse(document).success).toBe(false);
    },
  );

  it('rejette une proportion qui ne suit pas le pas de 0,25', () => {
    const document = createBodyVisualDocument();
    document.baseline.proportions.waist = 0.1;
    expect(bodyVisualDocumentSchema.safeParse(document).success).toBe(false);
  });

  it.each([-1, 5, 1.5, Number.NaN, Number.NEGATIVE_INFINITY])(
    'rejette une emphase hors contrat : %s',
    (value) => {
      const document = createBodyVisualDocument();
      document.goal = createBodyVisualGoal(document);
      document.goal.emphasis.back = value;
      expect(bodyVisualDocumentSchema.safeParse(document).success).toBe(false);
    },
  );
});

describe('création', () => {
  it('crée un document équilibré, sans objectif ni horodatage inventé', () => {
    expect(createBodyVisualDocument()).toEqual({
      version: 1,
      assetVersion: 'body-shape-v1',
      baseline: {
        base: 'balanced',
        proportions: {
          shoulders: 0,
          chest: 0,
          waist: 0,
          hips: 0,
          arms: 0,
          thighs: 0,
          calves: 0,
        },
      },
      baselineSavedAt: null,
      goal: null,
      updatedAt: null,
    });
  });

  it('copie la silhouette dans un objectif indépendant', () => {
    const document = createBodyVisualDocument();
    const goal = createBodyVisualGoal(document);
    document.baseline.proportions.arms = 2;
    expect(goal.baseline.proportions.arms).toBe(0);
    expect(goal.emphasis).toEqual({
      shoulders: 0,
      chest: 0,
      back: 0,
      arms: 0,
      glutes: 0,
      thighs: 0,
      calves: 0,
    });
    expect(goal.savedAt).toBeNull();
  });
});

describe('lecture versionnée', () => {
  it('distingue absence, document illisible et version future', () => {
    expect(parseBodyVisualDocument(null)).toEqual({ status: 'empty', document: null });
    expect(parseBodyVisualDocument('{')).toEqual({ status: 'invalid', document: null });
    expect(parseBodyVisualDocument({ version: 99 })).toEqual({
      status: 'unsupported',
      document: null,
    });
  });

  it('classe une version antérieure ou non entière comme invalide, pas comme future', () => {
    expect(parseBodyVisualDocument({ version: 0 })).toEqual({
      status: 'invalid',
      document: null,
    });
    expect(parseBodyVisualDocument({ version: Number.NaN })).toEqual({
      status: 'invalid',
      document: null,
    });
  });

  it('accepte une chaîne JSON valide sans partager ses objets avec l’entrée', () => {
    const input = createBodyVisualDocument();
    const parsed = parseBodyVisualDocument(JSON.stringify(input));
    expect(parsed.status).toBe('ready');
    if (parsed.status !== 'ready') throw new Error('Document attendu prêt');
    input.baseline.proportions.chest = 2;
    expect(parsed.document.baseline.proportions.chest).toBe(0);
  });
});

describe('comparaisons sémantiques', () => {
  it('ignore l’ordre des clés des proportions', () => {
    const saved = savedDocument();
    const draft = JSON.parse(JSON.stringify(saved)) as BodyVisualDocument;
    draft.baseline.proportions = {
      calves: 0,
      thighs: 0,
      arms: 0,
      hips: 0,
      waist: 0,
      chest: 0,
      shoulders: 0,
    };
    expect(bodyVisualDirty(draft, saved)).toBe(false);
  });

  it('considère le document vide par défaut comme un brouillon propre', () => {
    expect(bodyVisualDirty(createBodyVisualDocument(), null)).toBe(false);
  });

  it('détecte une vraie modification de forme ou d’objectif', () => {
    const saved = savedDocument();
    const draft = structuredClone(saved);
    draft.baseline.proportions.shoulders = 0.25;
    expect(bodyVisualDirty(draft, saved)).toBe(true);

    const withGoal = structuredClone(saved);
    withGoal.goal = createBodyVisualGoal(withGoal);
    expect(bodyVisualDirty(withGoal, saved)).toBe(true);
  });
});

describe('préparation de sauvegarde', () => {
  it('garde la date du snapshot si le départ revient à sa forme et une intention change', () => {
    const original = createBodyVisualDocument();
    original.goal = createBodyVisualGoal(original);
    const first = prepareBodyVisualSave(original, null, T1);
    const other = structuredClone(first);
    other.baseline.proportions.arms = 1;
    const second = prepareBodyVisualSave(other, first, T2);
    const draft = structuredClone(second);
    draft.baseline.proportions.arms = 0;
    draft.goal!.emphasis.arms = 2;
    const third = prepareBodyVisualSave(draft, second, '2026-09-12T10:00:00.000Z');
    expect(third.goal?.baselineSavedAt).toBe(T1);
  });

  it('date au premier enregistrement un snapshot issu d’une forme intermédiaire du brouillon', () => {
    const previous = savedDocument();
    const draft = structuredClone(previous);
    draft.baseline.proportions.arms = 1;
    draft.goal = createBodyVisualGoal(draft);
    draft.baseline.proportions.arms = 2;
    const next = prepareBodyVisualSave(draft, previous, T2);
    expect(next.goal?.baseline.proportions.arms).toBe(1);
    expect(next.goal?.baselineSavedAt).toBe(T2);
  });

  it('horodate la première sauvegarde sans muter le brouillon', () => {
    const draft = createBodyVisualDocument();
    const prepared = prepareBodyVisualSave(draft, null, T1);
    expect(prepared.baselineSavedAt).toBe(T1);
    expect(prepared.updatedAt).toBe(T1);
    expect(draft.baselineSavedAt).toBeNull();
    expect(draft.updatedAt).toBeNull();
  });

  it('ne change aucun horodatage quand le contenu métier est identique', () => {
    const previous = savedDocument();
    const draft = structuredClone(previous);
    expect(prepareBodyVisualSave(draft, previous, T2)).toEqual(previous);
  });

  it('horodate uniquement le départ et le document quand le départ change', () => {
    const previous = savedDocument();
    previous.goal = createBodyVisualGoal(previous);
    previous.goal.savedAt = T1;
    const draft = structuredClone(previous);
    draft.baseline.proportions.arms = 1;
    const prepared = prepareBodyVisualSave(draft, previous, T2);
    expect(prepared.baselineSavedAt).toBe(T2);
    expect(prepared.updatedAt).toBe(T2);
    expect(prepared.goal).toEqual(previous.goal);
    expect(prepared.goal?.baseline.proportions.arms).toBe(0);
  });

  it('lie au nouvel horodatage une cible créée depuis un départ modifié dans le même brouillon', () => {
    const previous = savedDocument();
    const draft = structuredClone(previous);
    draft.baseline.proportions.thighs = 1;
    draft.goal = createBodyVisualGoal(draft);
    draft.goal.emphasis.glutes = 2;
    const prepared = prepareBodyVisualSave(draft, previous, T2);
    expect(prepared.baselineSavedAt).toBe(T2);
    expect(prepared.goal?.baselineSavedAt).toBe(T2);
    expect(prepared.goal?.savedAt).toBe(T2);
    expect(prepared.goal?.baseline.proportions.thighs).toBe(1);
  });

  it('préserve le snapshot et sa date quand seul le départ courant change', () => {
    const previous = savedDocument();
    previous.goal = createBodyVisualGoal(previous);
    previous.goal.savedAt = T1;
    const draft = structuredClone(previous);
    draft.baseline.base = 'broad_shoulders';
    const prepared = prepareBodyVisualSave(draft, previous, T2);
    expect(prepared.goal).toEqual(previous.goal);
    expect(bodyGoalUsesCurrentBaseline(prepared)).toBe(false);
  });
});

describe('zones renforcées', () => {
  it('renvoie dans l’ordre canonique les zones dont l’emphase est positive', () => {
    const goal = createBodyVisualGoal(createBodyVisualDocument());
    goal.emphasis.calves = 1;
    goal.emphasis.shoulders = 4;
    goal.emphasis.back = 2;
    expect(bodyGoalZones(goal.emphasis)).toEqual(['shoulders', 'back', 'calves']);
    expect(BODY_SHAPE_ZONES).toHaveLength(7);
    expect(BODY_GOAL_ZONES).toHaveLength(7);
  });
});
