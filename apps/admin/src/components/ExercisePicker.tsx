import { useEffect, useMemo, useState } from 'react';
import { listEditorialExercises, type AdminExerciseRow } from '../data/exercises';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Sélecteur d'exercice éditorial **publié** (US 8.4 — constructeur de programmes).
 * Charge les exercices éditoriaux au montage, ne garde que les publiés
 * (`status === 'published'`), propose une recherche par nom (FR/EN, insensible à
 * la casse) et une liste scrollable. Un clic sur un exercice remonte son id et son
 * nom FR au parent (`onPick`) ; un bouton annule (`onCancel`).
 *
 * Rendu en panneau bordé inline (cohérent avec l'écran des exercices) — pas de
 * modale complète. États loading / erreur / vide. Libellés via `fr.programs.*`.
 */
export type ExercisePickerProps = {
  /** Sélection d'un exercice : id + nom FR (peut être null si non traduit). */
  onPick: (exerciseId: string, nameFr: string | null) => void;
  /** Fermeture sans sélection. */
  onCancel: () => void;
};

/** Libellé FR d'un groupe musculaire (repli sur la clé si inconnue). */
function groupLabel(group: string): string {
  const names = fr.exercises.groupNames as Record<string, string>;
  return names[group] ?? group;
}

export function ExercisePicker({ onPick, onCancel }: ExercisePickerProps) {
  const [rows, setRows] = useState<AdminExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { rows: fetched, error: err } = await listEditorialExercises();
      if (cancelled) return;
      setRows(fetched.filter((r) => r.status === 'published'));
      setError(Boolean(err));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const haystack = `${r.nameFr ?? ''} ${r.nameEn ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search]);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.h3}>{fr.programs.pickerTitle}</h3>
        <button type="button" style={styles.cancel} onClick={onCancel}>
          {fr.programs.pickerCancel}
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={fr.programs.pickerSearch}
        style={styles.input}
      />

      {error ? (
        <div style={styles.error} role="alert">
          {fr.programs.pickerError}
        </div>
      ) : loading ? (
        <p style={styles.muted}>{fr.programs.pickerLoading}</p>
      ) : filtered.length === 0 ? (
        <p style={styles.muted}>{fr.programs.pickerEmpty}</p>
      ) : (
        <ul style={styles.list}>
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                style={styles.item}
                onClick={() => onPick(r.id, r.nameFr)}
              >
                <span style={styles.itemName}>
                  {r.nameFr ?? r.nameEn ?? fr.programs.noName}
                </span>
                <span style={styles.itemGroup}>{groupLabel(r.musclePrimary)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const { colors, radius, font } = theme;

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxWidth: 480,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  h3: { margin: 0, fontSize: 14 },
  cancel: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.sm,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: colors.ink,
    cursor: 'pointer',
    fontFamily: font,
  },
  input: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '9px 11px',
    fontSize: 14,
    background: colors.field,
    color: colors.ink,
    fontFamily: font,
  },
  error: {
    background: colors.dangerBg,
    border: `1px solid ${colors.dangerBorder}`,
    color: colors.danger,
    fontSize: 12.5,
    borderRadius: radius.sm,
    padding: '8px 10px',
  },
  muted: { color: colors.muted, fontSize: 13, margin: 0 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 320,
    overflowY: 'auto',
  },
  item: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.sm,
    padding: '8px 11px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: font,
    textAlign: 'left',
  },
  itemName: { color: colors.ink, fontWeight: 600 },
  itemGroup: { color: colors.muted, fontSize: 11.5, whiteSpace: 'nowrap' },
};
