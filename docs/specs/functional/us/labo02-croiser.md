---
id: LABO-02
titre: "Le Labo › Croiser — tous tes liens, à un seul endroit"
roadmap: [7.38]
catalogue: []
etape: recette
branche: feature/labo-carrefour
maj: 30/09/2026
---
# US LABO-02 — L'onglet Croiser

> **Parcours** : chantier « le Labo, carrefour des piliers », livré en une vague le 30/09/2026 sur demande
> explicite de Florian (« GO tu fais TOUT d'une seule vague d'implémentation »), après la toile
> [design/labo-carrefour-2026-09/](../../../../design/labo-carrefour-2026-09/) et ses décisions Q1 à Q8.
> Voir l'en-tête de [LIENS-01](liens01-registre-liens.md). Plan : [labo02-croiser.md](../../../plans/labo02-croiser.md).
> Maquettes de référence : planches `Main` (prototype jouable), `L1Croiser`, `L2Zone`, `L6Feuille`,
> `L7GardeFou`, `L8DeuxPiliers`, `L9Mono`, `L10Neuf`.

## 0. Contexte

LABO-01 avait quatre onglets — Semaine, Composer, Pourquoi ?, Acquis. La Semaine montrait les
propositions de la semaine, mais pas **les liens** : la réponse à « est-ce que je mange assez pour ma
muscu ? » vivait dans Stats nutrition, celle à « est-ce que je récupère ? » dans Insights. Florian veut
**un seul endroit** pour tout voir ; le Labo est cet endroit.

## 1. Ce que l'US livre

Le Labo passe à **trois onglets, trois verbes** (décision **Q1** : « Croiser ») :

| Onglet | Ce qu'on y fait | Remplace |
|---|---|---|
| **Croiser** | voir tous ses liens, rangés par état, et régler ce qui coince | Semaine |
| **Composer** | doser les leviers de tous les piliers ensemble | inchangé (LABO-01) |
| **Apprendre** | comprendre ce qui cale, suivre ses expériences, garder ce qu'on sait de soi | Pourquoi ? + Acquis ([LABO-04](labo04-apprendre.md)) |

Le titre et les onglets vivent **dans** la scène (en-tête et pied de `LabStage`), comme dans les hubs
à onglets. `/lab?section=cross|composer|learn` ouvre l'onglet voulu, même si l'écran est déjà monté ;
une section inconnue retombe sur Croiser.

### Ce que dit Croiser, dans cet ordre

1. **Une phrase** : un garde-fou d'abord (« Un garde-fou demande ton attention »), sinon le nombre de
   liens à régler, sinon « tes liens tiennent ». Un compte neuf lit « Le Labo apprend à te connaître ».
2. **Les pastilles de synthèse** : combien de liens par état (point + mot).
3. **Les liens, rangés par état** — garde-fou, à régler, ça tient, à découvrir — sous forme de cartes
   ([CrossLinkCard](../../../../apps/mobile/src/components/lab/CrossLinkCard.tsx)) :
   - **garde-fou / à régler** : la question, la paire, l'état, le verdict, deux chiffres, le geste ;
   - **ça tient** : une ligne compacte (on le dit aussi : c'est ce qui rend le Labo agréable à ouvrir) ;
   - **à découvrir** : en pointillé, ce qui manque et une jauge (« 2 jours sur 4 »). Les associations
     encore en apprentissage (« Une nuit courte te ralentit-elle ? ») y sont listées aussi, et ouvrent
     Apprendre.
4. **La semaine réelle**, pilier par pilier ([LabWeekOverview](../../../../apps/mobile/src/components/lab/LabWeekOverview.tsx),
   ex-onglet Semaine) : progression et grille des sept jours.
5. **Ce que l'écran n'est pas** : « des liens trouvés dans tes données, pas des preuves ».

Toucher une carte ouvre **la fiche du lien** ([LABO-03](labo03-fiche-lien.md)).

### La carte des disques, vue du dessus (décision Q6)

Sur Croiser (et Apprendre), la scène 3D de LABO-01 passe en **vue du dessus** : chaque **zone** où deux
piliers se croisent (muscu × course, muscu × nutrition, course × nutrition, centre) porte une
**médaille** de l'état le plus pressant de ses liens. Toucher une zone **filtre la liste** (« Muscu ×
Nutrition · 2 liens ») ; « Tout voir » la rend entière. Composer garde la vue **en perspective**.
Le repli 2D existant (sans WebGL) reçoit les mêmes médailles et le même geste.

## 2. Règles

### R1 — Rien ne s'écrit sans la feuille (LABO-01 R4, inchangée)

Un geste qui **écrit** dans le plan (décaler une séance, alléger celle du jour) se met **« prêt »** au
premier appui ; un second appui le retire. « Appliquer (n) » ouvre la feuille **« ce qui change »**, qui
nomme le changement, le pilier et les écrans où il se verra ; **seule sa confirmation écrit**. Un geste
qui **n'écrit rien** (ouvrir un écran) part tout de suite.

### R2 — Un échec d'écriture se voit (leçon CONF-06)

La feuille reste ouverte avec le message ; le geste n'est **pas** marqué appliqué.

### R3 — Un garde-fou n'est jamais masqué ni relégué

Il ouvre la liste, la phrase de tête le dit, et sa zone porte la médaille rouge.

### R4 — Décision H et la ligne des autres piliers (décision Q4)

Un pilier désactivé ne produit **aucun** lien. Avec un ou deux piliers seulement, **une** ligne
discrète dit ce que le Labo croiserait avec d'autres (« Avec la course, le Labo croiserait… ») ; elle
se masque d'une croix et **ne revient pas** (stockage local, `lab-other-pillars-store`). Rien de plus.

### R5 — Le Conseil des trois s'ouvre depuis le lien des objectifs

Le geste du lien `goals` ouvre le Conseil (CONS-01), qui chiffre les deux issues ; le choix s'écrit par
`goal-conflict-resolution.ts`, la même écriture que la carte de l'accueil.

## 3. Offline

Tout est calculé sur l'appareil (`CrossLinksProvider`, une seule fois pour toute l'app) ; les écritures
passent par les repositories existants (`reschedulePlannedSession`, `applyAdaptationForToday`).

## 4. i18n et accessibilité

`lab.tabs.*`, `lab.stage.*`, `lab.cross.*` en FR et EN. Onglets annoncés comme tels avec leur état ;
chaque carte annonce sa question, son état et sa phrase ; les médailles de zone portent un libellé
(« Muscu × Nutrition : à régler, 2 liens ») ; cibles ≥ 44 pt.

## 5. Tests

`app/(tabs)/__tests__/lab-screen.test.tsx` : onglets et `?section=`, rangement par état, carte → fiche,
filtre par zone et « Tout voir », Conseil, ligne des autres piliers (affichée / masquée / absente à
trois piliers), R4 (prêt sans écrire, feuille, jour en toutes lettres, déplacement, allègement, geste
qui navigue, retrait, échec visible), Composer, Apprendre. `scene-state.test.ts` et
`lab-stage.test.tsx` : vue du dessus, médailles, sélection d'une zone.

## 6. Écarts assumés et ce qui n'est pas fait

- La **scène n'a pas été essayée sur téléphone** dans cette session : la vue du dessus et le toucher
  des médailles sont à recetter (RECETTES §89).
- Les **médailles** sont posées sur des positions fixes des zones ; elles ne suivent pas le zoom.
- Le **thème sombre**, les **grandes polices** et **TalkBack** n'étaient pas maquettés : à recetter.

## 7. Revue de code du 30/09/2026

- 🔴 **« Prêt » et « Dans ton plan » sont mémorisés par proposition**, plus par lien : un lien garde
  son identifiant, alors qu'il peut porter une seconde collision une fois la première réglée — le second
  geste restait « Dans ton plan », désactivé, jusqu'au redémarrage. Régression figée par un test.
- Les échecs du **Conseil des trois** se voient (alerte « Impossible d'appliquer ») au lieu d'être avalés.
- « Tout voir » passe à 44 pt ; en repli 2D, **toucher le vide** efface de nouveau la zone choisie (le
  dessin ne capte plus le toucher).
- Voir aussi [LIENS-01 §8](liens01-registre-liens.md) (gardes d'écriture, propositions entières).
