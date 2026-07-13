import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

const { colors, radius, font } = theme;

const NAV_SOON = [
  { icon: '🏋️', label: fr.layout.nav.exercises },
  { icon: '🍎', label: fr.layout.nav.foods },
  { icon: '📋', label: fr.layout.nav.programs },
  { icon: '👤', label: fr.layout.nav.users },
];

/**
 * Shell protégé : barre latérale sombre (accueil actif + modules à venir grisés,
 * non cliquables), entête (titre + e-mail utilisateur + Déconnexion) et zone de
 * contenu routée (`<Outlet/>`). Conforme à design/admin-f1/admin-f1.html.
 */
export function AdminLayout() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await signOut();
    // La redirection vers /login est assurée par RequireAuth au changement de session.
  }

  return (
    <div style={styles.shell}>
      <aside style={styles.side}>
        <div style={styles.sideBrand}>
          <span style={styles.logo}>W</span>
          <b style={{ color: '#fff', fontSize: 14 }}>{fr.brand}</b>
        </div>
        <nav style={styles.nav}>
          <span style={{ ...styles.navItem, ...styles.navActive }}>▦ {fr.layout.nav.home}</span>
          {NAV_SOON.map((item) => (
            <span key={item.label} style={{ ...styles.navItem, ...styles.navSoon }}>
              <span>
                {item.icon} {item.label}
              </span>
              <span style={styles.tag}>{fr.layout.nav.soon}</span>
            </span>
          ))}
        </nav>
      </aside>

      <div style={styles.main}>
        <header style={styles.topbar}>
          <span style={styles.title}>{fr.layout.homeTitle}</span>
          <div style={styles.userbox}>
            <span>{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              style={styles.logout}
            >
              {signingOut ? fr.layout.loggingOut : fr.layout.logout}
            </button>
          </div>
        </header>
        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh' },
  side: {
    width: 200,
    background: colors.sidebar,
    color: colors.sidebarInk,
    padding: '16px 12px',
    flex: '0 0 auto',
  },
  sideBrand: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 20 },
  logo: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    background: colors.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.accentInk,
    fontWeight: 800,
    fontSize: 16,
  },
  nav: { display: 'flex', flexDirection: 'column' },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '9px 10px',
    borderRadius: radius.sm,
    fontSize: 13,
    color: colors.sidebarMuted,
    marginBottom: 2,
  },
  navActive: { background: 'rgba(221,110,64,.18)', color: '#fff' },
  navSoon: { opacity: 0.55, cursor: 'default', justifyContent: 'space-between' },
  tag: {
    fontSize: 9,
    background: 'rgba(255,255,255,.12)',
    padding: '1px 6px',
    borderRadius: 99,
    color: '#e8d9c6',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    background: colors.panel,
    borderBottom: `1px solid ${colors.border}`,
  },
  title: { fontWeight: 700, fontSize: 15 },
  userbox: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: colors.muted },
  logout: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.sm,
    padding: '6px 11px',
    fontSize: 12,
    fontWeight: 600,
    color: colors.ink,
    cursor: 'pointer',
    fontFamily: font,
  },
  content: { flex: 1, padding: 26, background: colors.bg },
};
