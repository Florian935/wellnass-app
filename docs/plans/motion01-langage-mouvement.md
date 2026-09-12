# Plan d'implémentation — MOTION-01

> Spec : [motion01-langage-mouvement.md](../specs/functional/us/motion01-langage-mouvement.md)
> Branche : `feature/motion01-langage-mouvement` (worktree isolé) ·
> Maquettes : [design/motion-01/](../../design/motion-01/)

## Principe d'ordonnancement

**Les primitives d'abord, le câblage ensuite.** Les 45 effets se ramènent à **six primitives
partagées** ; écrites une fois et testées, tout le reste n'est plus que de l'appel. Prendre les
lots dans l'ordre des piliers reviendrait à réécrire la même logique d'animation quatre fois.

Ordre imposé par les dépendances :

```
Lot 0 (primitives) → Lot 1 muscu → Lot 2 nutrition → Lot 3 course → Lot 4 accueil
                  ↘ tous les autres en dépendent ↙
```

Chaque lot finit sur `npm run typecheck && npm run lint && npm run test` verts.

**Règle de test.** Les primitives sont testées sur leur **contrat**, pas sur leur rendu image par
image : valeur finale atteinte, état final immédiat quand le mouvement est coupé, boucle annulée à
la perte de focus, absence de `setState` par frame. Jest ne fait pas tourner d'horloge Reanimated —
tester des trajectoires serait tester le framework.

---

## Lot 0 — Le socle (S1 – S14)

**Jetons** — `apps/mobile/src/theme/motion.ts` (neuf)
- `DURATION` : `instant 90`, `quick 160`, `base 240`, `data 420`, `celebrate 700`, `ambient 2400`.
- `STAGGER = 40`, `STAGGER_MAX = 6`.
- `SPRING` : `impact` (muscu, 420/18/.7), `settle` (générique, 260/24), `pop` (300/14).
- `EASING` : `fill` (nutrition, `bezier(.22,.61,.36,1)`), `flow` (course, `linear`), `breath`
  (`inOut(sin)`).
- Aucune couleur ici : le motion ne connaît pas la palette.

**Préférence** — `apps/mobile/src/stores/motion-store.ts` (neuf)
- Patron copié de `menu-accent-store` : `enabled` (défaut **true**), `hydrate()`, `setEnabled()`,
  persistance best-effort dans `secureStorage` (`motion_enabled`). Non synchronisé, pas de migration.

**Hook** — `apps/mobile/src/hooks/useAppReducedMotion.ts` (neuf)
- `useReducedMotion()` de Reanimated **OU** préférence app coupée ⇒ `true`.
- Retourne un booléen simple ; c'est la seule porte d'entrée de toute l'US.
- Tests : les 4 combinaisons système × app.

**Primitives** — `apps/mobile/src/components/motion/` (neuf)
- `PressableScale.tsx` — `Pressable` + `scale` en `withSpring(SPRING.settle)`, haptique optionnelle
  (`none | select | confirm | milestone`), `accessibilityRole` et `hitSlop` passés au travers.
  Mouvement coupé ⇒ se comporte exactement comme `Pressable` (l'haptique, elle, **reste**).
- `AnimatedNumber.tsx` — interpole depuis la valeur précédente (R5), `formatter` injectable,
  `fontVariant: ['tabular-nums']`. Mouvement coupé ⇒ affiche la valeur cible.
- `AnimatedRing.tsx` — `RingGauge` dont l'arc est un `SharedValue` ; réécrit `primitives.tsx` pour
  que **tous** les appelants existants en héritent sans changer d'API (`pct` reste la prop).
- `AnimatedBar.tsx` — `scaleX` avec `transform-origin` gauche + `delay` pour les cascades.
- `StaggerIn.tsx` — enveloppe ses enfants, `+12 px → 0` + fondu, `index * STAGGER` plafonné.
- `Breathe.tsx` — boucle `ambient` annulée sur perte de focus (R4), pour le halo et la pulsation GPS.

**Câblage transverse**
- `Button.tsx` → `PressableScale` (remplace l'`opacity: 0.85`).
- `Card.tsx` → accepte `onPress` et devient pressable-animée quand il est fourni.
- `AccentHalo.tsx` → option `breathe` sur les cartes héros.
- `(tabs)/_layout.tsx` → pastille glissante + icône qui pop, couleur du pilier actif.
- `_layout.tsx` → `animation` explicite sur les Stack (latéral / modal).
- `settings.tsx` → section « Animations » + 2 clés i18n FR/EN.

---

## Lot 1 — Musculation (M1 – M11)

- `CurrentSetCard` / `SetActionBar` → encaissement à la validation, balayage vert, coche qui se
  dessine. **R2 impérative ici** : l'appel repository part d'abord.
- `ExerciseList` → `Layout` de Reanimated pour la montée de la série suivante.
- `RestOverlay` → **`AnimatedRing` plein écran**, virage de couleur à T−5 s, battement du chiffre,
  éclat de fin. Le repli en barre passe par une transition de disposition, pas deux rendus.
- `workout.tsx` → toast de record `prpop` (composant `RecordToast` neuf, 2 ondes), plafonné à une
  occurrence par séance.
- `ProgramProgressBar` → `AnimatedBar`.
- Fiche exercice / résumé → schéma de muscles qui s'allume en cascade.

## Lot 2 — Nutrition (N1 – N9)

- `DayBalanceCard` → `AnimatedRing` + `AnimatedNumber` liés à l'ajout (N1, le geste quotidien).
- `MacroTriple` → `AnimatedBar` décalées 0/60/120 ms, dépassement ambre qui pulse 2 fois.
- `HydrationCard` → vagues SVG (2 sinusoïdes déphasées), niveau en `EASING.fill`, boucle bornée R4.
- Scan (`camera`) → balayage de visée, resserrement des coins, flash vert, sheet en ressort.
- `MicroCoverageGrid` → cascade par lignes, 50 ms.

## Lot 3 — Course (C1 – C10)

- `run/active.tsx` → `pulsedot` (2 halos déphasés), `dashmove` sur la polyline, désaturation
  d'auto-pause (doublée d'un texte, R1), splits qui entrent par la droite **+ haptique** (le pilier
  n'en émettait aucun).
- Bloc de fractionné → barre qui se vide, fond de zone en fondu, compte à rebours 3-2-1.
- `ProgressLineChart` → tracé qui se dessine (`stroke-dashoffset`), profite aussi à muscu et poids.
- `run/summary.tsx` → tracé redessiné puis stats en cascade.

## Lot 4 — Accueil & finitions (A1 – A6)

- `StreakCard` → `AnimatedNumber` + onde + jour qui s'allume.
- `SortableWidgetGrid` → ombre + `scale 1.03` sur l'élément soulevé.
- `WidgetGrid` → `StaggerIn`, `WidgetSkeleton` → fondu croisé vers le contenu réel.
- Check-in bien-être / ressenti → sélection qui grossit.
- `OnboardingScaffold` → `fadeslide`.
- `EmptyState` → respiration lente.

---

## Vérification finale

- `npm run typecheck` (3 workspaces) · `npm run lint` · `npm run test`.
- Parité i18n FR/EN via `scripts/check-i18n-parity.mjs`.
- Relecture manuelle de R4 : `grep` sur `repeat(` — chaque occurrence doit être dans un
  `useFocusEffect` ou un `cancelAnimation` au démontage.
