import { create } from 'zustand';
import { secureStorage } from '@/lib/secure-storage';

/**
 * US DASH-01 (§7.2) — la **photo prise hors ligne**, gardée jusqu'au retour du réseau.
 *
 * Le cas est banal et il est le pire moment pour perdre quelque chose : on photographie son assiette
 * au restaurant, dans un sous-sol sans réseau. Sans file d'attente, l'app répondrait « pas de
 * connexion » et la photo serait perdue — or c'est le seul instant où elle existe.
 *
 * ── Ce qui est gardé, et ce qui ne l'est pas ─────────────────────────────────────────────────────
 * Le **chemin local** de la photo, le repas visé et le jour — jamais l'image elle-même en base : la
 * photo vit dans le cache de l'app, et n'est lue qu'au moment de l'envoi. Une seule photo en
 * attente : deux assiettes à analyser plus tard, ça n'arrive pas, et une file qui grossit hors ligne
 * finirait par envoyer un lot de requêtes d'un coup au retour du réseau.
 *
 * ⚠️ **Rien n'est envoyé automatiquement.** Au retour du réseau, l'app **propose** d'analyser ; elle
 * ne le fait pas dans le dos de l'utilisateur (la spec §7.2 le dit : « proposée à valider »). Un
 * appel modèle consomme un quota et envoie une image : ça se décide, ça ne se subit pas.
 */
const STORAGE_KEY = 'ai_photo_pending';

export type PendingPhoto = {
  /** URI locale de la photo (cache de l'app). */
  uri: string;
  /** Jour visé, clé `AAAA-MM-JJ` — la photo peut être analysée le lendemain. */
  dayKey: string;
  mealKey: string;
  /** Instant de la prise, pour dire « prise hier » plutôt qu'un chemin de fichier. */
  takenAt: string;
};

function parse(raw: string | null): PendingPhoto | null {
  if (raw == null) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingPhoto>;
    if (typeof value?.uri !== 'string' || typeof value?.dayKey !== 'string') return null;
    return {
      uri: value.uri,
      dayKey: value.dayKey,
      mealKey: typeof value.mealKey === 'string' ? value.mealKey : 'snack',
      takenAt: typeof value.takenAt === 'string' ? value.takenAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

async function persist(pending: PendingPhoto | null): Promise<void> {
  try {
    if (pending === null) await secureStorage.removeItem(STORAGE_KEY);
    else await secureStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Best-effort : perdre la référence ne doit pas casser l'écran de saisie.
  }
}

type AiPhotoQueueState = {
  pending: PendingPhoto | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Met une photo en attente (remplace la précédente : une seule à la fois, délibérément). */
  enqueue: (photo: PendingPhoto) => void;
  clear: () => void;
};

export const useAiPhotoQueue = create<AiPhotoQueueState>((set, get) => ({
  pending: null,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      set({ pending: parse(await secureStorage.getItem(STORAGE_KEY)), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  enqueue: (photo) => {
    set({ pending: photo });
    void persist(photo);
  },
  clear: () => {
    set({ pending: null });
    void persist(null);
  },
}));
