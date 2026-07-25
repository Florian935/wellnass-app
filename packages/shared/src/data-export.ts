// ---------------------------------------------------------------------------
// Export RGPD (CONF-01) — assemblage de l'enveloppe JSON d'export utilisateur.
// Logique PURE, sans dépendance native ni I/O. Patron identique à gpx.ts
// (buildGpx/gpxFileName).
// ---------------------------------------------------------------------------

/** Enveloppe JSON finale d'un export RGPD (en-tête + données par table). */
export type ExportEnvelope = {
  app: 'Wellness';
  formatVersion: number;
  exportedAt: string; // ISO UTC
  userId: string;
  syncComplete: boolean;
  data: Record<string, unknown[]>;
};

/** Assemble l'objet d'export final (en-tête RGPD + une section par table). Pur. */
export function buildExportEnvelope(input: {
  userId: string;
  exportedAt: string;
  syncComplete: boolean;
  tables: Record<string, unknown[]>;
}): ExportEnvelope {
  return {
    app: 'Wellness',
    formatVersion: 1,
    exportedAt: input.exportedAt,
    userId: input.userId,
    syncComplete: input.syncComplete,
    data: input.tables,
  };
}

/** Nom de fichier daté (date locale) : wellness-export-AAAA-MM-JJ.json. */
export function exportFileName(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `wellness-export-${yyyy}-${mm}-${dd}.json`;
}
