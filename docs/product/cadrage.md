# Journal de cadrage produit

> Document **vivant**, mis à jour après chaque décision validée pendant la phase de conception.
> Il sert de mémoire partagée avant la rédaction des documents formels (PRD MVP, ADR, user stories).
> Voir aussi : [CONTEXTE_PROJET.md](../../CONTEXTE_PROJET.md) (passation initiale).

---

## Légende
- ✅ **Décidé** — validé par le porteur du projet.
- 🔶 **En discussion** — sujet ouvert.
- ⚠️ **Point de vigilance** — risque ou tension à surveiller.

---

## Décisions de cadrage

### D1 — Proposition de valeur cœur ✅
**L'intégration : tout au même endroit, interconnecté.**
La valeur n°1 de l'app est que tous les piliers (fitness, course, nutrition, lifestyle) vivent au même endroit et **se parlent** pour s'analyser et s'optimiser mutuellement. On remplace plusieurs apps silos par un écosystème unique.

### D2 — Principe « Intégration sans imposition » ✅
L'app est **utile même avec un seul module activé** (ex. juste le suivi des séances).
- Chaque module est **autonome et utile seul**.
- L'intégration (analyses croisées, optimisation) est une couche **par-dessus**, **opt-in**, jamais un prérequis.
- Aucun utilisateur n'est forcé de paramétrer la nutrition, le sommeil, les pas ou la gamification.
- ⚠️ **Tension à gérer** : si « tout au même endroit » est la valeur n°1 mais que rien n'est imposé, l'app doit **donner envie** de connecter les modules (via gamification + analyses croisées) sans contraindre.

### D3 — Module phare = Fitness / Musculation ✅
La porte d'entrée du MVP est le **module Fitness / musculation** (hypertrophie, training général).
- **Public visé : large** = pratiquants de musculation au sens commun (pas un positionnement « force / powerlifting »).
- Les pratiquants de force/powerlifting restent **bien servis** s'ils le souhaitent, mais ce n'est pas l'angle de communication.
- Ce module doit être **excellent seul** (puisqu'on n'impose rien) avant de greffer les autres.
- ⚠️ **Point de vigilance concurrentiel** : le créneau « tracker de muscu » est **saturé** (Hevy, Strong, JEFIT, FitNotes…). Notre différenciation **ne peut pas** être « la seule app de muscu » → elle repose sur **l'intégration** + **la gamification**. Objectif : ne pas faire « juste un Hevy de plus ».

### D4 — Persona de conception du MVP ✅
**Cible de conception : le pratiquant assidu, intermédiaire à avancé.**
- On conçoit pour l'**exigeant** : outil de suivi puissant (historique détaillé, volume, records, surcharge progressive).
- Mais l'app reste **accessible au débutant** : un débutant peut l'utiliser, se faire cadrer, « se prendre au jeu » → large public capté **de facto**.
- Formule retenue : *« on conçoit pour l'avancé, on reste utilisable par le débutant »* (et non l'inverse).

### D5 — Périmètre fonctionnel du MVP1 muscu ✅
Le MVP1 du module muscu comprend **l'ensemble** des fonctionnalités suivantes (les « souhaitables » sont intégrés au MVP1, pas repoussés).

**Cœur :**
1. **Compte / auth** (Supabase) — synchro multi-appareils, sauvegarde des données.
2. **Bibliothèque d'exercices** préchargée (mouvements muscu courants) **+ exercices custom**.
3. **Construction de séances / templates** (créer ses routines, les réutiliser).
4. **Logging de séance en live** : séries = poids × reps, **timer de repos**, RPE/RIR en option.
5. **Historique** des séances (consulter, éditer une séance passée).
6. **Progression** : par exercice (records perso auto-détectés, courbe d'évolution, volume) + **mesures corporelles** (poids de corps a minima).

**Inclus aussi dans le MVP1 (ex-« souhaitable ») :**
7. **Surcharge progressive assistée** (suggestion de la prochaine charge).
8. **Notes de séance** + **photos de progression**.
9. **Graphiques avancés** (volume par groupe musculaire, répartition).

**Hors MVP1 (explicitement repoussé) :**
- Autres modules : course/GPS, nutrition, lifestyle (sommeil, stress, pas).
- Couche sociale (feed, follows, kudos).
- Gamification → *statut à trancher (voir sujets ouverts)*.

### D6 — Gamification dans le MVP1 : « graine légère » ✅
On intègre une **graine légère** de gamification au MVP1 (pas la boucle Walkr complète) :
- **Streaks** d'assiduité (jours / semaines).
- **Jalons & badges** simples (premier PR, 10ᵉ séance, etc.).
- **Feedback de progression valorisant**.

Objectif : planter le drapeau de la différenciation (rétention) à **faible coût**, sans embarquer le moteur d'exploration « spatial ».
- La **vraie boucle Walkr** (énergie → exploration → déblocage) reste un **module à part entière, post-MVP1**.
- ⚠️ À surveiller : la graine doit valoriser sans faire « gadget ».

### D7 — Monétisation : freemium généreux + grille en paliers ✅
**Modèle = freemium généreux** (principe « utile seul / sans imposition »).
- Le **tracker muscu de base est gratuit** (logging, historique, templates, progression de base).
- Le **Premium** débloque la **profondeur** et la **future intégration** : graphiques avancés, surcharge progressive assistée, historique illimité, photos illimitées, puis analyses croisées inter-modules.
- On fait payer la *profondeur* et *l'intégration*, **jamais l'accès de base**.

**Grille de prix de référence (valeurs indicatives, ajustables en business) :**
| Palier | Quand | Prix de référence |
|---|---|---|
| **Premium muscu** | MVP1 (seul palier payant au lancement) | **~4,99 €/mois** ou **~29,99 €/an** (push annuel) |
| **Écosystème / Pro** | Quand course + nutrition + analyses croisées arrivent | **~9,99 €/mois** |
| **IA / Coach** | Plans & programmes assistés par IA | **~14,99–19,99 €/mois** (couvre le coût marginal des appels modèles) |

- **Offre « founder »** de lancement recommandée (annuel remisé / early-bird) pour amorcer la base payante.
- 🔧 **Règle d'architecture structurante** : câbler **RevenueCat avec des *entitlements* multi-paliers dès le MVP1**, même si un seul palier payant est lancé → ajouter « Écosystème » puis « IA » plus tard = **config, pas refonte**.

### D8 — Offline-first complet ✅
L'app fonctionne **entièrement sans réseau** (réalité terrain : réseau souvent absent en salle).
- Logging de séance, consultation de l'historique, création de templates : **tout marche hors-ligne**.
- La **synchro Supabase** se fait en arrière-plan dès le retour du réseau.
- 🔧 **Conséquence d'architecture majeure** : cache/persistance locale + couche de synchro (et gestion de conflits) **dès le départ** → ça conditionne le **modèle de données** et l'**ordre de build**. Beaucoup moins cher à concevoir maintenant qu'à rajouter après coup.
- Décision **non-négociable** pour la crédibilité de l'outil auprès du persona assidu.

---

### D9 — Détails fonctionnels du MVP1 ✅
- **Unités** : **kg par défaut**, **lb disponible** en réglage utilisateur.
- **Onboarding** : **minimal** — création de compte puis entrée directe ; la config (objectif, niveau…) est **optionnelle et différable** (cohérent avec « sans imposition »).
- **Langues** : **FR + EN dès le MVP1** → 🔧 **i18n à câbler dès le départ** (peu coûteux si anticipé, pénible si rajouté après).
- **Contenu d'une série** : **poids + reps + RPE optionnel**, avec **types de séries** (normale, échauffement, dropset, échec).

---

### D10 — Moteur de synchro offline = PowerSync (à valider par spike) ✅🟡
Choix du moteur offline-first : **PowerSync** (SQLite local + synchro bidirectionnelle managée avec Supabase, conflits inclus) → neutralise le risque R2.
- **Conditionnel** : figé seulement après un **spike de validation** réussi. Repli prévu : C (Legend-State), puis B (WatermelonDB).
- Détail : [ADR-001](../adr/ADR-001-moteur-sync-offline.md) · Plan : [spike-001-powersync.md](../specs/technical/spike-001-powersync.md).
- 🔧 Conséquence : **dev build Expo obligatoire** dès le départ (Expo Go insuffisant).

---

## Sujets ouverts (à traiter)
- 🔶 Nom du produit (reporté jusqu'au positionnement — non bloquant pour le PRD/build).
