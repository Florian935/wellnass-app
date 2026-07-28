---
id: I18N-01
titre: "Sélecteur de langue dans les Réglages"
roadmap: [1.23]
catalogue: []
etape: close
branche: feature/langue-selecteur-reglages
maj: 16/07/2026
---
# US — Sélecteur de langue dans les Réglages

_Spec fonctionnelle. Statut : validée (design du 16/07/2026, Florian). Branche :
`feature/langue-selecteur-reglages` (depuis `dev`). Corrige le bug §🐞 « aucun sélecteur de langue »._

## 1. Contexte & objectif

La langue de l'app (FR/EN, décision G) est lue **une seule fois** — à la création du compte, depuis la
locale de l'appareil — pour initialiser `user_settings.language`
([settings-repository.ts](../../../apps/mobile/src/data/repositories/settings-repository.ts)). Ensuite,
c'est cette **préférence persistée** qui prime et qui est appliquée à i18next au démarrage
([\_layout.tsx:104-109](../../../apps/mobile/src/app/_layout.tsx#L104-L109)). Or l'écran Réglages
n'expose **pas** la langue → **une fois le compte créé, personne ne peut repasser l'app en FR/EN**
(bug remonté par Florian, 16/07/2026, Pixel 6a en anglais système → app restée en français).

Objectif : exposer un **sélecteur de langue** dans les Réglages. La tuyauterie (persistance + réaction
i18next) **existe déjà** ; le périmètre est **uniquement l'UI**.

## 2. Périmètre

- **Inclus** : une section « Langue » dans [settings.tsx](../../../apps/mobile/src/app/settings.tsx)
  (composant `Segment`, options `LOCALES` = `['fr','en']`) → `updateSettings({ language })` ; clés i18n
  FR/EN.
- **Exclu (YAGNI)** : option « Système / automatique » (nécessiterait d'étendre le modèle `language` +
  logique de résolution — écartée au design) ; langues supplémentaires (ES/DE = idée séparée) ;
  migration (le champ `language` = `Locale` existe déjà).
- **Maquette** : écartée (section `Segment` identique à Apparence/Unités).

## 3. Règles métier

- **Emplacement** : section « Langue » sur l'écran Réglages, cohérente avec Apparence/Unités (même
  `sectionTitle` + `Segment`). Position : à proximité d'Apparence/Unités (au choix, ex. juste après
  Unités).
- **Options** : `LOCALES` (`['fr','en']`) ; libellés en **endonymes** (« Français » / « English »),
  **identiques dans les deux langues** (un francophone comme un anglophone reconnaissent leur langue).
- **Valeur courante** : `settings?.language ?? getAppLanguage()` (repli sur la langue i18next courante
  tant que les réglages ne sont pas chargés — cohérent avec les autres `?? défaut` de l'écran).
- **Action** : `onChange={(next: Locale) => void updateSettings({ language: next })}`.
- **Effet** : **immédiat** — l'effet existant dans `_layout.tsx` détecte le changement de
  `settings.language` et appelle `i18n.changeLanguage`. Persisté + synchronisé (PowerSync), donc
  retrouvé au prochain lancement et sur les autres appareils.

## 4. i18n (FR + EN, parité)

Namespace `settings.language.*` : `title` (FR « Langue » / EN « Language »). Les **libellés d'option**
sont des **endonymes identiques** dans les deux fichiers : `fr` = « Français », `en` = « English ».
Parité FR/EN vérifiée (diff manuel — pas de test de parité automatisé).

## 5. Cas limites

- **Réglages non encore chargés** (`settings == null`) → repli `getAppLanguage()` (pas de crash, pas de
  valeur vide dans le `Segment`).
- **Changement en cours d'usage** → toute l'UI se met à jour immédiatement (i18next re-render). Aucune
  donnée utilisateur affectée (les contenus bilingues suivent déjà `getAppLanguage`).
- **Offline** : écriture locale PowerSync → appliquée hors-ligne, synchronisée ensuite.

## 6. Tests

- **Mobile** : `typecheck` + `lint` verts (changement UI pur). Vérif de rendu à la recette device.
- Pas de logique pure nouvelle → pas de test Vitest dédié.

## 7. Definition of Done

- Section « Langue » dans les Réglages : `Segment` FR/EN reflétant `settings.language`, bascule →
  changement **immédiat** de la langue de l'app, **persisté** et **synchronisé**.
- i18n FR/EN (parité) ; typecheck/lint verts ; **100 % client, aucune migration, pas de checkpoint 🔴**.
- Bug §🐞 « aucun sélecteur de langue » → **corrigé**.
- Reste : **recette device** (changer FR↔EN dans Réglages → UI bascule ; relancer l'app → langue
  conservée) + relecture Damien.
