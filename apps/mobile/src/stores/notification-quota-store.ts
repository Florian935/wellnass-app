import { create } from 'zustand';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Plafond quotidien des notifications **immédiates** — US MUSC-F8, décision D14.
 *
 * ── Pourquoi ce compteur, alors que D3 (NUTR-F1) l'avait refusé ────────────────────────────────────
 * D3 refusait un compteur de notifications parce qu'il ferait *perdre* des rappels : les
 * planificateurs re-tournent à chaque retour au premier plan, et un type déjà compté se verrait
 * refuser sa re-planification — la branche d'annulation supprimant alors un rappel valide.
 *
 * Cette objection ne vaut que pour les notifications **replanifiées**. Le push de record est
 * **fire-and-forget** : il n'est jamais réévalué, jamais annulé, jamais recompté. Un compteur s'y
 * applique donc sans rien perdre — c'est toute la distinction de D14.
 *
 * ── Ce qu'on compte ──────────────────────────────────────────────────────────────────────────────
 * Les **tentatives d'envoi réussies** (l'appel natif n'a pas levé), et seulement elles :
 * `recordSuccess` ne doit être appelé que sur un `presentNow(...) === true`. Compter des échecs
 * consommerait le quota du jour sans qu'aucune notification n'existe.
 *
 * ── Préférence locale au terminal, non synchronisée ─────────────────────────────────────────────────
 * Un quota de notifications est une propriété de l'appareil, pas du compte : deux terminaux ont deux
 * quotas, c'est le comportement attendu. Patron `menu-accent-store` (persistance `secureStorage`,
 * `hydrated` + `hydrate()` idempotent, écriture best-effort).
 */

const STORAGE_KEY = 'notification_quota';

type StoredQuota = { dayKey: string; count: number };

function sanitize(raw: unknown): StoredQuota | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const dayKey = rec['dayKey'];
  const count = rec['count'];
  if (typeof dayKey !== 'string' || typeof count !== 'number' || !Number.isFinite(count)) {
    return null;
  }
  return { dayKey, count: Math.max(0, Math.trunc(count)) };
}

async function persist(quota: StoredQuota): Promise<void> {
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(quota));
  } catch {
    // Persistance best-effort : un échec ne doit pas casser l'UI.
  }
}

type NotificationQuotaState = {
  dayKey: string | null;
  count: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Incrémente pour `dayKey`, en réinitialisant si le jour a changé. N'appeler QUE sur un envoi réussi. */
  recordSuccess: (dayKey: string) => void;
  /** Nombre de tentatives réussies pour `dayKey` (0 si le jour stocké diffère). */
  countFor: (dayKey: string) => number;
};

export const useNotificationQuota = create<NotificationQuotaState>((set, get) => ({
  dayKey: null,
  count: 0,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      const stored = raw ? sanitize(JSON.parse(raw)) : null;
      set({ dayKey: stored?.dayKey ?? null, count: stored?.count ?? 0, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  recordSuccess: (dayKey) => {
    const next = get().dayKey === dayKey ? get().count + 1 : 1;
    set({ dayKey, count: next });
    void persist({ dayKey, count: next });
  },
  countFor: (dayKey) => (get().dayKey === dayKey ? get().count : 0),
}));
