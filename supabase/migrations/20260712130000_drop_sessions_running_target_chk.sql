-- Fix (12/07/2026) : retire la contrainte sessions_running_target_chk (posée en R3b-i, 20260712100000).
-- Motif : une CHECK multi-colonnes « session_type non nul ⇒ au moins une cible » bloque la synchro
-- PowerSync pendant l'édition incrémentale offline-first — état transitoire légitime (type choisi
-- avant la cible) rejeté côté cloud → file d'upload bloquée. La règle « cible requise » reste
-- validée côté application (hasRunningSessionTarget). Appliqué manuellement sur le cloud le 12/07/2026.
alter table public.sessions drop constraint if exists sessions_running_target_chk;
