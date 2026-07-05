# @wellness/mobile

App mobile **Expo** (React Native + TypeScript, **Expo Router**, state **Zustand**, i18n
**i18next** FR/EN). Membre du monorepo — voir le [README racine](../../README.md) et
[CLAUDE.md](../../CLAUDE.md).

## Démarrage

Depuis la **racine du monorepo** :

```bash
npm install          # installe tout le workspace
npm run mobile       # = expo start dans apps/mobile
```

Ou depuis ce dossier :

```bash
npx expo start                    # serveur de dev
npx expo start --android          # ouvre sur Android
npx expo export --platform web    # bundle web (smoke-test)
npm run typecheck                 # tsc --noEmit
```

> ⚠️ **Dev build requis** (pas Expo Go) dès l'intégration de **PowerSync** (module natif).
> La mise en place EAS reste à faire (voir [TODO.md](../../TODO.md)).

## Structure

```
src/
  app/       → routes Expo Router (_layout, index)
  i18n/      → config i18next + locales (fr.json, en.json)
  stores/    → stores Zustand (settings-store)
```

Types et schémas de domaine partagés : [`@wellness/shared`](../../packages/shared).
