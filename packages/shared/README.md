# @wellness/shared

Types TypeScript et schémas **Zod** partagés entre `apps/mobile`, `apps/admin` et le
back. Source de vérité du domaine côté TypeScript (le client valide pour l'UX, le
serveur valide pour la sécurité — voir
[bonnes-pratiques.md](../../docs/specs/technical/bonnes-pratiques.md)).

> À terme, une partie de ces types sera **générée depuis le schéma Supabase**
> (pas de duplication manuelle) — voir
> [architecture.md](../../docs/specs/technical/architecture.md) §3.

## Contenu

- `sync.ts` — champs de synchro transverses (UUID client, timestamps UTC, soft delete).
- `pillar.ts` — piliers (`strength` / `running` / `nutrition`) et locales (`fr` / `en`).

## Usage

```ts
import { syncFieldsSchema, pillarSchema, type Pillar } from '@wellness/shared';
```
