---
id: CONS-01
titre: "Le Conseil des trois — les deux issues d'une contradiction, chiffrées"
roadmap: [7.34]
catalogue: []
etape: recette
branche: dev
maj: 19/09/2026
---

# US CONS-01 — Le Conseil des trois

> Seconde et dernière US du **lot IA** de la salve « carnet d'innovation » du 13/09/2026
> (idée **6**), après [NARR-01](narr01-narration-dossier.md).
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, 15/09/2026).

## 1. Le problème

GUID-01 a livré la **carte de contradiction** : quand l'objectif principal dit « prise de masse » et
la nutrition « sèche », l'accueil le dit, et propose deux issues de poids égal — aligner l'un, ou
aligner l'autre.

Mais **elle ne montre aucun chiffre**. On demande d'arbitrer entre deux options dont on ignore ce
qu'elles coûtent : combien de calories par jour, quel poids dans deux mois, quelle progression de
force. Or [`goal-conflicts.ts`](../../../../packages/shared/src/goal-conflicts.ts) l'écrit noir sur
blanc : l'arbitrage suppose « un moteur de compromis qui n'existe pas ».

Il existe désormais — LABO-01 l'a construit sans le nommer ainsi
([`lab-composer.ts`](../../../../packages/shared/src/lab-composer.ts) : projection de force avec
fourchette, cible calorique, poids à 8 semaines, protéines, charge, croisements). Cette US le branche
sur la carte.

## 2. Ce que fait la fonctionnalité

Sur la carte de contradiction, un lien **« Voir les chiffres »** ouvre le Conseil : chaque pilier
concerné dit sa position avec **ses** chiffres, puis les **deux mêmes issues** que la carte
proposait déjà s'affichent **chiffrées** — cible calorique, poids attendu à 8 semaines, protéines,
progression de force avec sa fourchette, et les tensions que chaque voie crée.

Les deux boutons d'action restent **exactement ceux de la carte** : cette US ne change rien à ce qui
s'écrit, elle éclaire le choix.

**Hors périmètre, explicitement :**

- **la règle `enduranceVsMass`** — voir D2 : ses deux issues changent des *intentions* dont la
  conséquence chiffrée n'est pas calculable aujourd'hui ;
- **toute nouvelle écriture** : les deux actions sont celles de GUID-01, inchangées ;
- **une troisième voie** : le moteur ne compose pas d'option intermédiaire, il chiffre les deux qui
  existent ;
- **toute projection de chrono ou d'allure** (voir R4) ;
- **la mémoire du choix** : ce qui est déjà stocké par GUID-01 suffit.

## 3. Surfaçage (ADR-007)

| Surface | Ce qui apparaît |
|---|---|
| Carte de contradiction (accueil) | Un lien « Voir les chiffres », **sur la règle chiffrable seulement** (D2) |
| Feuille « Conseil » | Les voix des piliers, puis les deux issues chiffrées, puis les deux actions de la carte |
| Résumé IA (optionnel) | Le même bloc que NARR-01, **avec le même garde-fou**, si le consentement est donné |

**Aucun widget d'accueil nouveau, aucune notification.**

## 4. Décisions de cadrage

| # | Question | Décision |
|---|---|---|
| **D1** | D'où viennent les chiffres ? | **De `composeLab`**, donc de `projectWhatIf` (DASH-01), `projectSbd` (MUSCPWR-01), `targetCalories` et `objectiveCalorieDelta` (MN-04), MN-06 pour les protéines, META-19 pour la charge. **Aucun coefficient neuf.** |
| **D2** | Les deux règles de contradiction ? | **Non : `bulkVsCut` seulement.** Les deux issues d'`enduranceVsMass` changent l'objectif de course ou l'objectif principal, sans conséquence chiffrable : il faudrait RN-17 (volume de course × déficit), que le catalogue donne « non construit ». Chiffrer quand même reviendrait à inventer un seuil. La carte reste alors celle de GUID-01, sans lien. |
| **D3** | Le Conseil peut-il proposer une troisième voie ? | **Non.** Composer un compromis intermédiaire supposerait de savoir pondérer deux intentions ; personne ne sait le faire, et l'app n'a pas à trancher à la place de quelqu'un. |
| **D4** | Que fait le bouton, alors ? | **Exactement ce qu'il faisait** (GUID-01). Rien n'est ajouté au chemin d'écriture : une US qui éclaire un choix ne doit pas en modifier les conséquences. |
| **D5** | L'IA ? | **Le résumé de NARR-01, réutilisé tel quel**, garde-fou compris. Le Conseil est un dossier de plus ; le modèle le raconte, il ne le calcule pas. |
| **D6** | Et si les données manquent (pas de pesée, pas de dépense de référence) ? | ⚠️ **Décision révisée à l'implémentation (19/09)** : le lien apparaît, et **la feuille dit** qu'il n'y a pas de quoi chiffrer. Masquer le lien depuis l'accueil obligeait celui-ci à charger **tout le contexte du Labo** — poids, dépense, pente de force, charge — pour un panneau que personne n'a encore ouvert, et sur l'écran le plus sensible de l'app. Une phrase explicite coûte moins cher qu'une absence inexpliquée. |

## 5. Règles métier

**R1 — Les deux issues sont celles de la carte.** `keepMainGoal` = la nutrition passe en surplus ;
`keepPillarGoal` = l'objectif principal s'aligne sur le déficit. Le Conseil projette **ces deux
écritures-là**, pas des variantes.

**R2 — Chaque chiffre vient d'un moteur déjà livré** (D1). Le Conseil n'en calcule aucun lui-même :
il appelle `composeLab` deux fois, avec les doses de chaque issue.

**R3 — Les fourchettes sont affichées comme telles.** La projection de force porte une borne basse
et une borne haute ; les montrer en un seul nombre transformerait une estimation en promesse.

**R4 — Aucune projection d'allure ni de chrono.** La maquette du 13/09 en affichait
(« 19:35–20:10 ») : **aucun calcul validé du dépôt ne relie une dose à un temps de course**, et
LABO-01 a déjà refusé exactement ça. Écart assumé et documenté.

**R5 — Les voix parlent au nom des piliers actifs seulement.** Décision H : un pilier désactivé n'a
pas d'avis à donner.

**R6 — Les tensions sont dites.** Les croisements rendus par `composeLab` (déficit sur semaine
chargée, protéines basses, charge à risque) sont affichés **sous l'issue qui les crée** — c'est ce
qui distingue un conseil d'un argumentaire.

**R7 — i18n FR + EN**, aucune chaîne en dur ; le moteur ne rend que des identifiants.

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Contradiction `enduranceVsMass` | Carte de GUID-01 telle quelle, **pas de lien** (D2) |
| Aucune pesée, ou TDEE inconnu | La feuille s'ouvre et dit « pas encore de quoi chiffrer » (D6) |
| Pas d'historique de force | Le Conseil s'affiche **sans** la ligne de force ; le reste tient |
| Pilier course inactif | Deux voix au lieu de trois (R5) |
| Règle rejetée (« ne me correspond pas ») | La carte disparaît, donc le Conseil aussi |
| Consentement IA absent | Pas de bouton « Résumer » — le Conseil reste entier |

## 7. i18n (FR + EN)

Espace de clés `council.*`.

| Clé | FR | EN |
|---|---|---|
| `council.open` | « Voir les chiffres » | “See the numbers” |
| `council.title` | « Le conseil des trois » | “The council of three” |
| `council.subtitle` | « Ce que chaque pilier a à dire, et ce que coûte chaque issue. » | “What each pillar has to say, and what each path costs.” |
| `council.voices` | « Les voix » | “The voices” |
| `council.options` | « Les deux issues, chiffrées » | “Both paths, with numbers” |
| `council.horizon` | « Sur {{weeks}} semaines » | “Over {{weeks}} weeks” |
| `council.kcal` | « {{value}} kcal/jour » | “{{value}} kcal/day” |
| `council.weight` | « {{value}} kg de poids » | “{{value}} kg of body weight” |
| `council.protein` | « {{value}} g de protéines/jour » | “{{value}} g of protein/day” |
| `council.strength` | « Force : {{delta}} kg ({{low}} à {{high}}) » | “Strength: {{delta}} kg ({{low}} to {{high}})” |
| `council.noStrength` | « Pas encore assez d'historique pour projeter la force. » | “Not enough history yet to project strength.” |
| `council.tensions` | « Ce que ça tend » | “What it strains” |
| `council.noPace` | « Aucun chrono projeté : aucun calcul validé ne relie une dose à un temps de course. » | “No race time projected: no validated calculation links a dose to a race time.” |
| `council.voice.<id>` | voir le moteur | idem |

## 8. Comportement offline

**Tout est local.** Les deux projections se calculent sur l'appareil, à partir de données déjà
synchronisées. Seul le résumé IA facultatif demande le réseau.

## 9. Accessibilité

- Le lien d'ouverture est un bouton (≥ 48 dp), pas un texte souligné décoratif.
- Chaque issue est un bloc lisible d'un tenant par TalkBack : titre, chiffres, tensions.
- Les fourchettes sont annoncées en toutes lettres (« de 2,5 à 7 kg »), jamais par un tiret seul.
- À 1,5× de police, les deux issues s'empilent sans troncature.

## 10. Critères de recette (device)

1. Déclarer « Prise de masse » en objectif principal et « Sèche » en nutrition : la carte apparaît,
   **avec** le lien « Voir les chiffres ».
2. Le Conseil montre deux voix au moins, chacune avec un chiffre.
3. Les deux issues affichent : calories/jour, poids à 8 semaines, protéines, et la force **avec sa
   fourchette** quand l'historique le permet.
4. **Aucun chrono, aucune allure** n'est projeté nulle part.
5. Les tensions apparaissent sous l'issue qui les crée.
6. Choisir une issue écrit **exactement** ce que la carte écrivait avant cette US (vérifier le
   réglage modifié dans l'écran d'origine).
7. « Cette règle ne me correspond pas » fait toujours disparaître la carte.
8. Contradiction course ↔ masse (semi ou marathon + prise de masse) : carte **sans** lien.
9. Compte sans pesée : la feuille s'ouvre et dit qu'il n'y a pas de quoi chiffrer (aucune colonne vide).
10. Avec consentement IA : « Résumer » apparaît dans le Conseil et respecte le garde-fou de NARR-01.
11. Mode avion : le Conseil s'affiche entier (seul le résumé échoue).
12. FR et EN ; TalkBack lit chaque issue d'un tenant ; à 1,5× rien n'est coupé.
