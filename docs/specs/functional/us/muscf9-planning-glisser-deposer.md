---
id: MUSC-F9
titre: "Décalage d'une séance planifiée en glisser-déposer"
roadmap: [3.10]
catalogue: []
etape: validation
branche: feature/muscf9-planning-glisser-deposer
maj: 30/07/2026
---

# US MUSC-F9 — Décalage d'une séance planifiée en glisser-déposer

> **Le chemin d'écriture existe déjà.** `reschedulePlannedSession(id, targetDate)` est livré, testé et
> utilisé par les trois boutons actuels de la feuille d'action
> ([planning/index.tsx](../../../../apps/mobile/src/app/planning/index.tsx)). Cette US **n'ajoute
> aucune règle métier** : elle ajoute un **geste** qui appelle la même fonction avec une date libre.
> C'est ce qui la rend petite — et ce qui déplace tout le risque vers l'interaction.

## 0. Ce qui existe aujourd'hui

L'écran planning affiche une **semaine**, jour par jour. Décaler une séance demande : appui sur la
carte → feuille d'action → l'un de **trois** boutons figés — « aujourd'hui », « demain », « +7 jours ».

**La limite est là** : décaler du mardi au jeudi, le cas le plus courant, n'est **pas** proposé. Il
faut passer par « +7 jours » puis recommencer, ou refaire le planning. Le geste naturel — attraper la
séance et la poser sur le bon jour — n'existe pas.

## 1. Périmètre

**Dans le périmètre** — déplacer une séance `planned` d'un jour à un autre **à l'intérieur de la
semaine affichée**, au doigt.

**Hors périmètre**, et volontairement :
- **Réordonner** deux séances dans un même jour. `planned_sessions.order_index` existe, mais la
  valeur d'usage est nulle : personne ne « fait la séance A avant la B » dans une journée.
- Le glisser-déposer **entre semaines** (voir §3, D2).
- Les séances `done` et `skipped` : déplacer un fait accompli n'a pas de sens. **Non saisissables.**

## 2. Règles

**R1 — Seules les séances `planned` se saisissent.** Une séance `done` ou `skipped` ne réagit pas au
geste. Elle reste évidemment sélectionnable à l'appui simple.

**R2 — Le déposé écrase la date, rien d'autre.** L'appel est
`reschedulePlannedSession(id, dateCible)`, exactement comme les boutons actuels. `week_index`,
`status` et `order_index` ne bougent pas. **Aucune nouvelle colonne, aucune migration.**

**R3 — Déposer une séance sur son propre jour ne fait rien.** Pas d'écriture, pas de toast : c'est un
geste annulé, pas une action.

**R4 — Plusieurs séances peuvent atterrir le même jour.** C'est déjà possible aujourd'hui via « +7 ».
Le jour cible les empile ; aucune limite, aucun avertissement. Refuser serait inventer une règle que
l'app n'applique nulle part ailleurs.

**R5 — Déplacer vers un jour passé est autorisé.** L'app permet déjà de marquer une séance faite
rétroactivement ; interdire le passé créerait une incohérence. La séance reste `planned`, donc
apparaîtra dans « manquées » — ce qui est le comportement correct.

**R6 — Le geste doit être annulable avant le lâcher.** Relâcher hors de toute cible = retour à la
place d'origine, sans écriture.

## 3. 🔴 Trois décisions d'interaction

**D1 — Comment on attrape.** Deux options :
- **(a) Appui long (≈ 200 ms) puis glissement.** Recommandé. C'est le patron déjà employé par le
  réagencement du dashboard (`activateAfterLongPress(700)`, UX-LOT-01), donc **cohérent avec un geste
  que l'utilisateur connaît déjà dans l'app**. Un délai plus court qu'au dashboard (200 vs 700 ms)
  parce qu'ici la liste ne défile pas verticalement sur la même zone.
- **(b) Poignée dédiée** sur la carte. Plus découvrable, mais ajoute un élément visuel sur **chaque**
  carte, et UX-LOT-01 vient justement d'alléger ces cartes.
→ **Ma recommandation : (a)**, avec l'indice textuel déjà employé au dashboard.

**D2 — Le passage d'une semaine à l'autre pendant le glissement.** Trois options :
1. **Ne pas le gérer.** Le déplacement inter-semaines reste au bouton « +7 ». Simple, honnête.
2. Auto-défiler quand le doigt s'approche du bord. C'est **le vrai coût de cette US** — la
   combinaison glissement + changement de page est la source classique de bugs.
3. Zones de dépôt « semaine précédente / suivante » en haut d'écran.
→ **Ma recommandation : option 1** pour cette US, option 3 en évolution si le besoin se confirme.

**D3 — Retour haptique.** Une vibration courte à la prise et au dépôt. `expo-haptics` **n'est pas
installé** — c'est donc une dépendance nouvelle (JS, pas de rebuild natif requis sur Expo). À valider
ou à écarter.

## 4. i18n

Deux chaînes neuves seulement, FR + EN :
- `planning.dragHint` — « Appui long pour déplacer » / « Long-press to move ».
- `planning.movedTo` — « Séance déplacée au {{date}} » / « Session moved to {{date}} ».

Aucune chaîne existante modifiée.

## 5. Comportement offline

**Identique à l'existant, sans effort particulier** : `reschedulePlannedSession` écrit dans PowerSync
local, la file de synchro s'en charge. Le déplacement est donc **immédiatement visible hors ligne**
et remonte au retour du réseau. **Aucune sync rule à redéployer** (aucune table nouvelle).

Cas limite à couvrir : déplacement effectué hors ligne puis **modification du même planning sur un
autre appareil**. C'est le cas de conflit standard de PowerSync (dernière écriture gagne), déjà
accepté ailleurs dans l'app — à ne pas retraiter ici.

## 6. Accessibilité

⚠️ **Un geste de glisser-déposer n'est pas utilisable sous TalkBack.** Le contournement est
obligatoire, pas optionnel : **les trois boutons de la feuille d'action restent en place et ne sont
pas retirés.** Ils sont le chemin accessible, et ils couvrent déjà les cas courants. Cette US
**ajoute** un raccourci gestuel, elle ne remplace rien.

## 7. Critères de recette

- [ ] 1. Appui long sur une séance `planned` → elle « décolle » visuellement.
- [ ] 2. La déposer sur un autre jour de la semaine → elle s'y affiche immédiatement.
- [ ] 3. Fermer puis rouvrir l'app → **le déplacement a tenu**.
- [ ] 4. Déposer une séance sur son propre jour → **rien ne se passe**, aucun toast.
- [ ] 5. Relâcher en dehors de tout jour → retour à la place d'origine, aucune écriture.
- [ ] 6. Une séance **terminée** ne se saisit pas.
- [ ] 7. Deux séances sur le même jour cible : les deux s'affichent, aucune n'est perdue.
- [ ] 8. **Mode avion** : le déplacement s'affiche tout de suite ; réseau rétabli → il remonte.
- [ ] 9. **TalkBack actif** : les trois boutons de report restent atteignables et fonctionnels.
- [ ] 10. Le **défilement vertical** de l'écran fonctionne toujours normalement (le geste de
      glissement ne doit pas l'avoir capturé).
- [ ] 11. En **EN** : l'indice et le toast sont en anglais.

## 8. Point dur assumé

Le risque n'est **pas** dans l'écriture — elle est éprouvée. Il est dans la **cohabitation de trois
gestes sur la même surface** : défilement vertical de la liste, changement de semaine, et le nouveau
glissement. C'est ce que le critère 10 vérifie, et c'est la raison d'écarter D2-option 2.
