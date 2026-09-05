-- US RUN-F4 (lots B, C, D) — `session_intervals` devient une suite de SEGMENTS typés.
-- Réf. : docs/product/analyse-seances-structurees-running.md (murs M2, M3, M5, M6, M7)
--
-- RUN-F2c avait posé le bon patron (une ligne = un bloc de répétitions, miroir d'
-- `exercise_plans.target_sets`) mais l'avait borné trois fois :
--   1. aucune nature de segment -> ni échauffement ni retour au calme (24 séances sur 24 du
--      plan analysé en prescrivent un, 0 était représentable) ;
--   2. intensité en `%VMA` ENTIER, dérivée d'une dérivée (VMA = ref5k x 0,95) ;
--   3. blocs réservés au type `fractionne` -> les footings avec lignes droites ou tempo
--      inséré (6 séances sur 24) restaient inexprimables.
-- Cette migration lève les trois. Additive : les colonnes existantes ne bougent pas, les
-- lignes existantes prennent `kind = 'work'` (leur sens actuel) et gardent leur `%VMA`.

alter table public.session_intervals
  -- Lot B — la nature du segment. Reprend le patron `exercise_plans.set_type` (qui accepte
  -- déjà 'warmup' côté musculation) ; le running n'en avait pas hérité.
  --   warmup   : échauffement            drills : gammes / éducatifs
  --   work     : le corps de séance      recovery : récupération autonome (entre blocs)
  --   cooldown : retour au calme
  -- Défaut 'work' = le sens exact des lignes déjà en base (RUN-F2c ne décrivait que du corps).
  -- ⚠️ Pas de CHECK : enum applicatif évolutif, cf. la note de 20260905090000 (une violation
  -- bloquerait la file d'upload PowerSync entière). `SEGMENT_KINDS` fait foi côté TS.
  add column if not exists kind text not null default 'work',

  -- Libellé libre facultatif (« lignes droites », « bloc clé »).
  add column if not exists label text,

  -- Lot A/B — plage d'allure cible ABSOLUE du segment, en s/km. Remplace fonctionnellement
  -- `fast_pace_pct_vma`, qui n'est PAS supprimé : les deux coexistent (cf. arbitrage 1 de
  -- l'analyse §7). Règle de lecture applicative : l'allure absolue gagne si elle est
  -- renseignée, le %VMA sert de repli. Rien à recalculer pour l'existant.
  add column if not exists fast_pace_min_s_per_km integer,
  add column if not exists fast_pace_max_s_per_km integer,

  -- Lot A — la récupération avait `distance` et `durée` mais AUCUNE intensité, alors que le
  -- plan analysé distingue systématiquement « trot très lent » et « marche active ».
  --   jog = trot · walk = marche · static = arrêt · free = libre
  add column if not exists recovery_kind text,
  add column if not exists recovery_pace_min_s_per_km integer,
  add column if not exists recovery_pace_max_s_per_km integer,

  -- Lot C — le chrono cible d'une fraction, quand la fraction est bornée en DISTANCE.
  -- « 8 x 400 m EN 1:38–1:40 » est la forme canonique de 12 des 24 séances analysées, et
  -- elle était inécrivable : le modèle imposait distance XOR durée.
  --
  -- ⚠️ On n'écrit PAS ce chrono dans `fast_duration_seconds` : cette colonne est l'ÉTENDUE
  -- (la condition de fin de phase). Deux colonnes distinctes, donc, parce que ce sont deux
  -- notions distinctes : `fast_distance_m` borne la phase, `fast_target_time_*` est la cible
  -- à tenir dedans. Conséquence heureuse : `isIntervalPhaseComplete()` (la distance l'emporte
  -- déjà sur la durée) reste JUSTE sans être modifiée.
  add column if not exists fast_target_time_min_seconds integer,
  add column if not exists fast_target_time_max_seconds integer,

  -- Lot D — un niveau d'imbrication, sans seconde table. Des segments CONSÉCUTIFS partageant
  -- la même `group_key` forment un groupe répété `group_reps` fois :
  --   « 3 x (800 m + récup 1:30 + 400 m + récup 3:00) » = 2 lignes, group_key='g1', group_reps=3.
  -- Pourquoi pas une table `session_interval_groups` : elle coûterait une table de plus, une
  -- publication, un bloc RLS et **une sync rule à déployer à la main** (étape déjà oubliée
  -- deux fois au registre) pour modéliser un seul niveau. `group_reps` est dupliqué sur
  -- chaque membre ; la valeur du PREMIER membre du groupe fait foi.
  add column if not exists group_key text,
  add column if not exists group_reps integer;

comment on column public.session_intervals.kind is
  'Nature du segment : warmup | drills | work | recovery | cooldown. Défaut ''work'' = sens des lignes RUN-F2c.';
comment on column public.session_intervals.fast_target_time_min_seconds is
  'Chrono cible de la fraction quand elle est bornée en distance (« 400 m en 1:38 »). N''est PAS l''étendue.';
comment on column public.session_intervals.group_key is
  'Segments consécutifs de même group_key = un groupe répété group_reps fois (lot D, un seul niveau).';
