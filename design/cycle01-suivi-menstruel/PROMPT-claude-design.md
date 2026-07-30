# Prompt Claude Design — CYCLE-01

> À copier-coller tel quel dans Claude Design. Autoportant : ne suppose aucune connaissance du dépôt.
> Source de vérité fonctionnelle : [la spec](../../docs/specs/functional/us/cycle01-suivi-menstruel.md).

---

Conçois les écrans d'une fonctionnalité de **suivi du cycle menstruel** pour **Wellness**, une
application mobile Android (React Native) de bien-être qui réunit trois piliers : musculation, course
et nutrition. Format **portrait**, interface en **français**.

## Ton — la contrainte qui prime sur toutes les autres

Wellness est un **carnet**, pas un outil médical. La fonctionnalité n'est **ni un moyen de
contraception, ni un outil de conception, ni un dispositif médical**. Cette contrainte détermine
chaque libellé et chaque écran :

- On affiche des **observations**, jamais des conseils, jamais des causalités, jamais d'alertes santé.
- ✅ « En phase lutéale, ton énergie déclarée est en moyenne de 2,8/5, contre 3,6 en phase folliculaire. »
- ❌ « Ta baisse d'énergie est **due** à ta phase lutéale. »
- ❌ « **Évite** les séances lourdes en phase menstruelle. »
- ❌ « Ton cycle est **irrégulier**, consulte un médecin. »
- Registre : sobre, factuel, adulte. **Ni euphémisme fleuri, ni ton clinique froid.** Pas de rose
  layette, pas de fleurs, pas d'icônes mignonnes — l'app a une identité chaude et sportive, ce
  module doit s'y fondre sans changer de registre.

## Design system — à respecter strictement

**Palette (thème clair)**
`background #f7eede` · `surface #fffaf2` · `surfaceAlt #f3ddd0` · `border #ece0cd` ·
`borderStrong #90897d` (limite de champ) · `text #33291f` · `textMuted #786a59` ·
`accent #b14f2b` (terracotta) · `success #66714b` · `danger #b23b2e` · `amber #b47f31` ·
fond d'alerte `#f7ead6` / bordure `#e9cfa0` / texte `#8a6419`

**Palette (thème sombre)**
`background #1c150e` · `surface #30271e` · `surfaceAlt #3a2e22` · `borderStrong #797169` ·
`text #f4ecdd` · `textMuted #c9b79a` · `accent #dd6e40` · `success #a9ba7e` · `amber #e0b155`

**Les deux thèmes sont obligatoires.** Aucune couleur hors palette, sauf pour distinguer les
4 phases du cycle (voir plus bas) — et même là, rester dans la famille chaude.

**Typographie**
- Titres et gros chiffres : **Bricolage Grotesque** (600/700/800)
- Corps, UI, boutons : **Hanken Grotesk** (400/500/600/700)
- Chiffres de données (dates, moyennes, durées) : **Space Mono**

**Formes** — cartes en rayon 14-16 px sur `surface` avec bordure `border` ; boutons rayon 12 px ;
puces (chips) en rayon plein. Zones tactiles ≥ 48 dp. Contraste WCAG AA (4,5:1 texte, 3:1 éléments).

## Les écrans à produire

### 1. Onglet Cycle — vue principale
- **Bandeau d'avertissement en haut, visible sans défilement** : « Wellness est un carnet. Ce suivi
  n'est pas un moyen de contraception ni un avis médical. » Discret mais pas escamotable.
- **Calendrier mensuel** : jours de règles saisis en accent plein ; jours de la prochaine période
  **estimée** en contour pointillé (jamais en plein — c'est une estimation, pas un fait). Légende.
- Carte résumé : jour du cycle en cours, phase actuelle, prochaine estimation.

### 2. Saisie d'un jour (feuille modale)
- **Flux** : 4 niveaux — Spotting · Léger · Moyen · Abondant. Sélection unique, un seul niveau actif.
- **Symptômes** : 8 puces multi-sélection, **liste fermée, aucun champ libre** — Crampes, Maux de
  tête, Fatigue, Ballonnement, Sensibilité mammaire, Sautes d'humeur, Acné, Fringales.
- Tout est **optionnel** : on doit pouvoir enregistrer un jour avec le flux seul, ou rien du tout.

### 3. Prédiction — les **trois** états, à dessiner tous les trois
- **A · Pas assez de données** : « Encore 1 cycle avant une estimation » (rien n'est affiché sous
  3 cycles complets).
- **B · Estimation disponible** : une date **toujours accompagnée de sa fourchette** — « vers le
  28 août, ± 3 jours ». Jamais une date nue.
- **C · Trop irrégulier** : **aucune date affichée**. « Tes cycles varient beaucoup en ce moment —
  une estimation ne serait pas fiable. » C'est un état à part entière, pas une erreur.

### 4. Historique des cycles
Liste des périodes avec leur durée. Un cycle **aberrant** (ex. 119 jours) reste **visible** mais
porte une puce « ignoré du calcul » — l'app n'efface jamais ce que l'utilisatrice a saisi.

### 5. Croisement avec les autres piliers
Le différenciateur du produit : mettre en regard la **phase du cycle** et les données déjà collectées
par l'app (énergie/humeur/stress déclarés, tonnage de musculation, allure de course, apport calorique).

- **4 phases** à distinguer visuellement : menstruelle, folliculaire, ovulatoire, lutéale.
- Barres de comparaison des moyennes par phase, avec le nombre de cycles observés.
- **Dessine aussi l'état incomplet** : le seuil se vérifie **métrique par métrique**. L'énergie peut
  être exploitable (« disponible, 4 cycles ») quand la performance ne l'est pas encore (« encore
  6 séances à enregistrer en phase lutéale »). Les deux coexistent sur le même écran.

### 6. Réglage d'activation
Interrupteur **désactivé par défaut**, accessible à **tout le monde** (aucun filtre sur le sexe
déclaré). Un second interrupteur pour la synchronisation Health Connect. À la désactivation :
proposer la suppression des données **sans l'imposer** (garder / supprimer).

## Ce qu'il ne faut surtout pas dessiner

- Aucune notification, aucun badge, aucun rappel — la fonctionnalité n'en émet **jamais**.
- Aucun indicateur de fertilité, de « fenêtre de conception » ou de probabilité de grossesse.
- Aucun champ de saisie libre.
- Aucune donnée de cycle sur un élément partageable vers l'extérieur.

## Livrable

Les 6 écrans, en **thème clair et thème sombre**, avec les **états vides et incomplets** dessinés au
même titre que les états nominaux — dans cette fonctionnalité, ce sont eux qu'on verra le plus
longtemps.
