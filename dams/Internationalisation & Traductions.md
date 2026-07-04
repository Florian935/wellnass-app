# Internationalisation & Traductions

> Plan de traduction de l'application. Complète les fondations posées dans [[Bonnes Pratiques Techniques]] (§2 « aucune chaîne en dur, i18n dès la V0.1 ») en décrivant **quelles langues**, **quoi traduire**, **comment** et **quand**.
> Réf. techniques : [[Architecture Technique]] · Contenu : [[Outils d'Administration]] · Préférence utilisateur : [[Compte & Profil Utilisateur]]

---

## 1. Principe

L'i18n n'est pas une fonctionnalité ajoutée après coup : **tout est externalisé dès la V0.1**, même si l'app ne sort qu'en français. La V1 est livrée **FR uniquement** (langue de référence), mais l'architecture rend l'ajout d'une langue **trivial pour l'UI** et **outillé pour le contenu**.

Deux surfaces distinctes, à ne jamais confondre :

| Surface | Exemple | Qui traduit | Où vivent les traductions |
|---|---|---|---|
| **UI statique** (chrome de l'app) | Boutons, libellés, messages d'erreur, écrans, notifications | Équipe / traducteur | Fichiers de ressources (`packages/shared/locales/`) |
| **Contenu dynamique** (données) | Noms d'exercices, consignes, noms de programmes, noms d'aliments, catégories | Back-office ([[Outils d'Administration]]) | Champs multilingues en base |

Le contenu **saisi par l'utilisateur** (aliments persos, notes de séance, exercices persos) n'est **jamais traduit** — il reste dans la langue de saisie.

---

## 2. Langues cibles & roadmap

| Langue | Version | Justification |
|---|---|---|
| 🇫🇷 **Français** | V1 | Langue de référence, marché initial, base d'aliments CIQUAL en FR |
| 🇬🇧 **Anglais** | V2 | Ouverture internationale — l'UI est déjà externalisée, reste le contenu |
| 🇪🇸 Espagnol · 🇩🇪 Allemand · 🇮🇹 Italien | V2+ | Selon la traction ; ajout purement éditorial une fois le pipeline EN validé |
| Langues RTL (arabe…) | Non planifié | Voir §9 (readiness prévue, activation ultérieure) |

**Décision** : le français est la **locale source**. Toute nouvelle clé est écrite en FR d'abord ; les autres langues en dérivent. Pas de clé qui n'existe qu'en anglais.

---

## 3. Stack technique i18n

| Brique | Choix envisagé | Rôle |
|---|---|---|
| Librairie | **i18next + react-i18next** | Chargement des ressources, changement de langue à chaud, namespaces |
| Détection locale | **expo-localization** | Langue + région du système au premier lancement |
| Format des messages | **ICU MessageFormat** | Pluriels, genre, sélection, interpolation typée |
| Formats nombres/dates | **`Intl`** (natif) | Séparateurs, dates, unités selon la locale |
| Stockage préférence | Settings utilisateur (SQLite + cloud) | Override manuel de la langue système |

- Les fichiers de traduction vivent dans **`packages/shared/locales/<lang>/<namespace>.json`** — partagés entre l'app mobile et le back-office (mêmes libellés métier).
- **Aucune chaîne en dur** : lint rule (`i18next/no-literal-string`) qui **fait échouer la CI** si une chaîne UI n'est pas passée par `t()`. Aligné avec la Definition of Done ([[Bonnes Pratiques Techniques]] §12).
- Chargement **paresseux par namespace** : on ne charge que les traductions de l'écran courant (perf + poids de bundle).

### Structure des clés (namespaces)

```
common       → Boutons, actions génériques (Enregistrer, Annuler, Réessayer…)
auth         → Inscription, connexion, vérification email
onboarding   → Les 5 étapes
dashboard    → Blocs de l'accueil
muscu        → Suivi de séance, programmes, exercices
running      → Suivi GPS, types de séance
nutrition    → Journal, macros, recettes
settings     → Profil, préférences, compte
errors       → Messages d'erreur (réseau, GPS, sync)
notifications→ Textes des push
units        → Libellés d'unités (kg/lb, km/mi, min/km)
```

**Convention de clé** : `namespace:section.element` (ex. `muscu:session.validateSet`, `errors:gps.unavailable`). Jamais la phrase française comme clé — une clé stable et sémantique.

---

## 4. Contenu dynamique — modèle multilingue

Le vrai enjeu de la traduction : les **données de contenu** gérées dans le back-office. Ces entités portent des champs **traduisibles** stockés par langue.

**Entités concernées**
- **Exercice** ([[Musculation]]) : nom, consignes techniques, (les muscles/matériel sont des enums → traduits côté UI, pas en base)
- **Programme** (muscu & running) : nom, résumé, description des séances
- **Aliment** ([[Alimentation]]) : nom (les valeurs nutritionnelles sont numériques, universelles)
- **Type de séance running**, **catégories d'aliments**, **groupes musculaires** : enums → dictionnaire i18n côté UI

**Approche en base** (à trancher en ADR — voir §8) :

```
Exercise
  ├── id, difficulty, movement_type, equipment[]   (universel)
  └── translations[]
        ├── { lang: "fr", name, instructions }
        └── { lang: "en", name, instructions }
```

- Table de traductions liée (`exercise_translations`, `program_translations`, `food_translations`) plutôt que des colonnes `name_fr` / `name_en` — extensible sans migration à chaque langue.
- **Fallback** : si la traduction manque dans la langue de l'utilisateur → on sert le **FR** (locale source) avec un marqueur discret côté admin (« non traduit »).

**Sources de données externes**
- **CIQUAL** (aliments bruts) : FR uniquement → noms EN à produire (traduction éditoriale ou mapping USDA).
- **OpenFoodFacts** : **déjà multilingue** (champs `product_name_fr`, `product_name_en`…) → on importe la langue disponible, fallback sur le nom générique.
- **Base d'exercices** (`exercises-dataset`) : instructions **FR + EN** déjà fournies → import direct des deux langues.

---

## 5. Formats & conventions locales

Traduire ne suffit pas — il faut **localiser** les formats. Découplé du choix de langue (un francophone peut vouloir les unités impériales).

| Élément | FR (défaut) | EN / US | Source |
|---|---|---|---|
| Séparateur décimal | `1 840,5` | `1,840.5` | `Intl.NumberFormat` |
| Unités de poids | kg | lb (si impérial) | déjà géré — [[Compte & Profil Utilisateur]] |
| Distance | km | mi (si impérial) | conversion à l'affichage |
| Allure running | min/km | min/mi | dérivé de l'unité de distance |
| Dates | `04/07/2026` | `07/04/2026` | `Intl.DateTimeFormat` |
| Premier jour de semaine | lundi | dimanche (US) | calendrier dashboard & planning |
| Calories | kcal | kcal / Cal | libellé i18n |

> ⚠️ Le **choix d'unités (métrique/impérial) est indépendant de la langue**. Un anglais peut être en métrique. Ne jamais coupler `lang === 'en'` avec `units === 'imperial'`.

---

## 6. Cas particuliers

### Annonces vocales running ([[Running]])
- Le guidage fractionné et les annonces au km sont en **TTS (text-to-speech)** → doivent parler la **langue de l'app**.
- `expo-speech` avec la voix de la locale ; textes dans le namespace `running`.
- Vérifier la prononciation des nombres et unités (« 3 kilomètres, allure 5 minutes 20 »).

### Pluriels & genre
- Passer par **ICU** : `{count, plural, one {# série} other {# séries}}` — jamais de concaténation manuelle `count + " série(s)"`.
- Attention aux langues à pluriels multiples (zéro, few, many) en V2+ — ICU les couvre nativement.

### Notifications push
- Générées **côté serveur** mais le **texte est rendu selon la langue de l'utilisateur** (stockée dans son profil) → le backend a aussi accès aux fichiers de `packages/shared/locales`.

### États vides, erreurs, onboarding
- Ces écrans concentrent beaucoup de texte long → à traiter dès l'externalisation, pas en rattrapage.

---

## 7. Sélection & détection de la langue

- **Premier lancement** : langue = locale système (`expo-localization`) si supportée, sinon FR.
- **Override manuel** : sélecteur dans [[Compte & Profil Utilisateur]] → Préférences → Langue.
- **Changement à chaud** : pas besoin de redémarrer l'app (react-i18next re-render).
- La langue choisie est **synchronisée** (settings cloud) pour être cohérente entre appareils et pour les notifications serveur.

---

## 8. Readiness RTL (droite-à-gauche)

Non activé en V1/V2, mais **anticipé** pour éviter une refonte :
- Utiliser les propriétés logiques (`marginStart`/`marginEnd`, pas `left`/`right`).
- Ne jamais coder en dur l'alignement du texte.
- Icônes directionnelles (retour, progression) à miroir automatique.
- L'activation RTL restera un chantier UI dédié, mais le socle ne l'empêche pas.

---

## 9. Workflow de traduction

1. **Écriture** : le développeur ajoute la clé en FR dans le namespace concerné (via `/new-feature`, voir [[Bonnes Pratiques Techniques]] §13).
2. **CI** : la lint rule vérifie qu'aucune chaîne n'est en dur et que les clés FR/EN sont **synchronisées** (pas de clé orpheline, pas de clé manquante).
3. **Traduction** : les nouveaux libellés partent vers l'outil de gestion (à choisir : **Weblate self-hosted**, Crowdin, ou simple PR sur les JSON en V2).
4. **Contenu** : le back-office affiche pour chaque exercice/programme/aliment un **onglet par langue** avec indicateur « traduit / non traduit » ; le fallback FR reste servi tant que la traduction manque.
5. **Revue** : relecture par un locuteur natif avant publication (contenu) / release (UI).

**Décisions à trancher (ADR)**
- [ ] Table de traductions liée vs colonnes par langue (recommandé : table liée)
- [ ] Outil de gestion des traductions UI (Weblate self-hosted vs PR JSON en V2)
- [ ] Stratégie de traduction du contenu CIQUAL en EN (éditorial vs mapping USDA)
- [ ] Faut-il traduire les **programmes éditoriaux** ou les recréer par marché (nuances culturelles de coaching) ?

---

## 10. Découpage par version

| Version | Périmètre i18n |
|---|---|
| **V0.1** | Socle : librairie i18n branchée, namespaces créés, lint « no hardcoded string », **tous les libellés en FR** passés par `t()` |
| **V0.2 → V0.8** | Chaque fonctionnalité livrée **déjà externalisée** (Definition of Done) ; modèle de contenu prévu multilingue même si une seule langue remplie |
| **V1** | Livraison **FR only**, propre et cohérente (formats, pluriels, TTS FR) |
| **V2** | Activation **EN** : traduction des ~10 namespaces UI + onglet EN dans le back-office + import EN d'OpenFoodFacts/exercises-dataset + traduction CIQUAL |
| **V2+** | Langues supplémentaires : purement éditorial, aucun code à toucher |

---

## 11. À retenir

- L'i18n est **structurelle, pas optionnelle** — externalisation dès la V0.1, coût quasi nul si fait dès le début, très cher en rattrapage.
- **Deux surfaces** : UI (fichiers de ressources) et contenu (champs multilingues en base + back-office).
- **Langue ≠ unités ≠ région** : trois axes indépendants.
- La **V1 reste FR**, mais rien dans le code ne devra changer pour ajouter l'EN — seulement remplir des fichiers et des champs.
