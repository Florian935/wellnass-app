/**
 * Types de la base Supabase — **générés**, ne pas éditer à la main.
 * Régénérer après chaque migration :
 *   npm run db:types           (→ supabase gen types typescript --local)
 *
 * Stub tant que le schéma métier n'est pas figé (aucune table de domaine encore créée ;
 * seule la migration de conventions existe). Voir architecture.md §3/§4.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
