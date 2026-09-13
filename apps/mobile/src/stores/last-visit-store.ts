import { create } from 'zustand';
import { shouldReplaceSnapshot, type VisitSnapshot } from '@wellness/shared';
import { secureStorage } from '@/lib/secure-storage';

/**
 * US DASH-01 (§4.5) — l'**instantané de la dernière visite**, pour pouvoir dire « depuis la
 * dernière fois ».
 *
 * ── Pourquoi c'est local, et pourquoi ça le reste ────────────────────────────────────────────────
 * C'est une **mémoire d'affichage**, pas une donnée de l'utilisateur : elle répond à « qu'est-ce
 * qui a changé depuis que TU as regardé, sur CET appareil ». Synchronisée, elle serait fausse au
 * premier second appareil — la visite depuis la tablette effacerait la nouvelle du téléphone. Elle
 * ne mérite donc ni table, ni migration, ni règle de synchro (même raisonnement que
 * `tracked-micros`).
 *
 * ── Ce qui évite le « rien de neuf » permanent ───────────────────────────────────────────────────
 * L'instantané n'est **pas** remplacé à chaque ouverture : `shouldReplaceSnapshot` impose
 * `SNAPSHOT_MIN_AGE_HOURS` d'écart. Sans cette garde, ouvrir l'app deux fois de suite écraserait le
 * point de comparaison et la carte n'aurait jamais rien à dire.
 */
const STORAGE_KEY = 'last_visit_snapshot';

/** Forme minimale attendue en stockage — une valeur corrompue vaut « aucun instantané ». */
function parse(raw: string | null): VisitSnapshot | null {
  if (raw == null) return null;
  try {
    const value = JSON.parse(raw) as Partial<VisitSnapshot>;
    if (typeof value?.takenAt !== 'string') return null;
    return {
      takenAt: value.takenAt,
      weightKg: typeof value.weightKg === 'number' ? value.weightKg : null,
      recordsCount: typeof value.recordsCount === 'number' ? value.recordsCount : 0,
      prediction10kSeconds:
        typeof value.prediction10kSeconds === 'number' ? value.prediction10kSeconds : null,
    };
  } catch {
    return null;
  }
}

/** Persistance best-effort : un échec de stockage ne doit jamais casser l'accueil. */
async function persist(snapshot: VisitSnapshot): Promise<void> {
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Sans conséquence : au pire la prochaine visite n'a pas de point de comparaison.
  }
}

type LastVisitState = {
  /** L'instantané de la visite précédente — la référence de comparaison. */
  snapshot: VisitSnapshot | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /**
   * Enregistre l'état courant **si** l'instantané en place est assez vieux. Retourne `true` quand
   * le remplacement a eu lieu.
   */
  record: (next: VisitSnapshot) => boolean;
};

export const useLastVisit = create<LastVisitState>((set, get) => ({
  snapshot: null,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      set({ snapshot: parse(await secureStorage.getItem(STORAGE_KEY)), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  record: (next) => {
    if (!shouldReplaceSnapshot(get().snapshot, next.takenAt)) return false;
    set({ snapshot: next });
    void persist(next);
    return true;
  },
}));
