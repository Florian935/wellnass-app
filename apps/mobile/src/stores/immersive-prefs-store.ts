import { create } from 'zustand';
import { DEFAULT_BAR_KG, KG_BARS, parseCoachCharacter, type CoachCharacter } from '@wellness/shared';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Réglages du mode immersif (US MUSCU-UX03, spec §6).
 *
 * Un seul objet JSON dans `secureStorage` plutôt que huit clés : ces réglages se lisent et
 * s'écrivent ensemble, depuis un seul écran. **Aucune migration**, comme le reste des préférences
 * d'appareil.
 *
 * Chaque mécanique immersive a son interrupteur, et **tous sont actifs par défaut** : quelqu'un qui
 * choisit l'immersif a demandé l'expérience complète. Ce qu'il coupe ensuite est son affaire — d'où
 * l'existence des interrupteurs. Deux exceptions volontaires :
 *  - la **notification de repos** est activée en immersif mais **coupée en classique** : le mode
 *    classique ne doit rien gagner qu'on ne lui ait demandé (décision D1) ;
 *  - le **poids de la barre** n'est pas un interrupteur mais une valeur, parce qu'une barre de
 *    15 kg change le calcul des disques et rendrait l'affichage faux.
 */

const STORAGE_KEY = 'immersive_prefs';

export type ImmersivePrefs = {
  /** Caractère du coach : `motivant`, `sobre` ou `muet`. */
  coach: CoachCharacter;
  /** Guide de tempo pendant l'effort. */
  tempo: boolean;
  /** Disque de respiration pendant le repos. */
  breathing: boolean;
  /** Fantôme de la dernière séance (carte de repos, pastille, défi de fin). */
  ghost: boolean;
  /** Veille de séance : écran assombri quand le téléphone est posé pendant le repos. */
  sleep: boolean;
  /** Poids de la barre, en kg, pour le calcul des disques. */
  barKg: number;
  /** Notification de repos, par mode (voir en-tête pour l'asymétrie). */
  restNotificationImmersive: boolean;
  restNotificationClassic: boolean;
};

export const DEFAULT_IMMERSIVE_PREFS: ImmersivePrefs = {
  coach: 'motivant',
  tempo: true,
  breathing: true,
  ghost: true,
  sleep: true,
  barKg: DEFAULT_BAR_KG,
  restNotificationImmersive: true,
  restNotificationClassic: false,
};

/**
 * Relit une valeur persistée sans jamais faire confiance à sa forme : une clé manquante, un type
 * inattendu ou un JSON corrompu retombent sur le défaut, jamais sur un écran cassé.
 */
export function parseImmersivePrefs(raw: string | null): ImmersivePrefs {
  if (!raw) return DEFAULT_IMMERSIVE_PREFS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_IMMERSIVE_PREFS;
    const source = parsed as Partial<Record<keyof ImmersivePrefs, unknown>>;
    const bool = (key: keyof ImmersivePrefs): boolean =>
      typeof source[key] === 'boolean' ? (source[key] as boolean) : DEFAULT_IMMERSIVE_PREFS[key] === true;
    const barKg = typeof source.barKg === 'number' && (KG_BARS as readonly number[]).includes(source.barKg)
      ? source.barKg
      : DEFAULT_BAR_KG;
    return {
      coach: parseCoachCharacter(typeof source.coach === 'string' ? source.coach : null),
      tempo: bool('tempo'),
      breathing: bool('breathing'),
      ghost: bool('ghost'),
      sleep: bool('sleep'),
      barKg,
      restNotificationImmersive: bool('restNotificationImmersive'),
      restNotificationClassic: bool('restNotificationClassic'),
    };
  } catch {
    return DEFAULT_IMMERSIVE_PREFS;
  }
}

type ImmersivePrefsState = ImmersivePrefs & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<ImmersivePrefs>) => void;
};

export const useImmersivePrefs = create<ImmersivePrefsState>((set, get) => ({
  ...DEFAULT_IMMERSIVE_PREFS,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      set({ ...parseImmersivePrefs(raw), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  update: (patch) => {
    set(patch);
    const { hydrated: _hydrated, hydrate: _hydrate, update: _update, ...prefs } = get();
    void (async () => {
      try {
        await secureStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch {
        // Best-effort, comme les autres préférences d'appareil.
      }
    })();
  },
}));
