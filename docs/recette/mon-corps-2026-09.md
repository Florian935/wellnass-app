# Mon corps — validation du 13/09/2026

Florian indique avoir testé sur téléphone et valide globalement la version CORPS-01 / CORPS-02 :
« J'ai pu tester. Le résultat est INCROYABLE ! […] Je te laisse continuer sur la suite,
c'est validé pour le moment ».

Cette validation clôture les deux US. Les scénarios ci-dessous sont conservés comme référence
historique ; les cases non cochées ne signifient plus une recette bloquante et ne sont pas
transformées en résultats individuels sans compte rendu détaillé.

APK release : quatre ABI, build réussi, signature v2 vérifiée. 6 196 tests automatiques,
lint et typecheck passent après le correctif Windows. Texte de la checklist d'origine ci-dessous.

---
## 62. CORPS-01 — Carte anatomique et explorateur Mon corps

Spec : [CORPS-01](docs/specs/functional/us/corps01-explorateur.md). Branche `feature/corps01-explorateur`, worktree `.claude/worktrees/mon-corps`. Premier lot local, non intégré à dev dans cette passe. Aperçu du dessin : [clair / sombre / articulations](design/mon-corps-2026-09/anatomy-qa.png).

Lancer le serveur depuis ce worktree (`npm run mobile`) et utiliser le dev build Android du projet. Chemin principal : **Musculation → Suivre → Mon corps**. Il s'agit de l'explorateur de muscles ; la personnalisation de morphologie et l'éditeur d'objectifs sont suivis séparément en §63, branche `feature/corps02-morphologie` qui inclut CORPS-01.

- [ ] 1. Sur un compte sans historique, ouvrir Mon corps depuis Musculation ; le corps est neutre et les dix muscles sont disponibles dans la liste.
- [ ] 2. Inspecter les formes de face et de dos. Sélectionner chacune des dix zones par le dessin et par la liste ; la fiche porte le bon nom, les épaules fonctionnent des deux côtés et les groupes postérieurs basculent au dos.
- [ ] 3. Zoomer au pincement et par les boutons, déplacer avec deux doigts puis avec les quatre flèches. Inspecter épaules et mollets, atteindre les bornes puis recentrer ; aucune zone n'est perdue hors cadre. Le scroll à un doigt et les appuis simples restent utilisables.
- [ ] 4. Changer de vue et de muscle après zoom : la caméra se recentre. Vérifier retour système, retour d'écran et réouverture.
- [ ] 5. Depuis un exercice, une séance de programme et le bilan, ouvrir Explorer les muscles : groupes et couleurs du contexte conservés, même si on sélectionne un muscle différent. Le retour retrouve l'écran appelant.
- [ ] 6. Rechercher des exercices associés, vérifier les favoris et l'indication « Association par groupe ». Ouvrir une fiche sans ajouter d'exercice à une séance en cours. Vérifier français, anglais et repli français du catalogue.
- [ ] 7. Vérifier accès Progression → Mon corps et Mensurations ; vérifier aussi les pastilles articulaires et la sélection symétrique dans le journal sensible, sans changement des niveaux de douleur.
- [ ] 8. Activer thème sombre, grande taille de police et TalkBack : tous les muscles, onglets, contrôles caméra et exercices restent nommés, lisibles et accessibles. L'association générale doit être annoncée pour l'exercice concerné.
- [ ] 9. Passer en mode avion après synchronisation ; dessins et catalogue restent disponibles. Sur un compte au catalogue vide, message explicite ; contrôler fluidité après plusieurs ouvertures / fermetures sur l'appareil cible.

Contrôles automatiques terminés : 6 016 tests, typecheck et lint passent ; export Android Metro/Hermes réussi. Les cases ci-dessus restent à valider sur appareil.

---

## 63. CORPS-02 — Silhouette personnelle et intention visuelle

Spec : [CORPS-02](docs/specs/functional/us/corps02-morphologie.md). Branche `feature/corps02-morphologie`, worktree `.claude/worktrees/mon-corps`, inclut CORPS-01 et le dernier dev utilisé au démarrage du lot. Aperçus issus du code : [éditeur](design/mon-corps-2026-09/morphology-editor-qa.png) et [silhouettes](design/mon-corps-2026-09/morphology-detail.png). Ces planches RN Web/SVG ne remplacent pas la recette native.

Chemin : **Musculation → Suivre → Mon corps → Ma silhouette et mes objectifs**. Lancer `npm run mobile` depuis ce worktree et ouvrir le dev build du projet. Migration cloud appliquée ; aucune nouvelle dépendance native ou sync rule.

- [ ] 1. Compte sans historique : départ équilibré, aucune mensuration inventée, aucun objectif créé automatiquement. Lien vers les mensurations fonctionnel.
- [ ] 2. Face et dos : inspecter les trois bases, sélectionner chaque zone par le dessin et par son nom. Ajuster avec le curseur, les boutons +/− et réinitialiser une zone. Vérifier jonctions et symétrie aux réglages maximaux combinés.
- [ ] 3. Mode Objectif : créer explicitement la copie, ajuster les sept intentions ; le titre « Illustration d’intention » est visible. Les longueurs et la taille abdominale ne sont pas proposées comme objectifs.
- [ ] 4. Modifier le départ après création de l’objectif : l’ancien départ reste la base de la comparaison, le message le précise. Recréer l’objectif demande confirmation si des accents existent ; annuler la confirmation garde les accents.
- [ ] 5. Comparer face/dos : même pose et même échelle, contour en pointillés du départ, silhouette pleine de l’objectif ; bascule départ seul et liste des intentions cohérentes.
- [ ] 6. Annuler restaure la dernière sauvegarde. Retour d’écran et retour système demandent confirmation si le brouillon est modifié. Le lien vers les mensurations puis retour conserve le brouillon.
- [ ] 7. Enregistrer, fermer et rouvrir : départ et objectif conservés. Double appui rapide sans doublon. Aucune invitation à recharger l’ancienne version pendant la notification locale de la sauvegarde.
- [ ] 8. Mode avion : dessins, réglages et sauvegarde restent disponibles. Fermer/rouvrir puis rétablir le réseau et contrôler après resynchronisation, si possible sur un second appareil. Une modification distante arrivée avant la sauvegarde ne doit pas écraser le brouillon silencieusement.
- [ ] 9. Vérifier mensurations datées, poids et réglages personnels avant/après : aucune donnée réelle modifiée. Une erreur de chargement de mesures ne s’affiche pas comme un historique vide.
- [ ] 10. FR/EN, thèmes clair/sombre, petit écran, police agrandie, TalkBack : zones nommées, curseur ajustable, boutons utilisables, footer non masqué, pas de geste obligatoire. Mouvement réduit et haptique désactivée respectés.

Contrôles automatiques : **6 192 tests passent**, typecheck et lint complets, export Android réussi. Les cases restent à valider sur appareil.

Le rendu 3D, la calibration à partir de mesures et le programme généré depuis l’objectif ne font pas partie de cette recette.
