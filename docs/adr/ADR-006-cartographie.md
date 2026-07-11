# ADR-006 — Fournisseur de cartographie (running)

- **Statut** : ✅ **Accepté**
- **Date** : 11/07/2026
- **Décideurs** : Florian (Damien à confirmer a posteriori).
- **Lié à** : [architecture.md §Cartographie](../specs/technical/architecture.md) (point ouvert) · [running.md](../specs/functional/running.md) · [running-r1-tracker-gps.md §R2](../specs/technical/running-r1-tracker-gps.md) · [roadmap 5.17](../roadmap/roadmap.md).

---

## Contexte

Le pilier **Running R2** doit afficher le **tracé GPS** d'une course (polyline) sur un fond de carte — en direct pendant la course et au résumé (5.17 / 5.27). Contraintes de cadrage déjà actées :

- **Rendu carte côté app**, **sans dépendance runtime à Google Maps** (architecture.md).
- **Cross-platform** obligatoire (RN + Expo) — ne jamais fermer la porte à iOS (ADR-004).
- **Offline-first** (ADR-001) : la carte doit pouvoir fonctionner hors-ligne autant que possible.
- **App 100 % gratuite au lancement** (ADR-003, RevenueCat inactif V1) → **coût maîtrisé, pas de facturation à l'usage surprise**.
- Utilisateurs **FR/UE** → sensibilité **RGPD**.
- Un **dev build Expo** est déjà requis (PowerSync, expo-location) → un module natif de carte n'ajoute pas de contrainte nouvelle.

Le besoin est **simple** (une trace sur un fond de carte) — pas de navigation turn-by-turn ni de rendu premium.

## Options envisagées

### A — MapLibre (`@maplibre/maplibre-react-native`) + tuiles tierces *(retenu)*
- **+** SDK **open-source BSD**, **gratuit à vie**, **aucun token**. Pas de lock-in, coût **prévisible** (seules les tuiles ont un coût selon le fournisseur). RGPD maîtrisable (fournisseur EU ou auto-hébergé). Régions **offline** supportées (héritage GL Native). Lib **activement maintenue** (v11.x), config plugin Expo, Android + iOS.
- **−** Nécessite de **choisir/configurer une source de tuiles** (style + URL) — un peu plus de setup que Mapbox.

### B — Mapbox (`@rnmapbox/maps`)
- **+** Solution **managée clé-en-main**, tuiles incluses, styles premium, API offline intégrée, très bonne intégration RN/Expo.
- **−** **Propriétaire**, **token obligatoire**, **facturation à l'usage** au-delà de **25 000 MAU** (par utilisateur actif) → risque de facture croissante incompatible avec une app gratuite non monétisée en V1. Télémétrie vers Mapbox (US) → friction RGPD. Lock-in.

## Décision

**Option A — MapLibre**, avec **MapTiler (palier gratuit)** comme source de tuiles **pour démarrer R2**.

Justification : le besoin R2 est modeste et MapLibre coche toutes nos contraintes de cadrage (gratuité/coût maîtrisé, RGPD, offline, cross-platform) sans lock-in ni facturation à l'usage. Mapbox n'apporterait un avantage décisif que pour des fonctions premium (navigation, styles) **hors périmètre V1**.

## Conséquences

- **Dépendance** : `@maplibre/maplibre-react-native` (config plugin Expo ajouté à `app.json`), consommée dans un **dev build** (déjà requis). Rester sur l'API cross-platform de la lib (pas de code natif spécifique une plateforme) pour ne pas fermer iOS.
- **Tuiles = MapTiler (palier gratuit) au lancement** : clé MapTiler stockée en **variable d'environnement / EAS** (jamais committée — cf. [bonnes-pratiques.md](../specs/technical/bonnes-pratiques.md)). Style + URL de tuiles configurés côté app.
- **Rendu de la trace** : la trace complète est stockée encodée sur la ligne `run` (déjà acté R1) ; **downsampling Douglas-Peucker à l'affichage** dans R2.
- **Pistes d'évolution** (hors R2 initial, à réévaluer à l'échelle) :
  - **Stadia Maps** (fournisseur EU) si l'on veut renforcer le récit RGPD.
  - **Protomaps auto-hébergé** (fichier `.pmtiles` sur **Supabase Storage**) : **0 coût par requête**, offline natif, contrôle total — meilleur choix à volume élevé, au prix d'un setup initial (génération/hébergement des tuiles).
  - Le passage d'un fournisseur de tuiles à un autre reste **local** (URL de style/tuiles) — MapLibre ne verrouille pas la source.
- **iOS ultérieur** : MapLibre RN gère iOS nativement → le portage reste une extension, pas une réécriture.
- **Point ouvert** [architecture.md] « Fournisseur de cartes » → **fermé** par cette ADR. Roadmap 5.17 : dépendance « clé Mapbox/MapLibre » → **MapLibre + MapTiler**.
