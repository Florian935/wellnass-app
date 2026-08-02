---
id: RUN-F2b
titre: "Prolonger ou raccourcir — cible visible en direct"
roadmap: [5.23]
catalogue: []
etape: recette
branche: feature/runf2b-cible-en-direct
maj: 02/08/2026
---

# US RUN-F2b — Prolonger ou raccourcir (cible en direct)

> **2ᵉ des 4 candidats issus du découpage de RUN-F2** (BACKLOG.md, 02/08/2026), après RUN-F2a
> (annonces audio, livrée). Roadmap 5.23 : « Terminer avant la cible ou continuer en libre. »

## 0. Ce qui existe déjà, et ce qui manque vraiment

RUN-F3 (roadmap 5.25, livrée le 01/08/2026, en recette) a déjà construit **tout le calcul** :
`compareToTarget` (`packages/shared/src/run-target.ts`, pure, testée) compare une distance/durée
réalisée à la cible de la séance planifiée, et `run/summary.tsx` l'affiche déjà **après coup** avec
les phrases `running.target.distance{Reached,Over,Under}` / `duration{Reached,Over,Under}` — déjà
tolérantes en tense (« X sur Y visés »), réutilisables telles quelles pour un affichage **pendant**
la course, pas seulement après.

**Ce qui manque réellement** : `run/active.tsx` ne lit **jamais** `plannedSessionId` ni la cible —
`ActiveRun` (type retourné par `useActiveRun()`) n'expose même pas ce champ aujourd'hui. Le
diagnostic du backlog (« déconnectées du tracker actif ») se résume donc à un **branchement
manquant**, pas un calcul à inventer. Une fois `plannedSessionId` exposé, `useRunTarget` (déjà
utilisé par `summary.tsx`, `run-repository.ts:345`) se réutilise lui aussi tel quel — encore moins
de code neuf que prévu au départ.

**Reformulation du besoin roadmap, plus précise que l'intitulé** : « terminer avant la cible » est
**déjà possible** aujourd'hui — le bouton Stop existe et termine la course quelle que soit la
distance parcourue. Ce qui manque pour que ce choix soit **informé** plutôt qu'à l'aveugle, c'est de
**voir** la cible et l'écart pendant la course. De même, « continuer en libre » ne demande aucune
bascule de mode : une fois la cible atteinte, continuer à courir est déjà le comportement par
défaut (rien ne coupe la course). **Cette US ajoute donc uniquement la visibilité**, pas une
nouvelle mécanique de décision — les deux actions du titre roadmap sont déjà couvertes par
l'existant dès que l'information est affichée.

## 1. Surfaçage

Une carte « Objectif » dans `run/active.tsx`, sous les métriques principales (distance/chrono/
allures) — même patron visuel que la carte objectif de `run/summary.tsx` (`Card` +
`running.target.title`), recalculée en direct au lieu d'une fois à la clôture. **Absente si aucune
cible** (course libre, ou séance sans cible chiffrée) — jamais un encart vide (même règle que
RUN-F3 R1, déjà appliquée au résumé).

## 2. Les règles

**R1 — Réutilise `compareToTarget` tel quel, appelé en continu.** Aucune nouvelle fonction pure :
la fonction de RUN-F3 ne connaît que des valeurs (distance/durée réalisées vs visées), pas un état
« course terminée » — l'appeler à chaque re-render avec les valeurs **en cours** au lieu des valeurs
**finales** est un usage déjà couvert par sa signature actuelle.

**R1 bis — L'axe durée utilise `active.durationSeconds` (post-flush, hors pauses), jamais
`elapsedSeconds` en repli.** Relu : `active.tsx` a un repli `elapsedSeconds` (horloge murale brute,
`Date.now() − startedAt`) pour l'affichage tant qu'aucun flush n'est encore arrivé — ce repli
**inclut les pauses**, contrairement à `durationSeconds` (net, hors pauses, déjà garanti par le
tracker). L'utiliser pour la comparaison à une cible de durée produirait un statut `over` prématuré
et faux dans la fenêtre étroite avant le premier flush (~1 s en pratique, mais un faux « dépassé »
casserait R4 — jamais un signal trompeur). L'axe durée de la carte objectif reste donc **absent**
tant que `active.durationSeconds` est `null`, plutôt que de retomber sur l'horloge murale comme le
fait l'affichage du chrono principal (qui, lui, n'a pas cette contrainte de justesse).

**R2 — Réutilise les mêmes clés i18n que le résumé (`running.target.*`), aucune clé neuve.** Les
phrases (« X sur Y visés », « objectif atteint », « dépassé de Z ») sont déjà neutres en tense —
valables aussi bien pendant qu'après une course. Créer une deuxième famille de clés dupliquerait un
texte qui n'a pas besoin de changer.

**R3 — `ActiveRun` gagne `plannedSessionId: string | null`.** Seule extension de surface
nécessaire — `runs.planned_session_id` existe déjà en base (posé par RUN-F3), seul le type de
retour de `useActiveRun()` ne l'exposait pas.

**R4 — Même ton que RUN-F3 (R4 de sa spec) : jamais alarmant.** `success` pour atteint/dépassé,
neutre pour en deçà, jamais une couleur d'alerte — ne pas atteindre un objectif de course en cours
de route n'est pas un échec, c'est l'état normal avant la fin.

**R5 — Aucune action nouvelle proposée.** Pas de bouton « Terminer maintenant » ni « Continuer en
libre » distinct du Stop existant (§0) — l'US ajoute de l'information, pas un nouveau flux de
décision. Si l'usage réel montre qu'un bouton dédié apporterait de la valeur au-delà de la
visibilité, ce serait un candidat distinct, pas une extension surprise de celui-ci.

## 3. Périmètre

**Dans le périmètre** :
- `ActiveRun`/`ActiveRunDbRow`/`SELECT_ACTIVE_RUN`/`rowToActiveRun` étendus (R3).
- Carte « Objectif » dans `run/active.tsx`, calcul dupliqué (volontairement, pas un partage
  d'abstraction avec `summary.tsx` — §0 du plan explique pourquoi) de `compareToTarget` +
  construction des libellés, avec les valeurs live (`distanceM`, durée nette/horloge).

**Hors périmètre** :
- Tout nouveau bouton d'action (R5).
- Refactor du calcul de libellé de `run/summary.tsx` pour le partager avec `active.tsx` — RUN-F3
  est encore en recette (non clôturée) ; toucher son code dans cette US ajouterait un risque de
  régression sur une fonctionnalité pas encore validée par un humain, pour un gain de duplication
  mineur (~15 lignes). Un futur nettoyage pourra factoriser une fois RUN-F3 clôturée.
- RUN-F2c (blocs fractionné) et RUN-F2d (guidage vocal) — candidats distincts.

## 4. i18n

**Aucune clé neuve** — réutilise `running.target.*` (déjà FR + EN, RUN-F3).

## 5. Comportement offline

**Total.** Lecture PowerSync locale (`runs`, `planned_sessions`, `sessions`, déjà synchronisées),
calcul pur. Aucun réseau.

## 6. Accessibilité

Même patron que le résumé : chaque phrase de comparaison est un `Text` unique par axe (pas de
fragments), cohérent avec ce qui existe déjà et sera recetté pour RUN-F3.

## 7. Critères de recette

- [ ] 1. Une course démarrée depuis une séance planifiée avec cible de distance affiche « X sur Y
      visés » qui progresse en direct pendant la course.
- [ ] 2. La cible franchie fait passer le libellé à « objectif atteint » sans interruption ni
      changement de couleur alarmant (R4).
- [ ] 3. Continuer à courir après avoir atteint la cible affiche « dépassé de Z », qui continue de
      progresser — rien n'empêche ni ne signale négativement la poursuite (R5, « continuer en libre »
      déjà natif).
- [ ] 4. Une course libre (sans séance planifiée) n'affiche aucune carte objectif.
- [ ] 5. Une séance planifiée sans cible chiffrée n'affiche aucune carte objectif (pas un encart
      vide).
- [ ] 5 bis. Une cible de durée ne s'affiche jamais comme « dépassée » dans les toutes premières
      secondes de la course, avant le premier flush GPS (R1 bis).
- [ ] 6. Le bouton Stop existant fonctionne à tout moment de la course, avant ou après la cible,
      sans changement de comportement (R5, « terminer avant la cible » déjà natif).
- [ ] 7. **Mode avion** : la carte objectif s'affiche normalement (aucun réseau requis).
- [ ] 8. En **EN** : aucune régression sur les clés `running.target.*` déjà traduites et
      grammaticales (réutilisées telles quelles, R2).
