---
id: BIEN-01
titre: "Check-in quotidien & journal de bien-être"
roadmap: [1.24]
catalogue: []
etape: recette
branche: feature/bien01-checkin-bien-etre
maj: 28/07/2026
---

# US BIEN-01 — Check-in quotidien & journal de bien-être

> **Spec fonctionnelle — ✅ validée par Florian le 28/07/2026** (livrables spec + plan + maquette,
> et arbitrage des 7 décisions §1). Implémentation en cours.
> Roadmap **1.24** (V0.9, P1, ~5 h).
>
> **Pourquoi celle-ci en premier** parmi les 6 US de rétention de V0.9 : c'est la seule dont la
> valeur **dépend du temps**. Le check-in produit une donnée **historisée** — chaque jour non
> collecté est perdu définitivement. La livrer en dernier, c'est arriver au lancement avec une table
> vide. Elle est aussi la **source transverse** que le
> [catalogue d'analyses](../../../product/analyses-donnees.md) désigne comme prérequis de toute la
> famille récupération : TRI-03 (readiness), TRI-12 (sous-récupération), TRI-18, MR-23, MUSC-23.

## 0. Contexte

Le produit s'appelle « bien-être » et ne mesure aujourd'hui que du **quantitatif** : séances,
sorties, repas, poids, pas. Rien ne capte l'état **subjectif** — or c'est très souvent lui qui
explique ce que les chiffres seuls ne disent pas : une contre-performance, un plateau, un abandon.

Deux idées d'[IDEAS.md](../../../../IDEAS.md) ont été fusionnées le 28/07/2026 en promouvant cette
US : « journal de bien-être » et « check-in quotidien léger » **n'en faisaient qu'une** — le
check-in *est* la saisie du journal. Il n'y a pas deux écrans à construire.

### Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| Poids du jour + courbes | [bodyweight-repository.ts](../../../../apps/mobile/src/data/repositories/bodyweight-repository.ts), table `body_weight_entries`, roadmap 4.30 | **Réutilisé tel quel** — le check-in écrit dans la table existante, il ne la duplique pas |
| Patron « une ligne par jour » | [migration `daily_steps`](../../../../supabase/migrations/20260728132424_pas01_daily_steps.sql) | Copié : index unique **partiel**, RLS sans `delete`, soft delete |
| Widget transverse non gaté | `WIDGET_REGISTRY.home.pillars` → `'always'` ([widgets.ts](../../../../packages/shared/src/widgets.ts)) | Le check-in est transverse, comme `streak` et `steps` |
| Courbe + lissage | `ProgressLineChart` (prop `smooth`), `movingAverage` (META-09) | Historique et tendances |
| Infobulle au tap | US UX-01, les 6 surfaces de graphique | Gratuit sur la nouvelle courbe |
| Export RGPD | [data-export.ts:29-45](../../../../apps/mobile/src/lib/data-export.ts#L29) — liste **explicite** de tables | ⚠️ La nouvelle table doit y être ajoutée |
| Suppression de compte | `purge_expired_accounts()` → `delete from auth.users`, **cascade FK** | Rien à faire **si** la FK porte `on delete cascade` |

## 1. Décisions de cadrage — ✅ TRANCHÉES le 28/07/2026

> ✅ **Validation Florian, 28/07/2026 : les 3 livrables sont validés et les 7 décisions sont
> arbitrées conformément aux recommandations ci-dessous.** Elles sont donc à lire comme des
> **règles**, plus comme des propositions. Les deux conséquences de code à ne pas perdre de vue :
> **D5** → `streak.ts` n'est pas touché ; **D7** → la saisie est une **feuille**, pas un écran poussé.

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Quels indicateurs ? | **Humeur, énergie, stress** (les 3 de la roadmap 1.24) + poids optionnel | Tenir les 10 s. Un 4ᵉ indicateur (qualité de sommeil **subjective**) coûterait *une* colonne, à ajouter plus tard sans rien casser — mais chaque champ ajouté allonge le rituel |
| **D2** | Quelle échelle ? | **1 à 5**, avec libellé **et** pictogramme par niveau | 3 taps = 10 s. Une échelle 1-10 double le temps de décision pour une précision que personne n'exploitera. Jamais un chiffre nu : « 3/5 » ne veut rien dire sans libellé |
| **D3** | Saisie partielle acceptée ? | **Oui** — les 3 champs sont indépendants et nullables | Forcer les 3 fait abandonner. Une ligne à 1 indicateur reste exploitable |
| **D4** | Rattrapage possible ? | **Jour courant + 6 jours précédents**, jamais dans le futur | Oublier hier est normal. Réécrire un mois de journal le rend faux — et fausserait les corrélations post-V1 |
| **D5** | Le check-in compte-t-il dans la **série** ? | **NON** — décision importante | 3 taps sur des emoji ne sont pas de l'activité. L'y inclure permettrait de tenir une série sans rien faire et **dévaloriserait le streak** (contraire à l'arbitrage C : pas de boucle de jeu). PAS-01 a fait compter les pas parce que marcher *est* une activité |
| **D6** | Rappel poussé le matin ? | **Hors périmètre de cette US** | L'infra notification existe (`scheduleStreakReminder`) mais le travail de notifications appartient à **MUSC-F8** et **NUTR-F1**, avec la logique d'heure apprise et le plafond quotidien. Sans rappel le check-in sera peu tenu : à enchaîner, pas à bâcler ici |
| **D7** | Écran ou feuille (bottom-sheet) ? | **Feuille**, ouverte depuis le widget | Un aller-retour de navigation coûte cher sur un rituel de 10 s, et la feuille est la direction prise par UX-02/UX-03 (patron `ExerciseFilterDrawer`). La **disposition est identique** dans les deux cas — la maquette vaut pour l'un comme pour l'autre, seul le conteneur change |

## 2. Périmètre à livrer

**Dans le périmètre :**

1. Une **surface de check-in** (feuille recommandée, D7) atteignable en **1 tap** depuis l'accueil,
   remplissable en ~10 s.
2. Une **table historisée** `daily_wellbeing`, offline-first, une ligne par jour.
3. Le **widget d'accueil** `wellbeing` (transverse, non gaté par pilier), 3 formes comme les autres.
4. Un **écran d'historique** : liste des jours + **courbe par indicateur** (sélecteur de métrique).
5. **i18n FR + EN** complet, y compris les libellés des 5 niveaux de chaque échelle.
6. Le poids saisi ici va dans `body_weight_entries` — **pas de nouvelle table de poids**.

**Hors périmètre, explicitement :**

- Notification de rappel (D6) → MUSC-F8 / NUTR-F1.
- Toute **corrélation** ou score de readiness (TRI-03, TRI-12, MR-23) : cette US **produit la
  donnée**, elle ne l'exploite pas. Le modèle doit rendre ces analyses possibles, pas les anticiper
  en code.
- Lecture du **sommeil via Health Connect** : écartée par l'arbitrage du 28/07/2026 (seuls les pas
  ont été ajoutés à la déclaration Play). Un score de sommeil **subjectif** serait un simple champ
  de plus, sans rapport avec Health Connect.
- Journal en **texte libre** : une note libre par jour est tentante mais change la nature de la
  donnée (non analysable, et un contenu utilisateur libre a des implications RGPD/modération).

## 3. Comportement attendu

### 3.1 Le check-in

- Point d'entrée : le widget d'accueil `wellbeing`, **en 1 tap**. S'il n'y a pas de check-in pour
  aujourd'hui, il invite à le faire ; sinon il affiche les valeurs du jour et permet de les corriger.
  Conteneur recommandé : une **feuille** plutôt qu'un écran poussé (D7).
- Trois échelles **1-5**, chacune : un libellé de l'indicateur, 5 niveaux avec **pictogramme +
  libellé**, sélection en 1 tap.
- Un champ **poids** optionnel, pré-rempli avec la pesée du jour si elle existe déjà (et alors
  l'enregistrement la **met à jour** au lieu d'en créer une seconde).
- Validation en un bouton. **Toute combinaison partielle est acceptée**, y compris le poids seul.
- Enregistrer deux fois le même jour **met à jour** la ligne existante (jamais de doublon).

### 3.2 Historique

- Liste anté-chronologique des jours renseignés : date, les 3 valeurs, le poids s'il existe.
- **Une courbe à la fois**, via un sélecteur d'indicateur (humeur / énergie / stress) — trois
  courbes superposées sur un écran de téléphone sont illisibles. Fenêtres 30 j / 90 j / 1 an, comme
  `/progress`.
- Lissage disponible (`movingAverage`, prop `smooth`), avec la **valeur brute** affichée dans
  l'infobulle — même règle qu'UX-01 : la courbe lissée ne doit pas laisser croire à une valeur qui
  n'a jamais été saisie.
- Le **poids n'est pas re-courbé ici** : la courbe de poids existe (4.30, écran Stats nutrition). On
  y renvoie plutôt que de la dupliquer.
- Un jour non renseigné est un **trou**, pas un zéro. Aucune interpolation.

### 3.3 Widget d'accueil

- `'always'` dans `WIDGET_REGISTRY.home.pillars` : le bien-être n'appartient à **aucun pilier**, et
  un utilisateur « nutrition seule » doit y avoir accès. **Ce n'est pas un 4ᵉ pilier activable** —
  aucune entrée dans `active_pillars`, aucun onglet.
- Ajouté **en fin** de `HOME_WIDGET_IDS` : `resolveScreenLayout` complète les layouts déjà stockés
  avec les IDs manquants, donc **aucune migration de `dashboard_layout`** (précédent PAS-01).
- Les 3 formes (`small` / `wide` / `large`), forme par défaut `wide` comme les autres.

## 4. Modèle de données

```sql
create table public.daily_wellbeing (
  id uuid primary key,                    -- UUID généré par le client (offline-first)
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  mood smallint     check (mood     is null or mood     between 1 and 5),
  energy smallint   check (energy   is null or energy   between 1 and 5),
  stress smallint   check (stress   is null or stress   between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

- Les 3 indicateurs sont **nullables** (D3). Une ligne dont les 3 sont nuls n'a pas de sens : à
  empêcher **côté application** (ne rien écrire), pas par une contrainte qui compliquerait l'édition.
- **Index unique partiel** `(user_id, log_date) where deleted_at is null` — une ligne soft-deleted
  ne doit pas empêcher d'en recréer une pour le même jour (patron `daily_steps`).
- Index de lecture `(user_id, log_date desc)` : l'usage dominant est l'historique récent.
- **RLS** : `select` / `insert` / `update` scopés sur `auth.uid()`, **pas de politique `delete`** — le
  projet fait du soft delete (calque de `body_weight_entries` et `daily_steps`).
- `on delete cascade` sur la FK ⇒ la suppression de compte (CONF-02) purge automatiquement, sans
  toucher `purge_expired_accounts()`.
- **Pas de colonne poids** : il vit dans `body_weight_entries`.

⚠️ **Deux migrations, comme PAS-01** : la table, **puis** `alter publication powersync add table` —
sans quoi le déploiement des sync rules échoue « table not part of publication ». L'oubli s'est
déjà produit le 24/07.

## 5. Offline

- Écriture **toujours locale d'abord**, via un repository dédié (`daily-wellbeing-repository.ts`) —
  jamais d'appel Supabase direct depuis un écran.
- **UUID côté client**, timestamps **UTC**, **soft delete** : les 3 règles de
  [offline-sync.md](../../technical/offline-sync.md).
- `log_date` est une **date civile locale** (`AAAA-MM-JJ`), pas un instant : le check-in du matin
  appartient au jour local de l'utilisateur. Réutiliser l'utilitaire de clé de jour existant, ne pas
  recalculer avec `new Date()`.
- Conflit multi-appareils : dernière écriture gagnante, déléguée à PowerSync
  ([ADR-001](../../../adr/ADR-001-moteur-sync-offline.md)). Acceptable — deux check-ins concurrents
  du même jour sur deux téléphones est un cas de bord sans enjeu.
- ⚠️ **Sync rule à déployer À LA MAIN** sur l'instance PowerSync après la migration :
  ajouter la ligne dans
  [powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml), coller le fichier dans le
  dashboard, déployer. **Étape manuelle, déjà oubliée une fois** — elle est en DoD.

## 6. i18n (FR + EN)

Nouveau namespace `wellbeing` dans [fr.json](../../../../apps/mobile/src/i18n/locales/fr.json) et
[en.json](../../../../apps/mobile/src/i18n/locales/en.json). **Aucune chaîne en dur.**

- Titre, sous-titre, libellés des 3 indicateurs, libellé du bouton, états vides.
- **Les 5 niveaux de chaque échelle sont des clés distinctes** — 15 libellés par langue. Un
  pictogramme sans mot n'est pas compréhensible (et pas accessible) ; « 3/5 » non plus.
- Pluriels via les suffixes `_one` / `_other` (patron du namespace `steps`).
- Les niveaux de **stress** se lisent à l'envers des deux autres (5 = beaucoup de stress = mauvais) :
  les libellés doivent lever l'ambiguïté, et **la couleur ne doit pas être le seul indice**.

## 7. Accessibilité

CONF-07 (9.11 / 9.12) est un **P0 en cours** : ne pas créer de dette ici.

- Chaque niveau d'échelle est un contrôle avec `accessibilityLabel` explicite (« Énergie : 4 sur 5,
  bonne »), `accessibilityRole="radio"` et état sélectionné annoncé.
- Cible tactile **≥ 48 dp** avec `hitSlop` si le visuel est plus petit (leçon d'UX-04).
- **Jamais la couleur seule** pour distinguer les niveaux : pictogramme + libellé + position.
- Contraste WCAG AA sur les 5 niveaux, dans les deux thèmes.
- `maxFontSizeMultiplier` explicite sur les libellés courts pour éviter la troncature à grande
  taille de police.

## 8. Sécurité & RGPD

⚠️ **Point à ne pas sous-estimer : ce sont des données subjectives de santé, synchronisées.**

- Elles remontent dans le cloud (Supabase), comme les pas de PAS-01. La fiche Play déclare **déjà**
  une « donnée de santé transmise hors de l'appareil » depuis PAS-01 : cette US **n'ajoute pas de
  nouvelle catégorie** à déclarer, mais la **politique de confidentialité doit mentionner** l'humeur,
  l'énergie et le stress. À intégrer au texte **avant** la relecture juridique, qui est sur le chemin
  critique de LANCE-00.
- **Aucun lien avec Health Connect** : rien n'est lu ni écrit côté HC, la déclaration « Health apps »
  est donc inchangée (4 types de données, pas 5).
- **Export RGPD** : ajouter `daily_wellbeing` à la liste explicite de
  [data-export.ts](../../../../apps/mobile/src/lib/data-export.ts#L29). Une table absente de cette
  liste est une donnée non exportable — non-conformité.
- **Suppression de compte** : couverte par la cascade FK, à vérifier en recette et non à supposer.

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| Aucun check-in jamais fait | Widget en état vide invitant, historique en état vide explicite. Aucune courbe. |
| Un seul jour renseigné | Pas de courbe (un point n'est pas une tendance) : afficher la valeur. |
| Check-in partiel (1 indicateur) | Accepté, stocké, affiché ; la courbe des autres indicateurs a un trou ce jour-là. |
| Deux check-ins le même jour | Le second **met à jour** la ligne (index unique partiel). |
| Poids déjà saisi ailleurs aujourd'hui | Champ pré-rempli ; l'enregistrement **met à jour** l'entrée existante, n'en crée pas une 2ᵈᵉ. |
| Rattrapage hors fenêtre (avant J-6) | Refusé (D4), avec un message explicite — pas un échec silencieux. |
| Date future | Impossible : jamais proposée. |
| Changement de fuseau / voyage | `log_date` = jour civil **local** au moment de la saisie. Une ligne déjà écrite n'est pas recalculée. |
| Hors-ligne total | Écriture locale, remontée à la reconnexion. Aucun blocage, aucun message d'erreur. |
| Sync rule non déployée | Les données restent locales et **ne remontent jamais** — panne silencieuse. D'où la DoD. |

## 10. Definition of Done

- [ ] D1 → D6 arbitrés par Florian ou Damien.
- [ ] Migration table + **migration de publication `powersync`**, poussées via `npm run db:push`.
- [ ] Migration **cochée** dans [supabase/MIGRATIONS.md](../../../../supabase/MIGRATIONS.md).
- [ ] `npm run db:types` rejoué, `database.types.ts` à jour.
- [ ] **Sync rule PowerSync déployée à la main** sur l'instance et vérifiée (une donnée écrite sur
      l'appareil A réapparaît sur l'appareil B, ou au moins dans la base cloud).
- [ ] Table déclarée dans [schema.ts](../../../../apps/mobile/src/powersync/schema.ts).
- [ ] Widget `wellbeing` en `'always'`, ajouté **en fin** de `HOME_WIDGET_IDS`, 3 formes.
- [ ] `daily_wellbeing` ajoutée à l'export RGPD.
- [ ] i18n FR + EN complètes, **15 libellés de niveaux** inclus, zéro chaîne en dur.
- [ ] Briques de calcul **pures et testées** dans `packages/shared` (agrégats, moyennes, trous).
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` verts.
- [ ] Roadmap 1.24 → ✅.

## 11. Critères d'acceptation (recette device)

1. Depuis l'accueil, un check-in complet se fait en **≤ 10 s**, chronomètre en main. Si c'est plus
   long, le rituel est raté et il faut réduire, pas expliquer.
2. Rouvrir le check-in le même jour affiche les valeurs déjà saisies et permet de les corriger.
3. Un check-in partiel (énergie seule) s'enregistre sans erreur.
4. Le poids saisi dans le check-in apparaît dans la courbe de poids existante — **une seule** entrée.
5. En mode avion : saisie possible, données présentes après redémarrage de l'app, remontée au retour
   du réseau.
6. La série (streak) **ne bouge pas** après un check-in seul (D5).
7. L'historique montre un trou, pas un zéro, pour un jour non renseigné.
8. TalkBack annonce chaque niveau avec son libellé et l'état sélectionné.
9. Le widget est visible pour un utilisateur n'ayant activé que la **nutrition**.
10. À grande taille de police système, aucun libellé tronqué.
11. L'export RGPD contient les lignes de bien-être.
