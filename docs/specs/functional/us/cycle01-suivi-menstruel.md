---
id: CYCLE-01
titre: "Suivi du cycle menstruel — journal, prédiction et croisement"
roadmap: [1.25, 1.26]
catalogue: []
etape: recette
branche: feature/cycle01-suivi-menstruel
maj: 01/08/2026
reste: "Code complet. **Deux bloquants levés en recette device du 01/08/2026** : (a) le suivi était impossible à activer — les colonnes cycle_tracking_enabled / cycle_health_connect_enabled manquaient au schéma PowerSync local, l'écriture échouait et l'erreur était avalée ; (b) les routes wellness://cycle et /cycle/insights s'ouvraient suivi éteint (critère 1), désormais fermées par CycleTrackingGuard. Le manifest embarque bien READ/WRITE_MENSTRUATION après un prebuild --clean (le dossier android/ local était antérieur à l'US). Vérifiés sur device : opt-in, saisie, calendrier, R8, R13, R16 bis, R17, R20, widget d'accueil. Reste hors code : recette device complète (RECETTES.md #15 — dont Health Connect de bout en bout, non testé faute de validation des permissions système), relecture juridique de la politique de confidentialité, et dépôt de la déclaration Play Health apps à 6 types."
---

# US CYCLE-01 — Suivi du cycle menstruel

> **Quatre arbitrages posés par Damien le 30/07/2026**, tous en option maximale :
> périmètre **journal + prédiction + croisement** · **tout part en V1** (l'impact confidentialité est
> assumé) · **Health Connect dès maintenant** · **opt-in pour tous, sans filtre sur le sexe**.
>
> ⚠️ **Conséquence chiffrée, actée et non bloquante** : le chemin critique du lancement passe
> d'environ **3 à 5 semaines**. La relecture juridique s'élargit à une catégorie de données sensible,
> et une **nouvelle déclaration Health Connect** (~7 j d'instruction + 5-7 j ouvrés de propagation)
> s'ajoute **en série** à celle des 4 permissions actuelles.

## 0. Ce que cette US n'est pas

**Ce n'est pas un moyen de contraception, ni un outil de conception, ni un dispositif médical.**
Cette phrase n'est pas une précaution de style : elle détermine le ton de **chaque** écran, le
libellé de la prédiction, et ce que le croisement a le droit d'affirmer. Toute formulation qui
laisserait croire à une fiabilité médicale est un **défaut bloquant** en recette (critère 14).

Wellness est un carnet. Il enregistre ce que l'utilisatrice saisit et lui montre ce qu'il observe —
il ne conseille pas, ne diagnostique pas, n'alerte pas sur la santé.

## 1. Périmètre

**A. Journal** — saisir les périodes de règles (début, fin), l'intensité du flux par jour, et des
symptômes optionnels. Calendrier + historique.
**B. Prédiction** — estimer le début du prochain cycle à partir de l'historique.
**C. Croisement** — mettre en regard la phase du cycle et les données déjà collectées par l'app :
énergie / humeur / stress (`daily_wellbeing`), performance (tonnage muscu, allure course), apport
calorique.
**D. Health Connect** — lecture **et** écriture des types `MenstruationPeriod` et `MenstruationFlow`.

**Hors périmètre** : température basale, glaire cervicale, tests d'ovulation, suivi de grossesse,
rappels de contraception. Tous relèvent d'un usage médical ou de conception — écartés par §0.

## 2. Modèle de données

Deux tables, **calquées sur la façon dont Health Connect modélise le sujet** — ce qui rend la
synchronisation D quasi directe au lieu d'exiger une traduction.

### `menstrual_periods` — une ligne par période
| Colonne | Type | Note |
|---|---|---|
| `id` | uuid | généré **côté client** (offline-first) |
| `user_id` | uuid | |
| `started_on` | date | AAAA-MM-JJ, local |
| `ended_on` | date **nullable** | `null` = période **en cours** |
| `source` | text | `manual` \| `health_connect` |
| `created_at`/`updated_at`/`deleted_at` | timestamptz | soft delete |

### `menstrual_daily_logs` — une ligne par jour saisi
| Colonne | Type | Note |
|---|---|---|
| `id` | uuid | client |
| `user_id` | uuid | |
| `log_date` | date | **unique par (user_id, log_date)** hors supprimés |
| `flow` | text nullable | `spotting` \| `light` \| `medium` \| `heavy` |
| `symptoms` | jsonb | tableau de codes, **liste fermée** (§3, R7) |
| `created_at`/`updated_at`/`deleted_at` | timestamptz | |

**R1 — Les deux tables sont indépendantes.** Un jour de flux peut exister sans période déclarée
(saisie au fil de l'eau), et une période peut n'avoir aucun log quotidien. Les lier par une clé
étrangère obligerait à un ordre de saisie que personne ne respecte.

## 3. Règles

**R2 — Une seule période en cours à la fois.** Déclarer un nouveau début alors qu'une période a
`ended_on = null` **clôt automatiquement la précédente** la veille du nouveau début. Sans cette
règle, un oubli de « fin » corrompt tout l'historique et donc toute prédiction.

**R3 — Une période ne peut pas durer plus de 15 jours.** Au-delà, elle est **automatiquement close**
à J+15 et signalée comme « à vérifier ». Ce n'est pas un jugement médical : c'est une borne qui
empêche un oubli de saisie de fausser la moyenne des cycles.

**R4 — La saisie rétroactive est autorisée sans limite.** On note souvent après coup. Aucune fenêtre
glissante, aucune date bloquée dans le passé. Le **futur**, en revanche, est refusé : on ne saisit
pas des règles qui n'ont pas eu lieu.

**R5 — Longueur de cycle = intervalle entre deux `started_on` consécutifs.** Pas entre une fin et un
début. C'est la définition usuelle, et c'est celle qui rend la prédiction interprétable.

**R6 — Les cycles aberrants sont exclus du calcul, pas effacés.** Un intervalle < 15 j ou > 90 j est
ignoré pour la moyenne (saisie erronée, aménorrhée, post-partum…) mais **reste visible dans
l'historique**. L'app ne réécrit jamais ce que l'utilisatrice a saisi.

**R7 — Les symptômes sont une liste fermée et courte** : crampes, maux de tête, fatigue, ballonnement,
sensibilité mammaire, sautes d'humeur, acné, fringales. **Pas de champ libre** — un texte libre dans
une donnée de santé sensible est un risque disproportionné pour un gain nul (et il ne serait ni
traduisible, ni exploitable en croisement).

### Prédiction (B)

**R8 — Aucune prédiction avant 3 cycles complets.** Avec deux `started_on` on n'a qu'un intervalle,
donc aucune idée de la régularité. En dessous du seuil, l'écran affiche « encore N cycles avant une
estimation » — **jamais** une estimation faible présentée comme une vraie.

**R9 — La prédiction affiche toujours sa dispersion.** « Prochain cycle vers le 12 août, ± 3 jours »,
l'écart-type venant des cycles retenus. Une date seule serait une promesse ; une fourchette est une
observation.

**R10 — Si l'écart-type dépasse 7 jours, on n'affiche pas de date.** On dit « tes cycles varient
beaucoup, l'estimation ne serait pas fiable ». Afficher une date sur des données très dispersées est
pire que ne rien afficher.

**R11 — Ton strictement neutre, jamais d'alerte.** Un retard n'est **pas** signalé, aucune
notification n'est envoyée sur un retard. C'est le point où une app de carnet devient un outil
anxiogène ou, pire, un substitut de test. **Aucune notification dans cette US** — ni rappel, ni
prédiction poussée.

### Croisement (C)

**R12 — Quatre phases, dérivées et jamais saisies** : menstruelle (J1 → fin de période),
folliculaire, ovulatoire (fenêtre estimée), lutéale. Calculées depuis `started_on` et la longueur
moyenne. Elles sont un **repère de lecture**, pas un diagnostic.

**R13 — Aucun croisement avant 3 cycles complets ET 10 jours de données croisées par phase.**
En dessous, l'onglet dit ce qui manque. Sortir une corrélation sur 4 points serait du bruit présenté
comme un insight — exactement ce que l'[ADR-007](../../../adr/) reproche aux analyses prématurées.

**R14 — On montre des moyennes observées, jamais une causalité.** « En phase lutéale, ton énergie
déclarée est en moyenne de 2,8/5 contre 3,6 en phase folliculaire » — c'est un constat. **Interdit** :
« ta baisse d'énergie est due à ta phase lutéale », ou tout conseil d'entraînement dérivé.

**R15 — Le croisement ne consomme que des données déjà présentes.** `daily_wellbeing`, `workouts`,
`runs`, `food_entries`. **Aucune nouvelle collecte** au titre du croisement.

### Confidentialité (transverse)

**R16 — Opt-in strict, désactivé par défaut.** Réglage `cycleTrackingEnabled`, **accessible à tous**
sans filtre sur `sex` (arbitrage Damien). Tant qu'il est désactivé : aucun widget, aucune route
atteignable, **aucune ligne écrite**.

**R16 bis — 🔴 PAS d'onglet de navigation. Un widget complet, sur les 3 formes.**
*(Arbitrage Damien du 31/07/2026, contre ce que propose la maquette Claude Design.)*

La maquette livrée place « Cycle » en **5ᵉ onglet** de la barre du bas. **C'est écarté**, pour deux
raisons :
- **Cohérence avec le précédent BIEN-01.** Le check-in de bien-être a été explicitement traité comme
  une « **4ᵉ dimension légère, pas un 4ᵉ pilier** » : aucun onglet, un widget transverse. Le cycle est
  de la même famille — en faire un onglet le hisserait au-dessus du bien-être sans justification.
- **La barre du bas varie déjà de 2 à 5 entrées** selon les piliers activés (décision H). Un 6ᵉ
  emplacement possible la rendrait ingérable sur petit écran.

**À la place** : un widget `cycle` sur le hub **Accueil**, décliné sur les **3 formes**
(`small` / `wide` / `large`, cf. `WidgetSize`), plus un écran de détail atteignable **en appuyant sur
le widget** — le patron déjà employé par `steps` (PAS-01) et `wellbeing` (BIEN-01).

Contenu attendu par forme :
| Forme | Contenu |
|---|---|
| `small` | jour du cycle (« J26 ») + phase |
| `wide` | + prochaine estimation avec sa fourchette, ou l'état « pas assez de données » |
| `large` | + mini-calendrier de la période en cours et accès direct à la saisie du jour |

⚠️ **R16 ter — le widget introduit une troisième dimension de filtrage, et il ne faut pas la
bricoler.** Le registre ne connaît aujourd'hui que deux cas : une liste de piliers, ou le sentinelle
`'always'` ([widgets.ts](../../../../packages/shared/src/widgets.ts)). Le cycle n'est **ni l'un ni
l'autre** : il n'appartient à aucun pilier (donc pas de liste) **mais** ne doit pas s'afficher pour
tout le monde (donc pas `'always'`) — il dépend d'un **réglage**. C'est exactement la dette relevée
par **REFACTO-01** (~12 copies en ligne de la décision d'accès). **Ne pas ajouter une 13ᵉ copie** :
étendre proprement le registre à un garde par réglage, ou traiter REFACTO-01 d'abord.

**R17 — La désactivation propose la suppression des données.** Désactiver ≠ effacer : on demande
explicitement, et le choix « garder » conserve les lignes sans les afficher.

**R18 — Inclus dans l'export RGPD et la suppression de compte.** Les deux tables rejoignent
`EXPORT_TABLES` ([data-export.ts](../../../../apps/mobile/src/lib/data-export.ts), 28 tables → 30).
**À ne pas oublier** : une donnée sensible absente de l'export est un manquement RGPD.

**R19 — Jamais sur une carte partageable.** PARTAGE-01 exclut déjà les données de santé ; cette US
étend explicitement l'interdiction. Aucune mention du cycle sur une image qui sort de l'app.

## 4. Health Connect (D)

Deux permissions nouvelles, portant sur des types dédiés :

| Permission | Sens | Justification à déposer |
|---|---|---|
| `android.permission.health.READ_MENSTRUATION` | lecture | « L'utilisatrice suit son cycle dans une autre application ; la lecture évite une double saisie et alimente son journal dans Wellness. » |
| `android.permission.health.WRITE_MENSTRUATION` | écriture | « Les périodes saisies dans Wellness sont écrites dans le hub santé pour être retrouvées depuis les autres applications de santé de son choix. » |

**R20 — La synchronisation Health Connect suit le même opt-in que le reste** (R16) **et l'opt-in
Health Connect existant.** Deux interrupteurs, tous deux nécessaires. Aucune écriture silencieuse.

**R21 — En cas de conflit, la saisie manuelle gagne.** Une période saisie dans Wellness n'est jamais
écrasée par un import. Le champ `source` permet de les distinguer et de dédupliquer sur `started_on`.

⚠️ **Conséquences Play à traiter avec cette US**, pas après :
- Nouvelle **déclaration « Health apps »** portant désormais **6 types** — voir
  [health-connect-play-declaration.md](../../technical/health-connect-play-declaration.md).
- Le formulaire **« Sécurité des données »** doit déclarer une donnée de santé **sensible**
  collectée **et transmise hors de l'appareil** (elle est synchronisée sur le compte).
- La **politique de confidentialité** de
  [LANCE-00](../../technical/lance00-fiche-play-et-confidentialite.md) gagne un paragraphe dédié.

## 5. i18n

FR + EN intégral. Familles de clés : `cycle.log.*`, `cycle.flow.*` (4), `cycle.symptoms.*` (8),
`cycle.phase.*` (4), `cycle.prediction.*`, `cycle.insights.*`, `cycle.settings.*`, `cycle.disclaimer`.

⚠️ Deux pièges :
- Les phrases de prédiction et de croisement portent des **variables** (`{{date}}`, `{{days}}`,
  `{{value}}`) — jamais de concaténation, l'ordre des mots diffère.
- Le vocabulaire médical n'est **pas** traduisible mot à mot (« spotting » est usuel en FR ;
  « ballonnement » n'est pas « bloating » dans tous les registres). À faire relire par un humain.

## 6. Comportement offline

**Total, sans exception.** Les deux tables sont locales PowerSync, les calculs (longueur moyenne,
écart-type, phase, moyennes par phase) sont **purs** et tournent sur les données locales. Aucun
réseau requis pour saisir, prédire ou croiser.

⚠️ **Sync rules PowerSync à redéployer** après la migration — les deux tables doivent y être ajoutées
([powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml)). **Étape manuelle, déjà
oubliée une fois sur ce projet.**

## 7. Critères de recette

- [ ] 1. Réglage **désactivé par défaut** : aucun widget, aucune route atteignable, aucune trace.
- [ ] 1 bis. **La barre du bas n'a PAS gagné d'onglet** (R16 bis) — c'est le point où la maquette
      diverge de la décision produit.
- [ ] 1 ter. Widget `cycle` disponible dans les **3 formes**, et le réagencement du dashboard le
      traite comme les autres.
- [ ] 2. Activation → saisir un début de règles → il apparaît au calendrier.
- [ ] 3. Saisir un **nouveau début** sans avoir clos le précédent → l'ancien se clôt tout seul (R2).
- [ ] 4. Période laissée ouverte **16 jours** → close automatiquement et signalée (R3).
- [ ] 5. Saisie **rétroactive** d'un cycle d'il y a 3 mois : acceptée (R4). Date **future** : refusée.
- [ ] 6. Avec **2 cycles** : aucune prédiction, message « encore 1 cycle » (R8).
- [ ] 7. Avec **3 cycles réguliers** : date estimée **avec sa fourchette ±** (R9).
- [ ] 8. Avec 3 cycles **très irréguliers** (écart-type > 7 j) : **pas de date**, explication (R10).
- [ ] 9. Un cycle de 120 jours dans l'historique : **exclu** de la moyenne, **toujours visible** (R6).
- [ ] 10. Onglet croisement avec peu de données : dit ce qui manque, n'invente rien (R13).
- [ ] 11. Croisement nourri : moyennes par phase affichées **sans une seule formule causale** (R14).
- [ ] 12. **Export RGPD** : les deux tables sont dans le JSON exporté (R18).
- [ ] 13. Désactiver le suivi → la suppression des données est **proposée** explicitement (R17).
- [ ] 14. 🔴 **Le critère qui prime sur tous les autres** : relire chaque écran et chaque chaîne, FR
      et EN, en cherchant tout ce qui pourrait se lire comme un **conseil médical, une garantie de
      fiabilité ou une aide à la contraception**. Une seule formulation ambiguë = **rejet**.
- [ ] 15. **Mode avion** : saisie, prédiction et croisement fonctionnent intégralement.
- [ ] 16. **Health Connect** : une période saisie dans Wellness apparaît dans le hub ; une période
      venue du hub apparaît dans Wellness ; une saisie manuelle **n'est pas écrasée** par un import (R21).
- [ ] 17. Health Connect **refusé** ou indisponible : le journal fonctionne normalement, sans erreur.
- [ ] 18. **Aucune notification** n'est jamais émise par cette fonctionnalité (R11).
- [ ] 19. Carte partageable d'une séance : **aucune** mention du cycle (R19).
- [ ] 20. En **EN** : phases, flux, symptômes et avertissement sont en anglais **relu**, pas traduits mot à mot.

## 8. Ce qui reste à faire hors code

- **Relecture juridique** du paragraphe cycle de la politique de confidentialité — au même moment que
  le reste des textes, pour n'avoir qu'un aller-retour.
- **Dépôt de la déclaration Health apps** étendue à 6 types.
- **Relecture humaine du vocabulaire médical** FR/EN (§5).
