# Fichiers d'exemple pour l'import (US IMPORT-01)

> **À quoi sert ce dossier.** L'US [IMPORT-01](../../functional/us/import01-import-donnees-externes.md)
> lit des exports d'autres applications. Leurs colonnes exactes **ne sont pas documentées de façon
> fiable** et **changent au fil des versions** : la seule façon de figer le mapping est de regarder un
> vrai fichier. Ce dossier accueille ces fichiers, qui deviennent ensuite les **fixtures des tests**.
>
> ⏸️ **L'US est en pause tant que ce dossier est vide** (décision du 04/08/2026).

## Ce dont j'ai besoin, par source

| Fichier attendu | Source | Priorité |
|---|---|---|
| `hevy-sample.csv` | Hevy | 🔴 bloquant |
| `strong-sample.csv` | Strong | 🔴 bloquant |
| `myfitnesspal-sample.csv` | MyFitnessPal | 🔴 bloquant |
| `strava-sample.gpx` | Strava ou tout traceur | 🟢 utile, non bloquant — le GPX est un standard |

**Quelques jours de données suffisent.** Je n'ai pas besoin d'un historique réel : j'ai besoin des
**en-têtes de colonnes** et de la **forme des valeurs** (format de date, séparateur décimal, unités,
libellés de repas). Un compte neuf avec deux ou trois séances saisies à la main est parfaitement
suffisant — et préférable, voir la note sur les données personnelles plus bas.

## Ce que les données doivent contenir pour être utiles

C'est la partie qui compte : un fichier trop simple ne révèle pas les cas qui cassent.

### Hevy et Strong (musculation)

- [ ] **Au moins 2 séances à des dates différentes** — pour vérifier le regroupement des lignes en
      séances (ces exports sont *une ligne par série*).
- [ ] **Un exercice qui existe dans notre bibliothèque** : `Squat`, `Développé couché`/`Bench Press`,
      `Soulevé de terre`/`Deadlift` — pour tester la correspondance (passes 1 et 2 de **D1**).
- [ ] **Un exercice exotique** que nous n'avons pas (`Hack Squat Machine`, `Cable Pullover`…) — pour
      tester la création d'un exercice perso (passe 3).
- [ ] **Le même exercice deux fois dans une séance** (plusieurs séries).
- [ ] **Une série avec charge** (ex. 80 kg × 5) **et** une série **au poids du corps** (tractions,
      pompes) — la seconde a une charge vide ou nulle, et je dois savoir laquelle.
- [ ] **Une série en durée** si l'app le permet (gainage, planche) — pour le `set_type: 'duration'`.
- [ ] **Un RPE** renseigné sur au moins une série, si l'app le propose.
- [ ] **Une note de séance** et **un superset**, si c'est facile — pour confirmer ce qu'on ne pourra
      pas reprendre (§2.2 de la spec).

⚠️ **Le point le plus important : l'unité de charge.** Si l'app permet de choisir kg ou livres,
**dis-moi lequel était réglé**, et si possible fournis **un export dans chaque unité**. Une charge en
livres prise pour des kilos fausse tous les records, et la spec préfère **refuser** une ligne dont
l'unité est indéterminable plutôt que de supposer.

### MyFitnessPal (alimentation)

- [ ] **Au moins 2 jours** différents.
- [ ] **Les 4 repas** utilisés (petit-déjeuner, déjeuner, dîner, collation) — je dois voir les
      libellés exacts pour les faire correspondre à nos clés.
- [ ] **Un repas renommé ou personnalisé**, si l'app le permet — pour vérifier le repli sur « Autre ».
- [ ] **Plusieurs aliments dans un même repas.**
- [ ] Un aliment avec **macros complètes** et un avec des **macros partielles** (certaines colonnes
      vides) — pour confirmer qu'une absence reste `null` et ne devient pas 0.

> **Note** : l'export MyFitnessPal se fait **depuis le site web**, pas depuis l'application mobile.
> L'archive reçue contient plusieurs CSV (nutrition, exercice, mesures…) — **seul le fichier
> nutrition m'intéresse.**

### Strava / GPX (course)

- [ ] Une activité avec **temps** (`<time>`) et **altitude** (`<ele>`).
- [ ] Si possible une activité **sans altitude** (tapis, ou traceur sans baromètre).

## Où trouver l'export dans chaque app

⚠️ **Chemins indicatifs, donnés de mémoire et non vérifiés** : ces interfaces bougent. Si le chemin
ne correspond pas, chercher « export » dans les réglages, ou « download your data » sur le site web
de l'app — c'est presque toujours là.

| App | Chemin probable | Remarque |
|---|---|---|
| **Hevy** | Profil → Réglages → *Export Data* (ou depuis `hevy.com` → Settings) | Génère un `.csv`, parfois envoyé par e-mail. |
| **Strong** | Profil → Réglages (roue dentée) → *Export Data* / *Export Strong Data* | `.csv` partagé via la feuille de partage. |
| **MyFitnessPal** | **Site web** `myfitnesspal.com` → Réglages → *Download my data* / *Export data* | **Web uniquement.** Archive par e-mail, plusieurs CSV dedans. |
| **Strava** | Une activité → ⋯ → *Exporter GPX* (le plus simple) | Sinon : Réglages → Mon compte → *Télécharger mes données* (archive complète, plus long). |

## Comment me les transmettre

Dépose les fichiers **dans ce dossier**, en respectant les noms du tableau ci-dessus. Ils seront
versionnés et deviendront les fixtures des tests — ce qui a une vraie valeur : le jour où un format
change, un test échouera au lieu d'un utilisateur.

🔒 **Données personnelles.** Ces fichiers entrent dans le dépôt : **n'y mets rien de sensible.**
Idéalement, crée des comptes neufs avec des données inventées. Si tu utilises un vrai compte,
vérifie qu'aucune colonne ne porte d'e-mail, de nom ou d'identifiant, et retire les lignes
superflues — quelques jours suffisent, et un export de trois ans n'apporte rien de plus ici.

## Ce que je fais dès réception

1. Je relève les en-têtes réels et remplace les **hypothèses** du lot 3 du
   [plan](../../../plans/import01-import-donnees-externes.md) par les alias vrais.
2. Les fichiers deviennent des fixtures : un test par source vérifie que le fichier **réel** se parse
   et produit le bon nombre de séances / entrées.
3. Je déroule les lots 1 → 9. Le cadrage est déjà fait, il n'y a plus de décision produit à prendre
   (hors les deux points **P1** et **P2** de la spec, qui ne bloquent pas).
