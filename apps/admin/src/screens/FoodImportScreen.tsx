import { useState, type ChangeEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { parseFoodCsv, type FoodCsvRowError, type FoodImportRecord } from '@wellness/shared';
import { buildCsvTemplate, importFoods, type ImportResult } from '../data/foods';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

type Phase = 'idle' | 'parsed' | 'importing' | 'done' | 'error';

/**
 * Import d'aliments éditoriaux par CSV (US 8.6). Upload → parse (papaparse) →
 * validation (`parseFoodCsv`, partagé) → aperçu (N valides / M erreurs par ligne) →
 * confirmation → upsert idempotent (`importFoods`) → rapport. Réservé aux éditeurs
 * de contenu (gate en amont ; la RLS est la frontière). Écran admin FR.
 */
export function FoodImportScreen() {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState<string | null>(null);
  const [valid, setValid] = useState<FoodImportRecord[]>([]);
  const [errors, setErrors] = useState<FoodCsvRowError[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [report, setReport] = useState<ImportResult | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileError(null);
    setReport(null);
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const rows = parsed.data ?? [];
    if (rows.length === 0) {
      setValid([]);
      setErrors([]);
      setPhase('idle');
      setFileError(fr.foods.parseErrorFile);
      return;
    }
    const result = parseFoodCsv(rows);
    setValid(result.valid);
    setErrors(result.errors);
    setPhase('parsed');
  };

  const onImport = async () => {
    setPhase('importing');
    try {
      setReport(await importFoods(valid));
      setPhase('done');
    } catch {
      setPhase('error');
    }
  };

  const onDownloadTemplate = () => {
    const blob = new Blob([buildCsvTemplate()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-aliments.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFileName(null);
    setValid([]);
    setErrors([]);
    setFileError(null);
    setReport(null);
    setPhase('idle');
  };

  const importDisabled = valid.length === 0 || phase === 'importing';

  return (
    <div style={styles.page}>
      <button type="button" style={styles.linkBtn} onClick={() => navigate('/foods')}>
        ← {fr.foods.backToList}
      </button>
      <h1 style={styles.title}>{fr.foods.importTitle}</h1>
      <p style={styles.subtitle}>{fr.foods.importSubtitle}</p>

      <div style={styles.actions}>
        <label style={styles.fileBtn}>
          {fr.foods.pickFile}
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
        </label>
        <button type="button" style={styles.linkBtn} onClick={onDownloadTemplate}>
          {fr.foods.template}
        </button>
        {fileName ? <span style={styles.fileName}>{fileName}</span> : null}
      </div>

      {fileError ? <p style={styles.error}>{fileError}</p> : null}

      {phase === 'parsed' || phase === 'importing' ? (
        <>
          <p style={styles.summary}>
            <strong>{valid.length}</strong> {fr.foods.validSuffix} · <strong>{errors.length}</strong>{' '}
            {fr.foods.errorsSuffix}
          </p>

          {errors.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{fr.foods.errColRow}</th>
                  <th style={styles.th}>{fr.foods.errColField}</th>
                  <th style={styles.th}>{fr.foods.errColReason}</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((err, i) => (
                  <tr key={`${err.rowIndex}-${err.field}-${i}`}>
                    <td style={styles.td}>{err.rowIndex}</td>
                    <td style={styles.td}>{err.field}</td>
                    <td style={styles.td}>{err.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <button
            type="button"
            style={{ ...styles.primary, ...(importDisabled ? styles.disabled : {}) }}
            disabled={importDisabled}
            onClick={onImport}
          >
            {phase === 'importing' ? fr.foods.importing : fr.foods.importCta}
          </button>
          {valid.length === 0 ? <p style={styles.muted}>{fr.foods.noValid}</p> : null}
        </>
      ) : null}

      {phase === 'done' && report ? (
        <div style={styles.reportBox}>
          <h2 style={styles.reportTitle}>{fr.foods.reportTitle}</h2>
          <p>
            <strong>{report.created}</strong> {fr.foods.createdSuffix} ·{' '}
            <strong>{report.updated}</strong> {fr.foods.updatedSuffix}
            {report.reactivated > 0 && (
              <>
                {' · '}
                <strong>{report.reactivated}</strong> {fr.foods.reactivatedSuffix}
              </>
            )}
          </p>
          <button type="button" style={styles.linkBtn} onClick={reset}>
            {fr.foods.reset}
          </button>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div>
          <p style={styles.error}>{fr.foods.importError}</p>
          <button type="button" style={styles.primary} onClick={onImport}>
            {fr.foods.importCta}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { padding: '24px', maxWidth: '820px' },
  title: { color: theme.colors.ink, fontSize: '22px', margin: '0 0 4px' },
  subtitle: { color: theme.colors.muted, margin: '0 0 20px' },
  actions: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  fileBtn: {
    display: 'inline-block',
    background: theme.colors.accent,
    color: theme.colors.accentInk,
    padding: '10px 16px',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    fontWeight: 600,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: theme.colors.accent,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
  fileName: { color: theme.colors.muted },
  summary: { color: theme.colors.ink, margin: '20px 0 10px' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: theme.colors.panel,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    marginBottom: '16px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    color: theme.colors.muted,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: '13px',
  },
  td: {
    padding: '8px 12px',
    color: theme.colors.ink,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: '14px',
  },
  primary: {
    background: theme.colors.accent,
    color: theme.colors.accentInk,
    border: 'none',
    padding: '10px 18px',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    fontWeight: 600,
  },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  muted: { color: theme.colors.muted, marginTop: '8px' },
  error: {
    color: theme.colors.danger,
    background: theme.colors.dangerBg,
    border: `1px solid ${theme.colors.dangerBorder}`,
    padding: '10px 12px',
    borderRadius: theme.radius.md,
  },
  reportBox: {
    marginTop: '20px',
    padding: '16px',
    background: theme.colors.panel,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
  },
  reportTitle: { color: theme.colors.ink, fontSize: '18px', margin: '0 0 8px' },
};
