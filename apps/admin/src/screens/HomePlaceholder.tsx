import { fr } from '../i18n/fr';
import { theme } from '../theme';

const { colors, radius } = theme;

/**
 * Page d'accueil (placeholder) : message + liste des futurs modules, non
 * cliquables (livrés aux lots CRUD 8.2→8.10). Aucune donnée/action admin en F1.
 */
export function HomePlaceholder() {
  return (
    <div style={styles.placeholder}>
      <h2 style={styles.h2}>{fr.placeholder.title}</h2>
      <p style={styles.subtitle}>{fr.placeholder.subtitle}</p>
      <div style={styles.modules}>
        {fr.placeholder.modules.map((m) => (
          <div key={m.name} style={styles.mod}>
            <div style={styles.modName}>{m.name}</div>
            <div style={styles.modDesc}>{m.desc}</div>
          </div>
        ))}
      </div>
      <div style={styles.badge}>{fr.placeholder.badge}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  placeholder: {
    background: colors.panel,
    border: '1px dashed #d8cebf',
    borderRadius: radius.lg,
    padding: 28,
    textAlign: 'center',
  },
  h2: { margin: '0 0 6px', fontSize: 18 },
  subtitle: { color: colors.muted, fontSize: 13, margin: '0 0 16px' },
  modules: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
    maxWidth: 420,
    margin: '0 auto',
  },
  mod: {
    background: '#fbf8f4',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: 12,
    textAlign: 'left',
    opacity: 0.7,
  },
  modName: { fontWeight: 700, fontSize: 13 },
  modDesc: { fontSize: 11, color: colors.muted },
  badge: {
    display: 'inline-block',
    fontSize: 10,
    color: colors.accent,
    border: `1px solid ${colors.accent}`,
    borderRadius: 99,
    padding: '1px 7px',
    marginTop: 16,
  },
};
