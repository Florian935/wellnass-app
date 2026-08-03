---
id: ACTIV-01
titre: "Parcours « 7 jours pour démarrer »"
roadmap: [1.27]
catalogue: []
etape: validation
branche: feature/activ01-parcours-7-jours
maj: 03/08/2026
---

# US ACTIV-01 — Parcours « 7 jours pour démarrer »

> Idée retenue le 13/07/2026 ([IDEAS.md](../../../../IDEAS.md)), différée après V0.9 (choix de
> capacité, pas de périmètre — [BACKLOG.md](../../../../BACKLOG.md)). Cadrée aujourd'hui parce que
> la famille RUN-F2 est livrée et qu'aucune US n'est en cours. **Seule feature de rétention qui
> fonctionne dès le jour du lancement** : contrairement au bilan hebdo, aux souvenirs ou à un
> wrapped, elle n'exige aucun historique — un utilisateur qui vient de s'inscrire en profite
> immédiatement.

## 0. Ce que ce n'est pas, et deux découvertes de cartographie

**Distinct de l'onboarding (1.7-1.11).** L'onboarding **configure le compte** (infos, piliers,
objectif) en un seul passage, skippable. Ce parcours **active l'usage** sur 7 jours après
l'onboarding : une petite suggestion par jour, pas une saisie de plus.

**Découverte 1 — la roadmap 1.11 promet déjà une « suggestion de première action », qui n'existe
pas.** Cartographie du 03/08/2026 : l'écran final de l'onboarding
(`(onboarding)/summary.tsx`) affiche un récapitulatif statique (prénom, piliers, objectif) et un
bouton générique « Terminer » — aucune suggestion n'est proposée. Le jour 1 de ce parcours **est**
cette suggestion manquante. Je ne corrige pas le statut de 1.11 ici (hors périmètre de cette US,
`/reconcilier` s'en chargera), mais je le signale : c'est ce trou que le jour 1 referme.

**Découverte 2 — les piliers actifs ne sont pas figés à l'inscription.** `togglePillar` (
`settings-repository.ts`) permet de les changer à tout moment (écran `pillars.tsx` de
l'onboarding **et** `settings.tsx` ensuite) — CLAUDE.md dit d'ailleurs que les onglets des piliers
inactifs sont masqués partout, jamais figés. Un parcours qui capturerait un instantané des piliers
« à l'inscription » se dérailerait si l'utilisateur désactive un pilier au jour 3. **Le parcours
lit donc les piliers actifs en direct, chaque jour** (R2) — jamais un instantané.

## 1. Le mécanisme

**Ancrage** : `profiles.onboarding_completed_at` (déjà posé par `completeOnboarding()`, jamais
réutilisé ailleurs pour une fenêtre temporelle). **Jour courant** = nombre de jours calendaires
écoulés depuis cette date + 1, borné à `[1, 7]`. **Calendaire, pas au rythme de complétion** :
qu'on ait fait ou non l'action du jour 2, le jour 3 arrive à son heure — aucun rattrapage, aucun
jour qui « attend » (R1).

**Disparition** (le widget se rend lui-même invisible — R4, voir §5) :
- jour calendaire strictement > 7, **ou**
- fermeture explicite par l'utilisateur (nouveau champ `profiles.activation_path_dismissed_at`),
  **ou**
- `onboardingCompletedAt` redevenu `null` (rejeu de l'onboarding, possible depuis `settings.tsx`
  — le parcours redevient invisible automatiquement ; il repart naturellement, à partir du jour 1,
  si l'utilisateur retermine l'onboarding, sans logique spéciale à écrire pour ce cas).

**Aucune notification** (R3, hors périmètre — voir §4) : le seul vecteur est le widget d'accueil,
vu à chaque ouverture de l'app.

## 2. Contenu des 7 jours — brouillon, à valider (comme CONTENU-01)

Rédiger le contenu motivationnel/instructionnel est le vrai coût de cette US (constat de
cartographie : aucune table de contenu séparée n'existe dans le projet, tout vit en clés i18next —
voir §6). Je propose un déroulé volontairement simple — **un thème par jour**, jamais plusieurs
piliers en même temps pour ne pas transformer un « petit coup de pouce quotidien » en liste de
tâches. Quand un jour cible un pilier et que plusieurs sont actifs, priorité **muscu > running >
nutrition** (ordre de build déjà énoncé dans CLAUDE.md, réutilisé ici pour sa seule vertu : être
déjà une décision actée, pas une préférence produit inventée pour l'occasion).

| Jour | Thème | Cible si pilier actif requis | Coche de complétion (informative, R5) |
|---|---|---|---|
| 1 | Bienvenue + première action du **1ᵉʳ pilier actif** (rang §2 ter) | rang 1 | 1 séance / course / repas depuis `onboardingCompletedAt` |
| 2 | Découvre ton tableau de bord (widgets, personnalisables) | — (universel) | aucune (informationnel) |
| 3 | Première action du **2ᵉ pilier actif** ; sinon « Fixe-toi un objectif » (OBJ-01) | rang 2 | 1 séance/course/repas du pilier, sinon 1 `personal_goal` créé |
| 4 | Check-in bien-être (BIEN-01, dimension transverse, toujours dispo) | — (universel) | 1 `daily_wellbeing` depuis le début du parcours |
| 5 | Première action du **3ᵉ pilier actif** ; sinon « Regarde ta série » | rang 3 | idem pilier, sinon aucune |
| 6 | Partage ta séance/course (PARTAGE-01) | — (universel) | aucune (informationnel) |
| 7 | Bilan de la semaine + clôture, encouragement à continuer | — (universel) | aucune (informationnel) |

**Aucune coche ne bloque la progression** (R5) : le calendrier avance qu'on ait coché ou non — la
coche n'est qu'un retour visuel (« déjà fait ! »), jamais une porte.

## 2 ter. Rang d'un pilier — règle structurelle, jamais comportementale

**Correction après relecture** : « pilier non encore couvert » était ambigu — comportemental (déjà
*fait* l'action ?) ou structurel (déjà *ciblé* par un jour antérieur ?). La première lecture
contredirait R1/R5 (le contenu du jour dépendrait alors de la complétion, donc d'un rattrapage
implicite). **C'est la seconde qui s'applique, exclusivement** : le rang d'un pilier est calculé
**une seule fois par affichage**, à partir de la liste des piliers **actuellement actifs** (R2),
triée par priorité fixe muscu＞running＞nutrition — **jamais** en fonction de ce qui a été fait ou
non. Le jour 1 cible toujours le rang 1, le jour 3 le rang 2, le jour 5 le rang 3 ; un rang absent
(moins de piliers actifs que de rangs) bascule sur le thème universel de repli — que l'action d'un
rang précédent ait été faite ou pas.

**Exemple concret** (running + nutrition actifs, muscu désactivé) : rang 1 = running (le plus
prioritaire des deux actifs), rang 2 = nutrition, rang 3 = absent. Jour 1 → running, jour 3 →
nutrition, jour 5 → repli universel (« Regarde ta série »), **même si** l'utilisateur n'a jamais
ouvert l'app entre le jour 1 et le jour 5.

## 2 bis. Détection de complétion (existence, pas de nouvelle table)

Pour les jours qui en ont une, la coche interroge une table déjà existante, filtrée depuis
`onboardingCompletedAt` — aucune nouvelle table de suivi :
- muscu : `EXISTS (SELECT 1 FROM workouts WHERE finished_at >= onboardingCompletedAt AND deleted_at IS NULL)`
- running : idem sur `runs` (`status = 'completed'`)
- nutrition : idem sur les entrées de journal (`food_entries`, ou total kcal du jour > 0)
- bien-être : idem sur `daily_wellbeing`
- objectif : idem sur `personal_goals`

## 3. Les règles

**R1 — Fenêtre calendaire stricte, jamais un rattrapage.** Jour courant = jours écoulés depuis
`onboardingCompletedAt` + 1, borné `[1, 7]`. Un jour manqué n'est jamais rejoué.

**R2 — Piliers lus en direct, jamais un instantané** (§0, découverte 2).

**R3 — Aucune notification en V1.** Le widget d'accueil est le seul vecteur. Une US future
(ACTIV-02, hors périmètre) pourrait ajouter un rappel quotidien opt-in, sur le même modèle que
`mealReminder` (NUTR-F1, désactivé par défaut) — pas cadrée ici pour ne pas mélanger la complexité
du quota de notifications (`maxPerDay`) avec le contenu à rédiger.

**R4 — Widget auto-masquant, aucune nouvelle garde temporelle dans `WidgetGuard` — mais avec un
vrai point d'attention trouvé en relecture.** Enregistré `'always'` dans `HOME_WIDGET_IDS` (comme
tout ajout récent, en fin de registre — zéro migration de `dashboard_layout`) ; aucune modification
du type `WidgetGuard`. **Correction après relecture** : rendre `null` dans le composant **ne suffit
pas** à éviter un trou dans la grille — `WidgetGrid` (`apps/mobile/src/components/widgets/
WidgetGrid.tsx`) n'exclut un widget que si l'appelant le déclare inactif via son prédicat
`isWidgetActive` (`(tabs)/index.tsx`), qui aujourd'hui ne connaît que `deficit-volume`.
`training-load`/`overtraining-guard` rendent bien `null` en interne mais **ne sont pas déclarés
dans `isWidgetActive`** — ils laissent donc déjà une cellule vide dans la grille quand leur pilier
est actif mais que l'alerte ne se déclenche pas (bug latent préexistant, découvert en relisant ce
fichier pour cette US, **non corrigé ici** — hors périmètre, à consigner en dette technique,
voir §4). Pour `activation-path`, la condition (jour ≤ 7 et non fermé) est simple et autonome
(dérivée de `profiles`, déjà lue par l'écran) : **elle doit être ajoutée à `isWidgetActive`**, pas
seulement au composant, sous peine de reproduire exactement ce même trou.

**R5 — Les coches sont informatives, jamais bloquantes** (§2).

**R6 — Le contenu du tableau §2 est un brouillon.** Comme CONTENU-01 l'a établi pour les
programmes (« le contenu est un travail de coach, pas de dev »), les 7 thèmes et leurs libellés
exacts sont **à valider ou corriger** par Florian/Damien avant implémentation — je les ai rédigés
sans la voix de coach du produit.

**R7 — Priorité pilier muscu＞running＞nutrition** pour les jours pilier-spécifiques quand
plusieurs piliers sont actifs (§2).

## 4. Ce qui est explicitement hors périmètre

- **Notification/rappel quotidien** (R3) — candidat naturel pour une US ACTIV-02 future.
- **Personnalisation fine par objectif/niveau** — seul le filtre piliers actifs s'applique, pas de
  branchement sur l'objectif (perte de poids / performance / etc.).
- **Rattrapage des jours manqués** (R1).
- **Widgets des hubs muscu/running** — uniquement le hub `home`, le parcours est transverse.
- **Un nouveau système de contenu** (CMS, table dédiée) — le volume (7 jours × copy courte) reste
  gérable en clés i18next classiques, contrairement à un contenu qui grossirait sans limite.

## 5. Surfaçage

- **Widget d'accueil** (nouvel id `activation-path`, forme `wide`, garde `'always'`, hub `home`,
  en fin de registre `HOME_WIDGET_IDS`) : « Jour {{n}} sur 7 », titre + description du jour, coche
  si l'action est déjà faite (§2 bis), bouton d'action principal (deep-link vers l'écran
  pertinent), bouton « Passer » discret (dismiss, `activation_path_dismissed_at`). Rendu `null`
  hors fenêtre (R4).
- **Aucun nouvel écran.** Le widget porte tout le contenu ; pas d'écran de détail séparé — un
  parcours de 7 jours à contenu court ne justifie pas une nouvelle route.

## 6. i18n

Nouvelle famille `activationPath.*`, FR + EN : `progress` (« Jour {{n}} sur 7 »), `dismiss`,
`doneBadge`, puis `day1`..`day7` chacun `{ title, description, cta }` (7 × 3 = 21 clés de contenu,
+ quelques libellés génériques). Volume comparable à l'extension FAQ (`help.faq.items`,
`returnObjects: true`) déjà en place — pas de nouveau pattern de contenu (§4).

## 7. Comportement offline

**Total.** Lecture 100 % locale (`profiles.onboarding_completed_at` + les `EXISTS` du §2 bis, tous
sur des tables déjà synchronisées) ; écriture du dismiss immédiate en SQLite local, PowerSync
synchronise ensuite.

## 8. Accessibilité

Le widget est un seul bloc cohérent annoncé d'un coup (jour + titre + description + état de
complétion), même exigence de regroupement que les autres widgets informationnels de cette session
de travail (META-19, RUN-18, RUN-F2c).

## 9. Critères de recette

- [ ] 1. Onboarding terminé aujourd'hui → le widget affiche « Jour 1 sur 7 » avec le contenu du
      jour 1, ciblé sur le pilier prioritaire actif.
- [ ] 2. Le lendemain (ou date système avancée) → « Jour 2 sur 7 », contenu universel.
- [ ] 3. **Un jour non consulté ne bloque rien** : sauter un jour puis rouvrir l'app affiche le
      jour calendaire réel, pas le jour suivant celui vu en dernier.
- [ ] 4. Faire l'action suggérée (ex. une séance) fait apparaître la coche de complétion du jour
      concerné, sans changer le jour affiché ni avancer le calendrier.
- [ ] 5. Un seul pilier actif (ex. nutrition seule) : les jours 3/5 basculent sur leur variante
      universelle plutôt que de cibler un pilier absent.
- [ ] 6. Désactiver un pilier au jour 3 change immédiatement le contenu proposé si ce jour cible ce
      pilier (R2 — pas d'instantané figé à l'inscription).
- [ ] 7. Bouton « Passer » : le widget disparaît immédiatement et ne réapparaît pas, même avant le
      jour 7.
- [ ] 8. Au jour 8 (ou après), le widget a disparu, sans action de l'utilisateur.
- [ ] 9. Rejouer l'onboarding puis le reterminer relance un parcours neuf au jour 1.
- [ ] 10. **Mode avion** : le widget, sa progression et le dismiss fonctionnent normalement.
- [ ] 11. En **EN** : les 7 titres/descriptions/CTA sont tous grammaticaux.
- [ ] 12. TalkBack annonce le widget comme un seul bloc cohérent (jour + contenu + état).
