---
id: PARTAGE-01
titre: "Carte de séance / course partageable"
roadmap: [7.17]
catalogue: [META-41]
etape: recette
branche: feature/partage01-carte-partageable
maj: 29/07/2026
---

# US PARTAGE-01 — Carte de séance / course partageable

> **4 décisions produit arbitrées par Florian le 29/07/2026** avant tout code, **+ 3 dérivées**
> tranchées par moi et signalées comme telles. Roadmap **7.17** (P2, ~4 h estimées — **l'estimation
> est dépassée**, voir §0.2). Fait descendre **META-41** du
> [catalogue](../../../product/analyses-donnees.md).
>
> **Vérifié avant d'écrire** : rien n'existe côté carte partageable. En revanche le **patron de
> partage est rodé** (`expo-sharing` utilisé par l'export RGPD et l'export GPX), `react-native-svg`
> est présent, et tous les chiffres nécessaires sont déjà calculés.
>
> **Partage sortant statique, zéro backend.** Le feed social reste V2 et au-delà.

## 0. Les deux points durs, dont un qui touche le calendrier

### 0.1 Il ne faut PAS capturer la carte MapLibre

L'écran de résumé affiche le tracé via [`RouteMap`](../../../../apps/mobile/src/components/running/RouteMap.tsx),
qui repose sur **MapLibre natif**. Capturer une vue native de carte avec `captureRef` donne en
pratique une image **noire ou vide** — c'est un piège connu de la capture programmatique.

Le tracé de la carte partageable est donc **reprojeté en polyligne SVG** à partir des points GPS.
Ce détour a deux bénéfices qui n'étaient pas l'intention de départ :

- la carte fonctionne **sans clé MapTiler** (l'écran de résumé, lui, affiche un bloc neutre sans clé) ;
- elle fonctionne **hors ligne**, puisqu'aucune tuile n'est téléchargée.

### 0.2 Une dépendance native, donc un second build

`react-native-view-shot` (**5.1.0**, version alignée SDK 57, vérifiée par `expo install --check`) est
la seule façon de transformer une vue en PNG. C'est une **dépendance native** : le dev client **et**
l'APK doivent être reconstruits.

> ⚠️ **Conséquence de calendrier, à connaître avant de planifier la recette** : PARTAGE-01 **ne peut
> pas être recettée sur l'APK des 9 autres US**. Il faudra un **second build**. C'est le coût caché
> de cette US, et il n'apparaissait pas dans l'estimation de 4 h.

Le périmètre « les deux cartes dès le départ » (D1, choix de Florian **contre ma recommandation** de
commencer par la course) ajoute une seconde mise en page à concevoir et tester. **L'estimation de 4 h
est dépassée** ; c'est un arbitrage assumé, pas un dérapage.

## 1. Décisions arbitrées

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| **D1** | Périmètre | **Les deux cartes dès le départ** : course (tracé + stats) et muscu (tonnage, exercices, records) | Choix de Florian. Couverture complète au lancement — au prix de deux mises en page. *J'avais recommandé « course d'abord » : le tracé est le contenu réellement partageable, une liste de chiffres l'est moins. Arbitrage assumé* |
| **D2** | Marque sur l'image | **Discrète en pied de carte** : nom de l'app en petit, dans la charte | Sans aucune marque, l'US perd sa seule raison d'être en P1 (l'acquisition) ; trop visible, l'image ressemble à une publicité et personne ne l'envoie. Le pied de carte est le compromis qui préserve les deux |
| **D3** | Format | **Carré 1080 × 1080** | Un seul rendu qui passe partout : feed Instagram, WhatsApp, Discord, et acceptable en story. Le meilleur rapport couverture / travail pour un premier lot |
| **D4** | Parcours | **Aperçu, puis bouton Partager** | On voit ce qu'on envoie **avant** de l'envoyer. Indispensable pour une image qui part sur un réseau public : un tracé illisible ou un chiffre tronqué ne doit pas se découvrir après publication |
| **D5** | Rendu du tracé | *Dérivée.* **SVG reprojeté**, jamais une capture de MapLibre | Voir §0.1. Une capture de vue native donne une image noire. Bénéfice collatéral : fonctionne sans clé de carte et hors ligne |
| **D6** | Échelle du tracé | *Dérivée.* **Échelle uniforme + correction de latitude** | Un parcours de 2 km sur 100 m étiré pour remplir le carré devient un gribouillis illisible — et faux. La correction `cos(latitude)` évite en plus que tous les tracés paraissent étirés horizontalement. **Deux tests le verrouillent** |
| **D7** | Aucune donnée sensible | *Dérivée.* La carte ne porte **ni poids, ni mensuration, ni indicateur de bien-être** | Ce sont des données de santé. Une image partie sur un réseau public ne se rattrape pas. Seules figurent des données d'activité (distance, durée, allure, tonnage, records) |

## 2. Périmètre

**Dans le périmètre** : brique pure de projection **testée**, carte de course (tracé SVG + distance,
durée, allure), carte de séance (tonnage, exercices, séries, records), aperçu avant partage, capture
PNG 1080², feuille de partage OS, i18n FR + EN.

**Hors périmètre, explicitement**

- **Tout aspect social entrant** : feed, likes, commentaires, comparaison → V2 et au-delà.
- **Le format vertical 1080 × 1920** (stories dédiées) → si la carte prend, ce sera un ajout trivial :
  le rendu est déjà paramétré par la taille.
- **La personnalisation** (choix des chiffres, thème de la carte, photo de fond) → post-V1.
- **Le « wrapped » annuel** et le **rapport PDF** (META-32, TRI-14) → post-V1, autres US.
- **Les données de santé** sur l'image (D7).
- **iOS** : rien ne s'y oppose techniquement, mais la recette porte sur Android (décision E).

## 3. Comportement

- Depuis le **résumé de course** et le **résumé de séance**, une action « Partager » ouvre un
  **aperçu** de la carte, à l'échelle de l'écran.
- Un second appui génère le PNG **1080 × 1080** et ouvre la **feuille de partage OS**.
- **Carte de course** : tracé au centre, distance / durée / allure en bas, date, nom de l'app en pied.
  Si le tracé n'est **pas dessinable** (moins de 2 points, ou tous les points confondus — GPS bloqué),
  la carte s'affiche **sans tracé**, chiffres seuls. Afficher un artefact d'un pixel serait pire.
- **Carte de séance** : nombre d'exercices, séries, tonnage, durée, et **records battus** s'il y en a.
- Les unités suivent le réglage de l'utilisateur (métrique / impérial).
- Échec de génération ou partage indisponible → message explicite, **jamais un échec silencieux**
  (même contrat que l'export GPX et l'export RGPD).

## 4. Modèle de données

**Aucune migration, aucune table, aucune sync rule.** La carte est une **vue** de données existantes ;
l'image est écrite dans le **cache** puis remise à l'OS. Rien n'est persisté, rien n'est synchronisé.

## 5. Règles de calcul

Dans une brique **pure et testée** (`share-card.ts`) :

- **`projectTrack`** : projette les points dans la boîte, avec **échelle uniforme** (le tracé n'est
  jamais déformé), **correction `cos(latitude)`** et **axe Y inversé** (la latitude monte vers le
  nord, `y` descend en SVG). Cas dégénérés : tracé vide → `[]` ; point unique ou points confondus →
  **centre de la boîte**, jamais un `NaN` qui casserait le rendu.
- **`sampleTrack`** : borne le tracé à 400 points en **conservant le premier et le dernier**. On ne
  réutilise pas `simplifyTrack` (Douglas-Peucker) : son critère est une tolérance **en mètres**, donc
  il ne garantit **aucune borne** sur la taille du `path` SVG.
- **`trackPath`** : `d` du `<Path>`, arrondi au dixième — 15 décimales sur 400 points ne servent à rien.
- **`isDrawableTrack`** : faux si moins de 2 points ou si tous sont confondus.
- **`shareCardFileName`** : nom horodaté, sans espace ni accent (compatibilité OS).

## 6. i18n (FR + EN)

Namespace `share` : titre de l'aperçu, libellés des chiffres de chaque carte, bouton de partage,
messages d'erreur (génération échouée, partage indisponible). Aucune chaîne en dur.

⚠️ **Les libellés imprimés sur l'image sont traduits** : une carte partagée par un utilisateur
anglophone ne doit pas porter « Distance » en français.

## 7. Accessibilité

L'**aperçu** est une image : il porte un `accessibilityLabel` qui énonce **son contenu chiffré**
(« Course du 29/07/2026, 12,4 km en 1 h 02 »), sinon la carte est muette pour TalkBack. Le bouton de
partage est une cible ≥ 48 dp. L'image elle-même n'a pas d'exigence de contraste WCAG (ce n'est pas
une interface), mais les chiffres restent lisibles sur le fond de la charte.

## 8. Offline

**Tout est local** : projection en SVG, capture, écriture en cache, feuille de partage OS. Aucune
requête réseau — c'est un bénéfice direct de D5 (l'écran de résumé, lui, a besoin d'une clé de carte
et du réseau pour les tuiles).

## 9. Cas limites

| Situation | Comportement |
|---|---|
| Course sans GPS (saisie manuelle) | Carte **sans tracé**, chiffres seuls. |
| Moins de 2 points valides | Idem : carte sans tracé. |
| Tous les points confondus (GPS bloqué) | Idem — et **aucun `NaN`** dans la projection (testé). |
| Tracé de 5 000 points | Échantillonné à 400, premier et dernier conservés. |
| Parcours très allongé (2 km × 100 m) | **Non déformé** : échelle uniforme (testé). |
| Séance sans record | La section records est **absente**, pas vide. |
| Réglage impérial | Miles et livres sur l'image. |
| Partage indisponible sur l'appareil | Message explicite, aucun crash. |
| Génération échouée | Message explicite, aucun crash. |
| Hors-ligne | Fonctionne à l'identique. |

## 10. Definition of Done

- [x] Brique `share-card.ts` **pure et testée** (projection, échantillonnage, cas dégénérés).
- [x] Carte de course (tracé SVG) + carte de séance (7 tests de contrat).
- [x] Aperçu avant partage, capture PNG 1080², feuille de partage OS.
- [x] Branchement dans les **2** écrans de résumé.
- [x] i18n FR + EN, **libellés de l'image traduits** compris.
- [x] `react-native-view-shot` aligné SDK 57 (`expo install --check`).
- [x] **Aucune migration, aucune sync rule** — vérifié.
- [x] `npm run lint` (0 erreur), `npm run typecheck` (0 erreur), `npm run test` (**1260**) verts.
- [x] Roadmap 7.17 → 🟡 (recette device à faire, **sur un second APK**).

## 11. Critères d'acceptation (recette device — ⚠️ nécessite un NOUVEAU build)

1. Depuis le résumé d'une course GPS : « Partager » ouvre un aperçu **avec le tracé**.
2. Le tracé de l'aperçu **ressemble** au parcours réel (comparer à la carte de l'écran de résumé) —
   ni miroir, ni écrasé, ni étiré.
3. Un second appui ouvre la feuille de partage, et l'image envoyée est **carrée et lisible**.
4. Sur une course **sans GPS** (distance saisie à la main) : carte sans tracé, chiffres présents.
5. Depuis le résumé d'une séance muscu : carte avec exercices, séries, tonnage.
6. Une séance **avec record** affiche le record ; une séance sans record n'affiche **pas** de section vide.
7. En réglage **impérial** : miles / livres sur l'image.
8. Le nom de l'app est visible **sans dominer** l'image (D2).
9. **Aucune donnée de santé** sur la carte : ni poids, ni mensuration, ni bien-être (D7).
10. En **EN** : les libellés imprimés **sur l'image** sont en anglais.
11. Mode avion : génération et partage fonctionnent (le tracé ne dépend d'aucune tuile).
12. TalkBack annonce le contenu chiffré de l'aperçu.
