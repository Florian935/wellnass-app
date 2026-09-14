import { useQuery } from '@powersync/react';
import {
  createBodyTrainingDocument,
  parseBodyTrainingDocument,
  parseBodyVisualDocument,
  type BodyGoalZone,
  type BodyTrainingDocument,
  type BodyTrainingParseResult,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';

type BodyTrainingDbRow = {
  id: string;
  user_id: string;
  body_training_state: string | null;
  body_visual_state: string | null;
};

export type BodyTrainingSaveErrorCode =
  | 'conflict'
  | 'settings_missing'
  | 'unauthenticated'
  | 'invalid'
  | 'goal_missing';

export class BodyTrainingSaveError extends Error {
  constructor(public readonly code: BodyTrainingSaveErrorCode) {
    super(code);
    this.name = 'BodyTrainingSaveError';
  }
}

const SELECT_BODY_TRAINING = `
  SELECT id, user_id, body_training_state, body_visual_state
  FROM user_settings
  WHERE user_id = ? AND deleted_at IS NULL
  LIMIT 1
`;

export function useBodyTraining(): {
  document: BodyTrainingDocument | null;
  raw: string | null;
  status: BodyTrainingParseResult['status'];
  isLoading: boolean;
  error: unknown;
} {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const { data, isLoading, error } = useQuery<BodyTrainingDbRow>(SELECT_BODY_TRAINING, [userId]);
  const raw = data.find((row) => row.user_id === userId)?.body_training_state ?? null;
  const parsed = parseBodyTrainingDocument(raw);
  return { document: parsed.document, raw, status: parsed.status, isLoading, error };
}

/** Les deux snapshots sont comparés et relus dans la même transaction locale. */
export async function saveBodyTraining(
  priorities: BodyGoalZone[] | null,
  expectedRaw: string | null,
  expectedVisualRaw: string | null,
): Promise<BodyTrainingDocument | null> {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new BodyTrainingSaveError('unauthenticated');

  return powerSync.writeTransaction(async (tx) => {
    const row = await tx.getOptional<BodyTrainingDbRow>(SELECT_BODY_TRAINING, [userId]);
    if (useAuthStore.getState().session?.user.id !== userId) {
      throw new BodyTrainingSaveError('unauthenticated');
    }
    if (!row || row.user_id !== userId) throw new BodyTrainingSaveError('settings_missing');
    if (row.body_training_state !== expectedRaw || row.body_visual_state !== expectedVisualRaw) {
      throw new BodyTrainingSaveError('conflict');
    }

    const training = parseBodyTrainingDocument(row.body_training_state);
    const visual = parseBodyVisualDocument(row.body_visual_state);
    if (
      (training.status !== 'ready' && training.status !== 'empty') ||
      (visual.status !== 'ready' && visual.status !== 'empty')
    ) {
      throw new BodyTrainingSaveError('invalid');
    }

    const now = new Date().toISOString();
    let prepared: BodyTrainingDocument | null = null;
    if (priorities !== null) {
      const goal = visual.document?.goal;
      if (!goal?.savedAt) throw new BodyTrainingSaveError('goal_missing');
      try {
        prepared = createBodyTrainingDocument(priorities, goal, now);
      } catch {
        throw new BodyTrainingSaveError('invalid');
      }
    }

    await tx.execute(
      `UPDATE user_settings
       SET body_training_state = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [prepared === null ? null : JSON.stringify(prepared), now, row.id, userId],
    );
    return prepared;
  });
}
