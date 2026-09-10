import { create } from 'zustand';
import { MICRONUTRIENT_KEYS, type MicronutrientKey } from '@wellness/shared';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Sélection des micronutriments **suivis** dans le récap du jour (US 4.35).
 *
 * Préférence **locale (device)**, persistée via `secureStorage` — volontairement
 * **non synchronisée** entre appareils pour rester cloud-free (aucune migration).
 * Promotion possible vers `user_settings` synchronisé plus tard (spec §2 / §4).
 */
const STORAGE_KEY = 'tracked_micros';

/**
 * Micronutriments suivis **par défaut** (US NUTRI-UX01, R3.3).
 *
 * 🔴 Le défaut était `[]`, et c'est ce qui rendait invisible le seul vrai différenciateur du
 * pilier : 33 micros CIQUAL, les VNR européennes et des anneaux de couverture — que personne ne
 * voyait, puisqu'il fallait deviner l'existence de la fonction, ouvrir le profil nutritionnel,
 * scroller sept sections et cocher dans un mur de 33 pastilles.
 *
 * Ces six-là sont retenus parce qu'ils **ont une VNR** (donc un anneau lisible) et couvrent les
 * insuffisances les plus fréquentes en population française. Le choix des 33 reste offert : ce
 * défaut ouvre la porte, il ne la referme pas.
 */
export const DEFAULT_TRACKED_MICROS: MicronutrientKey[] = [
  'iron_mg',
  'calcium_mg',
  'magnesium_mg',
  'vitamin_d_ug',
  'vitamin_c_mg',
  'potassium_mg',
];

/** Filtre + réordonne selon `MICRONUTRIENT_KEYS` (ordre stable, clés inconnues ignorées). */
function sanitize(list: unknown): MicronutrientKey[] {
  if (!Array.isArray(list)) return [];
  return MICRONUTRIENT_KEYS.filter((k) => list.includes(k));
}

async function persist(tracked: MicronutrientKey[]): Promise<void> {
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(tracked));
  } catch {
    // Persistance best-effort : un échec de stockage ne doit pas casser l'UI.
  }
}

type TrackedMicrosState = {
  /** Micros suivis (ordre `MICRONUTRIENT_KEYS`). */
  tracked: MicronutrientKey[];
  /** Vrai une fois la lecture initiale du stockage terminée. */
  hydrated: boolean;
  /** Charge la sélection depuis le stockage (idempotent). */
  hydrate: () => Promise<void>;
  /** Ajoute / retire un micro du suivi et persiste. */
  toggle: (key: MicronutrientKey) => void;
};

export const useTrackedMicros = create<TrackedMicrosState>((set, get) => ({
  tracked: DEFAULT_TRACKED_MICROS,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      // 🔴 Distinguer « jamais réglé » de « tout décoché » : une clé absente du stockage rend
      // les défauts, une liste vide **stockée** reste vide. Sans cette nuance, un utilisateur
      // qui décoche tout se verrait réimposer six micros au prochain lancement.
      set({ tracked: raw != null ? sanitize(JSON.parse(raw)) : DEFAULT_TRACKED_MICROS, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  toggle: (key) => {
    const cur = get().tracked;
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : sanitize([...cur, key]);
    set({ tracked: next });
    void persist(next);
  },
}));
