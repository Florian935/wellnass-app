import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FOOD_CATEGORIES, type FoodCategory } from '@wellness/shared';
import { archiveFood, listEditorialFoods, type AdminFoodRow } from '../data/foods';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

type CategoryFilter = 'all' | FoodCategory;

/**
 * Liste des aliments éditoriaux (US 8.5). Tableau (nom FR, catégorie traduite, kcal/100 g,
 * date), recherche par nom (FR/EN), filtre par catégorie, boutons « Nouvel aliment » et
 * « Importer un CSV », actions éditer / archiver (avec confirmation). États loading / vide /
 * erreur. Réservé aux éditeurs de contenu (gate en amont ; la RLS est la frontière).
 */
export function FoodsScreen() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<AdminFoodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { rows: fetched, error: err } = await listEditorialFoods();
    setRows(fetched);
    setError(Boolean(err));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (term) {
        const haystack = `${r.nameFr ?? ''} ${r.nameEn ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, categoryFilter]);

  async function handleArchive(row: AdminFoodRow) {
    if (!window.confirm(fr.foods.archiveConfirm)) return;
    setBusyId(row.id);
    const { error: err } = await archiveFood(row.id);
    setBusyId(null);
    if (err) {
      setError(true);
      return;
    }
    await reload();
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.h2}>{fr.foods.listTitle}</h2>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondary} onClick={() => navigate('/foods/import')}>
              {fr.foods.importNav}
            </button>
            <button type="button" style={styles.primary} onClick={() => navigate('/foods/new')}>
              {fr.foods.new}
            </button>
          </div>
        </div>

        <div style={styles.filters}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={fr.foods.search}
            style={{ ...styles.input, flex: 1, minWidth: 180 }}
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            style={styles.input}
          >
            <option value="all">{fr.foods.filterCategory}</option>
            {FOOD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {fr.foods.categoryNames[c]}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div style={styles.error} role="alert">
            {fr.foods.error}
          </div>
        )}

        {loading ? (
          <p style={styles.muted}>{fr.foods.loading}</p>
        ) : filtered.length === 0 ? (
          <p style={styles.muted}>{fr.foods.empty}</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{fr.foods.colName}</th>
                  <th style={styles.th}>{fr.foods.colCategory}</th>
                  <th style={styles.th}>{fr.foods.colKcal}</th>
                  <th style={styles.th}>{fr.foods.colDate}</th>
                  <th style={styles.th}>{fr.foods.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={styles.td}>{r.nameFr ?? fr.foods.noName}</td>
                    <td style={styles.td}>{fr.foods.categoryNames[r.category]}</td>
                    <td style={styles.td}>{r.kcalPer100g}</td>
                    <td style={styles.td}>{formatDate(r.createdAt)}</td>
                    <td style={{ ...styles.td, ...styles.actionsCell }}>
                      <button
                        type="button"
                        style={styles.action}
                        onClick={() => navigate(`/foods/${r.id}`)}
                      >
                        {fr.foods.edit}
                      </button>
                      <button
                        type="button"
                        style={styles.danger}
                        disabled={busyId === r.id}
                        onClick={() => handleArchive(r)}
                      >
                        {fr.foods.archive}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Date JJ/MM/AAAA (convention projet). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

const { colors, radius, font } = theme;

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 },
  panel: {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: 20,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  h2: { margin: 0, fontSize: 15 },
  primary: {
    border: 'none',
    borderRadius: radius.md,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    background: colors.accent,
    color: colors.accentInk,
    fontFamily: font,
  },
  secondary: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.md,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    color: colors.ink,
    fontFamily: font,
  },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
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
    marginBottom: 12,
  },
  muted: { color: colors.muted, fontSize: 13, margin: 0 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.muted,
    fontWeight: 600,
    fontSize: 11.5,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 10px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.ink,
    verticalAlign: 'middle',
  },
  actionsCell: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  action: {
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
  danger: {
    border: `1px solid ${colors.dangerBorder}`,
    background: '#fff',
    borderRadius: radius.sm,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: colors.danger,
    cursor: 'pointer',
    fontFamily: font,
  },
};
