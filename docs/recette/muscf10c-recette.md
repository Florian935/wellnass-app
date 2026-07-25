# Recette — Lot F10c (= MUSC-F2) : muscles secondaires + variantes/alternatives

> À valider par Florian. Deux US : **F10c-1** (muscles secondaires) et **F10c-2** (variantes /
> alternatives). Coche au fur et à mesure ; note tout écart en bas.

## 0. Prérequis (à faire AVANT de tester)

- [ ] **⚠️ Redéployer les sync rules PowerSync** : coller le contenu de
      [powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml) dans le dashboard
      PowerSync (Settings → Sync Rules) → **Deploy**. Vérifier qu'il n'y a **pas d'erreur de parsing**
      et que le déploiement passe en « Active ». *Sans ça, `exercise_variants` ne descend pas au mobile.*
- [ ] **App mobile à jour** : installer/mettre à jour le build qui contient le nouveau schéma local
      (`exercise_variants` + colonne `muscles_secondary`). Au **premier lancement après mise à jour**,
      laisser la synchro se faire (les variantes éditoriales et les muscles secondaires descendent).
- [ ] **Comptes** : 1 compte **admin** (super_admin ou content_editor) pour le back-office web ;
      1 compte **utilisateur A** sur mobile ; idéalement un **2ᵉ compte B** pour tester l'isolation.
- [ ] **Jeu de test** : au moins 3–4 exercices **éditoriaux publiés** connus (ex. Développé couché,
      Développé haltères, Dips…) + 1 exercice **perso** créé sur le mobile.

---

## 1. F10c-1 — Muscles secondaires

### 1.1 Admin (back-office)
- [ ] Ouvrir un exercice éditorial **en édition** → la section **« Muscles secondaires »** est présente.
- [ ] Les cases proposées = tous les groupes musculaires **sauf le muscle primaire** sélectionné.
- [ ] Changer le **muscle primaire** pour un muscle qui était coché en secondaire → il **disparaît**
      automatiquement de la sélection secondaire (jamais primaire = secondaire).
- [ ] Cocher 2 muscles secondaires → **Enregistrer** → rouvrir l'exo → la sélection est **conservée**.
- [ ] Tout décocher → Enregistrer → rouvrir → **aucun** secondaire.

### 1.2 Mobile (fiche exercice)
- [ ] Sur la fiche de l'exo édité ci-dessus → ligne **« Muscles secondaires »** affichée, avec les noms
      séparés par « · », **sous** le groupe musculaire.
- [ ] Exercice **sans** muscles secondaires → **pas de ligne** « Muscles secondaires ».
- [ ] Exercice **perso** → **jamais** de ligne muscles secondaires (pas de saisie côté mobile).
- [ ] **i18n** : passer l'app en **anglais** → libellé « Secondary muscles » + noms de muscles en anglais.

---

## 2. F10c-2 — Variantes / alternatives

### 2.1 Admin — liens éditoriaux (bibliothèque ↔ bibliothèque)
- [ ] Sur un **nouvel** exercice (création, pas encore enregistré) → message
      « Enregistre l'exercice avant d'ajouter des variantes » (pas de gestion tant que l'exo n'existe pas).
- [ ] Sur un exercice **existant en édition** → section **« Variantes / alternatives »** présente.
- [ ] Rechercher un autre exo → les résultats **excluent** l'exo lui-même et ceux **déjà liés**.
- [ ] **Ajouter** une variante (ex. Développé couché ↔ Développé haltères) → apparaît en **chip**.
- [ ] Ouvrir **l'autre** exercice (Développé haltères) → la variante **réciproque** apparaît (symétrie).
- [ ] **Supprimer** (✕) un chip → disparaît **des deux** côtés.
- [ ] **Ajouter → supprimer → ré-ajouter** la même paire → **aucune erreur** (réactivation, anti-doublon).
- [ ] *(si accès au journal d'audit)* : les actions **link / unlink** sont tracées.

### 2.2 Mobile — affichage & liens personnels
> Après avoir créé des liens éditoriaux côté admin, **attendre la synchro** sur le mobile.

- [ ] Fiche d'un exo biblio ayant des variantes éditoriales → section **« Variantes / alternatives »**
      avec la liste ; **pas de ✕** sur les liens éditoriaux (non supprimables par l'utilisateur).
- [ ] **Taper** une variante → **navigue** vers la fiche de cette variante.
- [ ] Bouton **« + Ajouter une variante »** présent sur **n'importe quelle** fiche (biblio ou perso).
- [ ] Le sélecteur d'ajout **exclut** l'exo courant et les exos **déjà liés**.
- [ ] Choisir un exo → retour sur la fiche → la **variante perso** apparaît **avec un ✕**.
- [ ] La variante perso apparaît aussi sur la **fiche de l'autre** exo (symétrie).
- [ ] **✕** sur une variante perso → disparaît **des deux** fiches.
- [ ] **Ré-ajouter** la même variante perso → aucune erreur, réapparaît.
- [ ] Lier un **exo perso** à un exo biblio → visible sur les deux fiches ; la ligne pointant vers l'exo
      perso porte le badge **« perso »**.
- [ ] Lien perso **biblio ↔ biblio** (autorisé, sans contrainte) → fonctionne.
- [ ] **Dédup** : si une paire a déjà un lien **éditorial**, elle s'affiche **une seule fois** (comme
      éditoriale, **sans ✕**), même si tu as aussi tenté un lien perso identique.
- [ ] **i18n** : en anglais → « Variants / alternatives », « Add a variant », « No variant yet ».

### 2.3 Offline-first
- [ ] Mode **avion** → ajouter / supprimer une variante **perso** → l'UI réagit **immédiatement**
      (écriture locale).
- [ ] Les variantes **éditoriales** restent **lisibles hors-ligne** (déjà synchronisées).
- [ ] Rebrancher le réseau → les changements perso **persistent** après reconnexion (revérifier après
      un redémarrage de l'app, ou sur un 2ᵉ appareil du même compte).

### 2.4 Isolation & sécurité (2 comptes)
- [ ] Les variantes **perso** de l'utilisateur **A** **n'apparaissent pas** chez l'utilisateur **B**.
- [ ] Les variantes **éditoriales** apparaissent chez **tous** les utilisateurs.
- [ ] Un utilisateur ne peut **pas** supprimer une variante éditoriale (aucun ✕ dessus).

### 2.5 Cas limites
- [ ] **Dépublier / archiver** côté admin un exo qui est une variante → sur mobile (après sync) il
      **n'apparaît plus** dans la liste des variantes (pas de ligne fantôme).
- [ ] Aucune **ligne cliquable vide** ne s'affiche (variante dont le nom ne se résout pas → omise).

---

## 3. Non-régression (rapide)

- [ ] Sélecteur d'exercices **en séance** : ajout d'un exo à une séance + **remplacement** d'un exo en
      séance fonctionnent toujours (le nouveau mode « variante » n'a rien cassé).
- [ ] Recherche + **filtres** (groupe musculaire / matériel), **favoris**, **création d'exo perso** : OK.
- [ ] Fiche exercice : **records** (1RM/charge max/volume), **instructions**, **favori ⭐**, et la nav
      « Voir la progression » : toujours OK.
- [ ] La **liste** des exercices (biblio) s'affiche normalement (pas de ralentissement notable).

---

## Écarts constatés (à remplir)

| # | Écran / étape | Attendu | Constaté | Sévérité |
|---|---------------|---------|----------|----------|
|   |               |         |          |          |

## Verdict
- [x] **F10c-1 validé** — Florian, 23/07/2026.
- [x] **F10c-2 validé** — Florian, 23/07/2026.
- [x] Lot F10c **validé** (→ relecture Damien / merge `dev` → `main` selon process).

> **2 retours UX hors périmètre** (captés dans [IDEAS.md](../../IDEAS.md), à cadrer en US) :
> 1. Création d'exercice perso → passer en **modale** (card inline mal fichue : Segment multi-ligne,
>    nom sans placeholder, effet « sandwich »).
> 2. **Cohérence** de la fiche exercice bibliothèque VS perso (structure/champs qui diffèrent).
