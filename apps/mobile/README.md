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

## Builds (EAS)

Profils définis dans [`eas.json`](./eas.json) — **Android d'abord** (décision E) :

| Canal | Usage | Sortie |
|---|---|---|
| `development` | **Dev client** (requis pour PowerSync — module natif) | APK |
| `preview` | Bêta interne | APK |
| `production` | Play Store (bêta via **Internal Track**) | AAB |

**Prérequis (une fois, avec un compte Expo)** — non fait dans ce lot :

```bash
npm i -g eas-cli
eas login
eas init            # enregistre le projet et injecte extra.eas.projectId dans app.json
```

Puis, depuis `apps/mobile` :

```bash
npm run build:dev        # dev client installable (à faire en premier)
npm run build:preview    # bêta interne
npm run build:prod       # bundle Play Store
npm run submit:prod      # soumission Google Play (track internal)
```

> `appVersionSource: remote` : EAS gère le `versionCode` (auto-incrément en production).
> **OTA (EAS Update)** réservé aux correctifs JS, jamais aux features (voir architecture §9) —
> à configurer avec le `projectId` une fois `eas init` fait.

## Structure

```
src/
  app/       → routes Expo Router (_layout, index)
  i18n/      → config i18next + locales (fr.json, en.json)
  stores/    → stores Zustand (settings-store)
```

Types et schémas de domaine partagés : [`@wellness/shared`](../../packages/shared).
