---
id: ACCUEIL-09
titre: "Le mouvement — lueurs qui respirent, six animations, astuces enrichies, record partageable, Prisme au bout du fil"
roadmap: [7.46]
catalogue: []
etape: close
branche: feature/accueil09-le-mouvement
maj: 27/10/2026
---

# US ACCUEIL-09 — Le mouvement

> Troisième et dernier lot de la refonte de l'accueil (décisions D1-D6 de Florian du 25/10/2026).
> Brief : [design/accueil-2026-10/README.md](../../../../design/accueil-2026-10/README.md) §5, planche
> `Anim.dc.html`. Précédents : [ACCUEIL-07](accueil07-accueil-dit-vrai.md) (l'accueil dit vrai, teinte
> Aurore), [ACCUEIL-08](accueil08-ta-journee.md) (« Ta journée »). Dev direct, spec écrite avec le code.

## 1. Ce que l'US ajoute

L'accueil « Ta journée » était juste et complet, mais immobile : rien ne disait qu'un geste venait
d'avoir lieu, les lueurs étaient figées au dosage du moment, et les piliers ne se parlaient que sur
les repas. Ce lot apporte le mouvement de la planche, sous les règles de DASH-01 (R1 le mouvement ne
porte aucune information, R2 un seul élément vivant au repos, R3 rien par image côté JS, R4 boucles
coupées hors focus), et trois ajouts de contenu.

| # | Animation | Où | Règle |
|---|---|---|---|
| 1 | **Les cadrans s'ouvrent** : chaque segment ou arc se remplit en 900 ms (décalé de 80 ms d'un segment au suivant, de 120 ms d'un cadran au suivant), les légendes montent de 6 px | `HomeDials` | à l'arrivée, une fois par montage |
| 2 | **Une ligne cochée, l'anneau suit** : le rond du geste fait (ou du résumé quand le compte monte) se gonfle puis se pose ; l'anneau Manger part de sa valeur d'avant (420 ms) ; un segment de Bouger qui passe à « fait » se déroule dans sa couleur | `HomeDayTimeline`, `HomeDials` | seulement quand le geste vient d'avoir lieu |
| 3 | **La carte du moment entre** : elle monte de 10 px en 460 ms | `HomeDayTimeline` | quand l'action du moment change |
| 4 | **Les visages** : le visage choisi s'allume en turquoise dans un rebond, les autres s'effacent, retour tactile ; la phrase du jour se réécrit en fondu | `CheckinFaces`, `HomeStage` | au toucher |
| 5 | **La feuille « Noter »** monte, ses tuiles arrivent en cascade ; un verre d'eau noté se confirme par un **toast** de 2,6 s | `AddSheet`, `HomeToast` | à l'ouverture, au geste |
| 6 | **Les lueurs respirent et suivent l'heure** : dosage interpolé en continu, glissement de 1,2 s à chaque pas d'horloge ; souffle de 4,8 s (échelle 1,07 depuis le coin, opacité 85-100 % du dosage), les deux lueurs en opposition de phase | `AuroraGlows` | seul élément vivant au repos ; coupé hors focus |

Contenu :
- **Astuces croisées enrichies** — la carte de la séance en porte une (forme du jour, record à
  portée de la séance, « tous les signaux au vert ») ; les protéines se disent par repas.
- **Carte record partageable** — « Partager » sur le record battu de « Du nouveau » ouvre l'aperçu de
  PARTAGE-01 avec une variante `record`.
- **Prisme du soir au bout du fil** — la carte du soir de PRISME-01 quitte sa place sous le fil pour
  se poser à sa fin.

## 2. Règles métier

### 2.1 Les lueurs (`auroraDose`, `AURORA_BREATH`, `theme/stage.ts`)
- Le dosage `[turquoise, framboise]` vaut exactement celui de `AURORA_DOSES` au cœur de chaque
  lumière (nuit 1 h 45, aube 7 h 15, journée 13 h, heure dorée 18 h 15, soirée 20 h 45) et s'interpole
  linéairement entre deux cœurs, minuit compris. Une interpolation ne sort jamais de l'enveloppe de la
  table : turquoise ≤ 0,38 et framboise ≤ 0,52 à toute heure — les surfaces mêlées mesurées par
  `stage.test.ts` restent les pires qu'on puisse voir.
- La respiration ne fait que **baisser** l'opacité sous le dosage (de 100 % à 85 %), jamais la monter.
- Souffle coupé (`useLoopActive('home')` faux : accueil pas au premier plan, app en arrière-plan,
  animations réduites) : chaque lueur à son dosage exact, sans échelle.

### 2.2 Les astuces (`crossTip`, `sessionNearRecord`, `packages/shared`)
- **Carte de la séance de musculation**, dans cet ordre : forme du jour « repos conseillé » (« garde
  tes charges de travail, pas de record aujourd'hui ») → record à portée **d'un exercice de la séance**
  (« Squat : à 2,5 kg de ton record », écart dans l'unité de l'utilisateur ; ou en répétitions) →
  « tous les signaux au vert ». Forme « correcte » sans record à portée : pas d'astuce.
- **Carte d'une course** : seulement « repos conseillé » (« une sortie facile, sans chrono »).
- **Repas** : l'ordre d'ACCUEIL-08 (séance plus tard, kcal ouvertes, protéines) ; l'écart de
  protéines du jour (≥ 30 g) se **répartit sur les repas qui restent** (« Vise ~25 g à ce repas »,
  arrondi à 5 g, au moins 10 g) ; au dernier repas, l'écart entier.
- Le record à portée est le premier de `nearRecords` (déjà trié) dont l'exercice est au plan de la
  séance du jour (`useSessionBrief`) et qui n'est pas déjà battu. **Une seule lecture, deux usages** :
  l'astuce de la carte et la carte « Record à portée » de « Du nouveau ».

### 2.3 La carte record partageable
« Partager » (bouton distinct de la carte, qui elle ouvre les progrès) ouvre `ShareCardSheet` avec
`{ kind: 'record', label, value, startedAtMs }` : l'exercice ou la distance, la valeur formatée
(charge dans l'unité de l'utilisateur, temps d'une distance), la date du record. Rien d'autre ne sort
de l'app — ni poids de corps, ni donnée de santé (D7 de PARTAGE-01). Variantes pleine et transparente
(halos compris, y compris sur la médaille) ; fichier `record-AAAAMMJJ-HHMM[-transparent].png`.

### 2.4 Prisme du soir
Dès 18 h, au bout du fil, **seulement si Prisme peut raconter la journée** (visible, pas d'humeur
basse — R7 et R12 de PRISME-01) : « Prisme du soir », le bouton « Prisme raconte », et en petit « Ce
que Prisme lira » (les faits du dossier, R4). Sans Prisme, rien : le fil dit déjà la journée.

## 3. Cas limites
- Animations réduites (réglage de l'app ou du système) : toutes les valeurs finales d'emblée, aucune
  entrée, aucun rebond, aucun souffle ; les retours tactiles demeurent (MOTION-01).
- Retour sur l'accueil depuis un autre onglet : rien ne rejoue (l'écran reste monté) ; le souffle
  reprend.
- Un geste fait alors que deux gestes l'étaient déjà : le rond du résumé se gonfle (la ligne rejoint
  le résumé replié) ; au passage de 1 à 2 gestes faits, le résumé apparaît sans rebond.
- Séance libre ou plan inconnu : aucun record à portée (ni astuce, ni carte).
- Record de volume (tonnage) : la carte partage le tonnage en kg, comme « Du nouveau » l'affiche.
- Deux verres d'eau à la suite : le toast reste affiché 2,6 s depuis le premier.

## 4. i18n (FR + EN)
Nouvelles clés : `home.tips.{sessionRest, runRest, sessionPush, nearRecordKg, nearRecordReps (pluriel),
proteinPerMeal}`, `home.tips.tag.{readiness-strength, readiness-running, strength-record}`,
`home.toast.water`, `home.news.record.{share, shareA11y}`, `share.record.title`,
`prisme.evening.{filTitle, reads}`. Parité vérifiée par `locale-parity.test.ts`.

## 5. Offline
Tout est local : les lectures existantes du plan de séance (`useSessionBrief`) et des records à portée
(`useNearRecords`) ; le partage reste celui de PARTAGE-01 (capture locale, feuille du système).
**Aucune migration, aucune sync rule, aucun appel réseau** (hors Prisme, inchangé : à la demande).

## 6. Décisions prises en route
- **D-a** — Dosage **interpolé** entre les cœurs des lumières plutôt que cinq paliers : « l'aurore suit
  l'heure » sans saut visible ; l'enveloppe de la table garantit le contraste à toute heure.
- **D-b** — La respiration module l'**opacité d'une vue** (et son échelle), le dégradé SVG étant posé
  une fois à pleine intensité : R3 tenu (thread UI), et aucune valeur au-dessus du dosage mesuré.
- **D-c** — La carte du moment ne respire plus (`AccentHalo` sans souffle) : R2. Une garde de source
  (`home-motion-rules.test.ts`) interdit toute autre boucle sur l'accueil.
- **D-d** — Le record à portée est **celui de la séance du jour** (et non le plus proche toutes séances
  confondues) : un record au squat promis un jour de pecs serait une fausse promesse. « Du nouveau »
  en bénéficie aussi (avant : n'importe quel exercice, un jour de séance).
- **D-e** — Un jour de « repos conseillé », la forme passe **avant** le record à portée.
- **D-f** — Prisme du soir n'apparaît au bout du fil que si Prisme peut raconter ; les faits seuls n'y
  ajouteraient rien au fil.
- **D-g** — Pas d'animation de compteur sur les cadrans (chiffres posés) : l'anneau porte le mouvement,
  le chiffre reste lisible d'emblée (R1).

## 7. Ce qui n'est pas fait (ici)
- La « progression » chiffrée (« Squat : tente 102,5 kg ») de la toile : aucune brique ne propose
  aujourd'hui de charge cible par exercice ; l'astuce dit l'écart au record, pas la charge à tenter.
- Le toast d'un check-in ou d'un repas noté : le visage allumé et la ligne cochée suffisent.
- La carte record partageable depuis l'écran des progrès : seule « Du nouveau » la propose.
- Vérification sur appareil du souffle et des entrées (rendu Reanimated non testable sous Jest : les
  tests vérifient l'état final et les règles, comme le reste de MOTION-01).
