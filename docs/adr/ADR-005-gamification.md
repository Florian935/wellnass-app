# ADR-005 — Gamification

- **Statut** : ✅ **Accepté**
- **Date** : 04/07/2026
- **Décideurs** : les 2 devs (Florian + Damien).
- **Lié à** : décision de cadrage [C — Gamification](../../SYNTHESE-CADRAGE.md) · [ADR-001](./ADR-001-moteur-sync-offline.md).

---

## Contexte

La vision produit long terme inclut une **boucle de gamification** (mécanique de type *Walkr* : l'activité alimente une progression ludique — « énergie → exploration »). Les cadrages divergeaient sur son introduction :

- **Position Flo** : une **graine légère** de gamification dès le premier livrable (streaks, badges simples, feedback de progression).
- **Position Dams** : gamification repoussée en **V3/V4**.

Il fallait distinguer ce qui relève de la **motivation** (peu coûteux, à forte valeur immédiate) de ce qui relève du **jeu** (mécanique complète, coûteuse, à valeur incertaine tant que la rétention de base n'est pas prouvée).

## Options envisagées

### A — Graine de gamification dès la V1
- **+** Effet d'engagement plus tôt.
- **−** Une mécanique de jeu à moitié faite engage un modèle de données et une UX (badges, énergie, exploration) qu'il faudra maintenir et faire évoluer, avant même de savoir si la rétention de base tient. Distrait de l'excellence des piliers.

### B — Gamification retirée de la V1, réévaluée en V3/V4 ; streak + records + notifs conservés *(retenu)*
- **+** Concentre la V1 sur la valeur des piliers. On garde les leviers de motivation **utiles et peu coûteux** (streak, records, célébration). La décision d'investir dans le jeu sera **pilotée par les métriques de rétention** réelles.
- **−** Pas d'effet « jeu » au lancement (assumé).

## Décision

**Option B.** La **gamification** (mini-jeu / boucle type *Walkr*, « énergie → exploration ») est **retirée de la V1** et **réévaluée en V3/V4** selon les métriques de rétention. On **conserve** en V1 les leviers de **motivation** : **streak de régularité**, **records personnels**, **notifications de célébration** (classés motivation, pas jeu).

## Conséquences

- **Aucune table ni écran de jeu en V1** (pas de badges de jeu, pas d'énergie, pas d'exploration). Périmètre allégé.
- **Streak et records restent dans la roadmap** : records dès la V0.2/V0.3 (muscu) et V0.5 (running) ; streak transverse en V0.6 (nécessite les 3 piliers) ; notifications de célébration (nouveau record) en V0.3.
- **Architecture compatible** avec un ajout ultérieur : l'**historique horodaté de toutes les activités** (séances, courses, journées nutrition) constitue de fait un **journal d'événements** sur lequel une future couche de jeu pourra se brancher, sans refonte du modèle de données. Ce journal est un sous-produit naturel de l'offline-first (voir [ADR-001](./ADR-001-moteur-sync-offline.md)).
- La décision d'activer (ou non) la gamification en V3/V4 sera **conditionnée aux données** de rétention collectées après le lancement.
