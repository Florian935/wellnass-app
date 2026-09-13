import { useQuery } from '@powersync/react';
import {
  bodyVisualDocumentSchema,
  parseBodyVisualDocument,
  prepareBodyVisualSave,
  type BodyVisualDocument,
  type BodyVisualParseResult,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';

type BodyVisualDbRow = {
  id: string;
  user_id: string;
  body_visual_state: string | null;
};

export type BodyVisualSaveErrorCode =
  | 'conflict'
  | 'settings_missing'
  | 'unauthenticated'
  | 'invalid';

export class BodyVisualSaveError extends Error {
  constructor(public readonly code: BodyVisualSaveErrorCode) {
    super(code);
    this.name = 'BodyVisualSaveError';
  }
}

const SELECT_BODY_VISUAL = `
  SELECT id, user_id, body_visual_state
  FROM user_settings
  WHERE user_id = ? AND deleted_at IS NULL
  LIMIT 1
`;

export function useBodyVisual(): {
  document: BodyVisualDocument | null;
  raw: string | null;
  status: BodyVisualParseResult['status'];
  isLoading: boolean;
  error: unknown;
} {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const { data, isLoading, error } = useQuery<BodyVisualDbRow>(SELECT_BODY_VISUAL, [userId ?? '']);
  const raw = data[0]?.body_visual_state ?? null;
  const parsed = parseBodyVisualDocument(raw);

  return {
    document: parsed.document,
    raw,
    status: parsed.status,
    isLoading,
    error,
  };
}

export async function saveBodyVisual(
  draft: BodyVisualDocument,
  expectedRaw: string | null,
): Promise<BodyVisualDocument> {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new BodyVisualSaveError('unauthenticated');

  if (!bodyVisualDocumentSchema.safeParse(draft).success) {
    throw new BodyVisualSaveError('invalid');
  }

  const previousResult = parseBodyVisualDocument(expectedRaw);
  if (previousResult.status !== 'ready' && previousResult.status !== 'empty') {
    throw new BodyVisualSaveError('invalid');
  }
  const previous = previousResult.document;

  return powerSync.writeTransaction(async (tx) => {
    const row = await tx.getOptional<BodyVisualDbRow>(SELECT_BODY_VISUAL, [userId]);
    if (!row || row.user_id !== userId) {
      throw new BodyVisualSaveError('settings_missing');
    }
    if (row.body_visual_state !== expectedRaw) {
      throw new BodyVisualSaveError('conflict');
    }

    let prepared: BodyVisualDocument;
    try {
      prepared = prepareBodyVisualSave(draft, previous, new Date().toISOString());
    } catch {
      throw new BodyVisualSaveError('invalid');
    }

    await tx.execute(
      `UPDATE user_settings
       SET body_visual_state = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [JSON.stringify(prepared), prepared.updatedAt, row.id, userId],
    );

    return prepared;
  });
}
