# Registre des migrations

Suivi **vivant** de l'application des migrations SQL sur le projet Supabase **cloud**
(`nsxzflxsgovriwwvflxe`). Une ligne par fichier de [`migrations/`](migrations/).

**Règle** (voir [CLAUDE.md](../CLAUDE.md#migrations-base-de-données)) : toute migration créée est
**poussée via `npm run db:push`** (jamais collée à la main dans la console — sinon l'historique
CLI `supabase_migrations.schema_migrations` diverge du schéma réel). Dès qu'une migration est
poussée avec succès, **cocher sa case** et renseigner la date.

- `[x]` = appliquée sur le cloud **et** connue de l'historique CLI (`db push` ou `migration repair`).
- `[ ]` = pas encore poussée.
- ⚠ = jouée à la main dans la console → schéma OK mais historique CLI à réconcilier
  (`npm run db:push:dry` la liste encore comme « à pousser » → `supabase migration repair --status applied <version>`).

| Poussée | Migration                                         | Date push  | Méthode                       |
| :-----: | ------------------------------------------------- | ---------- | ----------------------------- |
|   [x]   | `20260705150000_init_conventions`                 | —          | CLI (historique OK)           |
|   [x]   | `20260706120000_socle_muscu_tables`               | —          | CLI (historique OK)           |
|   [x]   | `20260706120001_socle_muscu_rls`                  | —          | CLI (historique OK)           |
|   [x]   | `20260706130000_programmes_tables`                | —          | CLI (historique OK)           |
|   [x]   | `20260706130001_programmes_rls`                   | —          | CLI (historique OK)           |
|   [x]   | `20260706140000_nutrition_tables`                 | —          | CLI (historique OK)           |
|   [x]   | `20260706140001_nutrition_rls`                    | —          | CLI (historique OK)           |
|   [x]   | `20260706140002_personal_records`                 | —          | CLI (historique OK)           |
|   [x]   | `20260706150000_food_tables`                      | —          | CLI (historique OK)           |
|   [x]   | `20260706150001_food_rls`                         | —          | CLI (historique OK)           |
|   [x]   | `20260707120000_running_runs`                     | —          | CLI (historique OK)           |
|   [x]   | `20260707130000_recipes_bodyweight_tables`        | —          | CLI (historique OK)           |
|   [x]   | `20260707130001_recipes_bodyweight_rls`           | —          | CLI (historique OK)           |
|   [x]   | `20260707140000_nutrition_meals`                  | —          | CLI (historique OK)           |
|   [x]   | `20260711140000_food_micronutrients`              | —          | CLI (historique OK)           |
|   [x]   | `20260712090000_running_profiles`                 | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260712100000_running_session_content`          | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260712110000_planned_sessions`                 | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260712120000_running_pace_records`             | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260712130000_drop_sessions_running_target_chk` | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260713100000_admin_user_roles`                 | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260713110000_admin_editorial_exercises`        | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260713140000_admin_editorial_programs_rls`     | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260713150000_foods_import_key`                 | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260713160000_admin_editorial_foods_rls`        | 14/07/2026 | repair (jouée console)        |
|   [x]   | `20260714120000_seed_library_foods_ciqual`        | 14/07/2026 | CLI (`npm run db:push`)       |
|   [x]   | `20260714170000_admin_audit_log`                  | 14/07/2026 | CLI (`npm run db:push`)       |

> **14/07/2026 — historique réconcilié.** Les 10 migrations des 12–13/07, jouées à la main dans la
> console, ont été marquées `applied` via `supabase migration repair`. `npm run db:push:dry` répond
> désormais « Remote database is up to date ». À partir d'ici, toute nouvelle migration passe par
> `npm run db:push` (plus jamais la console).
