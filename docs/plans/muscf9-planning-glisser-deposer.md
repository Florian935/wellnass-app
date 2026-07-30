# Plan — MUSC-F9 · Décalage d'une séance planifiée en glisser-déposer

Spec : [muscf9-planning-glisser-deposer.md](../specs/functional/us/muscf9-planning-glisser-deposer.md)
· branche `feature/muscf9-planning-glisser-deposer` · roadmap **3.10**.

> **Rien à écrire côté données.** `reschedulePlannedSession` existe, est testé et est déjà appelé par
> trois boutons. Ce plan ne construit qu'une **couche de geste** par-dessus.

## Dépendance à trancher en premier

`react-native-gesture-handler` et `react-native-reanimated` sont **déjà présents** (le réagencement du
dashboard d'UX-LOT-01 s'en sert). **Aucune librairie de drag-and-drop tierce n'est nécessaire** — et
il faut résister à en ajouter une : elles supposent presque toutes une liste **verticale homogène**,
alors qu'ici la cible est une **grille de 7 jours**.

`expo-haptics` (spec §3, D3) est la **seule** dépendance potentiellement neuve. Si D3 est écartée,
cette US n'ajoute **aucun paquet**.

## Ordre de build

### Étape 1 — Mesurer les zones de dépôt *(≈ 2 h)*

Avant tout geste : chaque carte-jour doit savoir **où elle est à l'écran**.

- `onLayout` sur les 7 conteneurs de jour → registre `{ dateKey, y, height }` dans une `useRef`.
- Recalcul au changement de semaine et à la rotation.
- ⚠️ Les positions sont relatives au **conteneur défilant** : penser à ajouter l'offset de défilement,
  sinon le dépôt vise juste tant qu'on n'a pas fait défiler — le bug classique de cette mécanique.
- **Test** : fonction pure `findDropTarget(y, zones)` dans `packages/shared` → couvre le dessus, le
  dessous, l'entre-deux et le hors-zone. C'est la seule vraie logique de l'US, donc la seule chose
  réellement testable sans device.

### Étape 2 — Le geste *(≈ 3 h)*

- `Gesture.Pan().activateAfterLongPress(200)` sur les cartes `planned` uniquement (règle R1).
- Pendant : `translateY` en valeur partagée Reanimated, élévation + légère opacité sur la carte
  saisie, surbrillance de la zone survolée.
- ⚠️ **`.requireExternalGestureToFail()` ou `simultaneousWithExternalGesture` face au défilement**
  vertical : c'est le point qui décide si le critère de recette n°10 passe ou échoue.
- Relâche : `runOnJS` → `findDropTarget` → si cible ≠ jour d'origine, appel de
  `reschedulePlannedSession`. Sinon, animation de retour (R3, R6).

### Étape 3 — Retours utilisateur *(≈ 1 h)*

- Toast `planning.movedTo`, indice `planning.dragHint` (FR + EN).
- Optimisme d'affichage : PowerSync réémet la requête, donc **ne pas** dupliquer l'état localement —
  laisser la carte revenir à sa place le temps du réémis évite un état fantôme.
- D3 haptique si retenue.

### Étape 4 — Solde *(≈ 30 min)*

Roadmap 3.10 → ✅ · retrait de MUSC-F9 du BACKLOG · CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `apps/mobile/src/app/planning/index.tsx` | le geste + les mesures |
| `packages/shared/src/drop-target.ts` | **nouveau** — `findDropTarget`, pur |
| `packages/shared/src/drop-target.test.ts` | **nouveau** |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | 2 chaînes |

**Inchangés, et c'est le point** : `planned-session-repository.ts`, le schéma PowerSync, les
migrations, les sync rules.

## Migration / sync rules

**Aucune. Ni l'une ni l'autre.** Aucune table, aucune colonne. La recette ne demande donc **pas** de
nouveau build : `react-native-gesture-handler` et `reanimated` sont déjà dans l'APK — **sauf si D3
(haptique) est retenue**, auquel cas `expo-haptics` impose un rebuild. Ce seul arbitrage décide si
l'US est recettable sur l'APK existant.

## Risques

- 🔴 **Conflit de gestes** (défilement / semaine / glissement) — le vrai risque, cf. étape 2.
- 🟠 **Positions de dépôt fausses après défilement** si l'offset est oublié.
- 🟢 Écriture et offline : aucun risque, chemin déjà éprouvé.
