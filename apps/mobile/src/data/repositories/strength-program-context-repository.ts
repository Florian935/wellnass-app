import { useQuery } from '@powersync/react';
import {
  parseJsonColumn,
  strengthProgramContextSchema,
  type StrengthProgramContext,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';

type StrengthProgramContextDbRow = {
  id: string;
  user_id: string;
  training_level: string | null;
  weekly_availability: number | null;
  strength_session_minutes: number | null;
  strength_equipment: string | null;
  updated_at: string;
};

export type StrengthProgramContextSnapshot = {
  context: StrengthProgramContext;
  updatedAt: string;
};

export type StrengthProgramContextSaveErrorCode =
  | 'conflict'
  | 'profile_missing'
  | 'unauthenticated'
  | 'invalid';

export class StrengthProgramContextSaveError extends Error {
  constructor(public readonly code: StrengthProgramContextSaveErrorCode) {
    super(code);
    this.name = 'StrengthProgramContextSaveError';
  }
}

export const SELECT_STRENGTH_PROGRAM_CONTEXT = `
  SELECT id, user_id, training_level, weekly_availability,
         strength_session_minutes, strength_equipment, updated_at
  FROM profiles
  WHERE user_id = ? AND deleted_at IS NULL
  LIMIT 1
`;

function parseContext(row: StrengthProgramContextDbRow) {
  return strengthProgramContextSchema.safeParse({
    level: row.training_level,
    weeklyAvailability: row.weekly_availability,
    sessionMinutes: row.strength_session_minutes,
    equipment:
      row.strength_equipment === null
        ? null
        : parseJsonColumn<unknown>(row.strength_equipment, row.strength_equipment),
  });
}

export function useStrengthProgramContext(): {
  context: StrengthProgramContext | null;
  updatedAt: string | null;
  isLoading: boolean;
  error: unknown;
} {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const { data, isLoading, error: queryError } = useQuery<StrengthProgramContextDbRow>(
    SELECT_STRENGTH_PROGRAM_CONTEXT,
    [userId ?? ''],
  );
  const row = data.find((candidate) => candidate.user_id === userId);
  if (!row) {
    return { context: null, updatedAt: null, isLoading, error: queryError };
  }

  const parsed = parseContext(row);
  return {
    context: parsed.success ? parsed.data : null,
    updatedAt: row.updated_at,
    isLoading,
    error: queryError ?? (parsed.success ? undefined : parsed.error),
  };
}

export async function saveStrengthProgramContext(
  context: StrengthProgramContext,
  expectedUpdatedAt: string,
): Promise<StrengthProgramContextSnapshot> {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new StrengthProgramContextSaveError('unauthenticated');

  const parsed = strengthProgramContextSchema.safeParse(context);
  if (!parsed.success) throw new StrengthProgramContextSaveError('invalid');

  return powerSync.writeTransaction(async (tx) => {
    if (useAuthStore.getState().session?.user.id !== userId) {
      throw new StrengthProgramContextSaveError('unauthenticated');
    }

    const row = await tx.getOptional<StrengthProgramContextDbRow>(
      SELECT_STRENGTH_PROGRAM_CONTEXT,
      [userId],
    );
    if (useAuthStore.getState().session?.user.id !== userId) {
      throw new StrengthProgramContextSaveError('unauthenticated');
    }
    if (!row || row.user_id !== userId) {
      throw new StrengthProgramContextSaveError('profile_missing');
    }
    if (row.updated_at !== expectedUpdatedAt) {
      throw new StrengthProgramContextSaveError('conflict');
    }

    const updatedAt = new Date().toISOString();
    await tx.execute(
      `UPDATE profiles
       SET strength_session_minutes = ?, strength_equipment = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND updated_at = ? AND deleted_at IS NULL`,
      [
        parsed.data.sessionMinutes,
        parsed.data.equipment === null ? null : JSON.stringify(parsed.data.equipment),
        updatedAt,
        row.id,
        userId,
        expectedUpdatedAt,
      ],
    );

    return { context: parsed.data, updatedAt };
  });
}
