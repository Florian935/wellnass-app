# 💡 Idées — boîte de dépôt

Idées brutes captées au fil de l'eau, **sans cadrage**. Le but est de ne rien perdre :
on note vite ici, on trie plus tard.

Ce fichier n'est **pas** le pipeline de travail. Une idée retenue devient une US
(spec → plan → design → validation, voir [CLAUDE.md](CLAUDE.md)) puis rejoint la
[roadmap](docs/roadmap/roadmap.md) et le [TODO.md](TODO.md). Ici, c'est le brouillon d'avant.

- **Format** : une idée = une ligne, préfixée de la date `[JJ/MM/AAAA]` et d'un statut.
- **Statuts** : 🆕 nouvelle · 🔍 à creuser · ✅ promue en US · ❌ écartée
- **Tri** : on relit ensemble régulièrement ; ce qui est promu (✅) ou écarté (❌) descend
  dans « Archives » avec un mot d'explication.

---

## À trier

<!-- Ajoute tes idées ici, la plus récente en haut. Exemple :
- [12/07/2026] 🆕 Widget écran d'accueil avec la séance du jour.
-->

- [12/07/2026] 🆕 **Intégration de l'IA** dans le produit (thème transverse à préciser).
- [12/07/2026] 🆕 **Nutrition — suggestion de recettes healthy** : l'utilisateur renseigne les
  ingrédients qu'il a, l'app propose des recettes saines correspondantes (piste IA à évaluer).
- [12/07/2026] 🆕 **Données sommeil & pas (podométrie/steps)** : indicateur + saisie/import.
  _Vérifié le 12/07/2026 : non couvert par le cadrage actuel. Health Connect (US 9.9, V1) se
  limite à l'écriture des séances + lecture du poids ; les wearables V2 (zones FC, hydratation)
  ne nomment ni le sommeil ni les pas. → idée neuve à instruire. Piste : source de vérité via
  Health Connect (Android) / Apple Health (iOS ultérieur) plutôt que saisie manuelle._
- [12/07/2026] 🆕 **Gamification ludique via équivalences parlantes** : streak/indicateurs qui
  traduisent les perfs en repères concrets — ex. « Tu as couru X km ce mois-ci, soit la distance
  Paris–Marseille » ou « Tu as soulevé X tonnes cette séance, soit l'équivalent d'un Boeing ».
- [12/07/2026] 🆕 **Module Coach ⇄ Coaché (feature complète)** : espace dédié aux coachs et à
  leurs clients — templates/programmes, suivi poussé côté coach ET coaché, volet nutrition,
  facturation (coachs auto-entrepreneurs), suivi compta, analyses avancées des coachés (tendances,
  nutrition, mensurations, PR, perf, volume, tonnage…) et croisement des données
  muscu/nutrition/bien-être/course.
- [12/07/2026] 🆕 **Offre payante dédiée** aux coachs et à leurs coachés (monétisation du module
  Coach ci-dessus).

---

## Archives

<!-- Idées tranchées (promues ou écartées), pour garder la trace de la décision. Exemple :
- [10/07/2026] ✅ Export GPX des sorties → promue en US 5.xx.
- [10/07/2026] ❌ Intégration montres Garmin → hors périmètre V1, revoir en V2.
-->
