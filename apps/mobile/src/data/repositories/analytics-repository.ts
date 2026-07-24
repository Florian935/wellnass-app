import { powerSync } from '@/powersync/system';
import type { AnalyticsEventRow } from '@/lib/analytics';

/** Insert append-only dans la table locale analytics_events (PowerSync synchronise). */
export async function insertAnalyticsEvent(row: AnalyticsEventRow): Promise<void> {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');
  await powerSync.execute(
    `INSERT INTO analytics_events (${columns.join(', ')}) VALUES (${placeholders})`,
    columns.map((c) => (row as Record<string, unknown>)[c]),
  );
}
