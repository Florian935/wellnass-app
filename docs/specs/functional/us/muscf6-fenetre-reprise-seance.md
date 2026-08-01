---
id: MUSC-F6
titre: "Fenêtre de reprise de séance — réconciliation du seuil 3h/4h"
roadmap: [3.36]
catalogue: []
etape: close
branche: feature/muscf6-fenetre-reprise-seance
maj: 31/07/2026
---

# US MUSC-F6 — Fenêtre de reprise de séance

## 0. Le constat

La [spec fonctionnelle musculation](../../musculation.md#44-fin-de-séance) (§4.4) promet :

> Si l'utilisateur quitte en cours : popup **« Abandonner »** ou **« Pause »** (met en pause,
> sauvegarde l'état). Une **séance en pause** peut être **reprise dans les 4 heures**.

**Rien de tout cela n'a jamais été implémenté.** Il n'existe :
- aucun statut `paused` (`WORKOUT_STATUSES = ['active', 'completed', 'cancelled']`,
  [workout.ts](../../../../packages/shared/src/workout.ts)) ;
- aucune popup « Abandonner / Pause » au moment de quitter l'écran de séance ;
- aucune fenêtre de 4h codée nulle part (aucune constante, aucun test, aucune chaîne i18n visible).

Ce qui existe réellement : « quitter » une séance ne fait que **naviguer ailleurs** — la ligne
`workouts` reste `status = 'active'`. Elle redevient reprenable via le bouton « Reprendre »
(hub muscu, `useActiveWorkout()`) tant qu'elle n'a pas été clôturée. Or une **unique** clôture
existe déjà, tout à fait indépendante de cette promesse de spec : `WORKOUT_AUTO_CLOSE_SECONDS`
(**3h**, [workout.ts](../../../../packages/shared/src/workout.ts)), vérifiée par
`autoCloseStaleWorkout()` **au démarrage de l'app** (pas de minuteur en tâche de fond — une séance
dépassant 3h reste « active » jusqu'au prochain lancement).

**Donc le conflit « 3h vs 4h » n'a jamais existé dans le comportement observable de l'app** — il
n'existe que dans la documentation. Aujourd'hui, une utilisatrice qui revient après 3h30 ne voit
**aucun** blocage à 4h (la promesse de spec n'a jamais été tenue) : elle voit encore « Reprendre »
si l'app n'a pas redémarré depuis le dépassement de 3h, ou trouve la séance déjà clôturée sinon.

## 1. Décision à valider (D1)

**Deux options.** Ni l'une ni l'autre n'est un défaut du code actuel — c'est un choix produit.

### Option A — Officialiser 3h comme seuil unique (recommandée)

Corriger la documentation pour qu'elle dise ce que le code fait déjà, plutôt que l'inverse :
- `musculation.md` §4.4 : remplacer la promesse « pause + reprise dans les 4h » par une description
  fidèle — quitter l'écran ne « met pas en pause » à proprement parler, la séance reste simplement
  active et reprenable jusqu'à la clôture automatique (3h).
- Roadmap 3.36 : « Suspendre et reprendre dans les 4 heures » → « Reprenable jusqu'à la clôture
  automatique (3h, US 3.37) ».
- **Zéro ligne de code applicatif.** `WORKOUT_AUTO_CLOSE_SECONDS` est déjà LA source de vérité,
  déjà testée (`workout.test.ts`), déjà partagée. Aucune UI ne mentionne « 4 heures » aujourd'hui
  (recherche exhaustive `apps/mobile/src`, i18n compris) : rien à corriger côté utilisateur.

### Option B — Deux notions distinctes (fenêtre « molle » de reprise + clôture « dure »)

Introduire une vraie fenêtre de reprise (ex. 4h) **différente** du délai de clôture auto (3h ou
autre), avec un avertissement affiché à l'utilisateur à l'approche de la limite. Implique :
- une seconde constante (`WORKOUT_RESUME_WARNING_SECONDS` ou équivalent) ;
- une UI d'avertissement sur la carte « Reprendre » du hub muscu ;
- une clarification du fait que la clôture auto ne s'exécute qu'au démarrage de l'app — un
  avertissement « il te reste 22 minutes » serait donc **imprécis par construction** tant qu'il n'y
  a pas de minuteur en tâche de fond (hors périmètre : coût batterie/complexité disproportionné
  pour une séance de musculation).
- **Nettement plus de travail pour un bénéfice non démontré** : personne n'a signalé qu'un
  utilisateur ait été gêné par la clôture à 3h ; c'est une promesse de spec jamais réclamée depuis.

**Recommandation : Option A.** Rien n'indique qu'un vrai besoin utilisateur se cache derrière le
chiffre « 4 heures » — c'est un vestige de la première rédaction de `musculation.md`, jamais
retouché depuis. Corriger la doc pour qu'elle cesse de mentir coûte une US ; construire l'option B
sur la seule foi d'un chiffre non retenu coûterait un vrai chantier pour un bénéfice hypothétique.

## 2. Ce qui change si Option A est validée

- `musculation.md` §4.4 (texte cité en §0) réécrit.
- Roadmap 3.36 : libellé + remarque mis à jour, colonne **Statut → ✅** (plus aucun écart entre la
  doc et le code une fois corrigée).
- Aucun test à ajouter : le comportement (3h, `autoCloseStaleWorkout`) est déjà couvert par
  `workout.test.ts` et n'est pas modifié par cette US.

## 3. i18n / offline / notifications

Sans objet côté Option A (aucune chaîne, aucun écran, comportement offline inchangé — la clôture
auto tourne déjà en local, sans réseau).

## 4. Critères de recette

Aucun (Option A ne change aucun comportement observable). Clôture par relecture des deux documents
corrigés — pas de recette device.
