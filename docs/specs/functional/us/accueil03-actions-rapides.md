---
id: ACCUEIL-03
titre: "Actions rapides — les gestes du quotidien à un tap"
roadmap: [7.25]
catalogue: []
etape: recette
branche: feature/accueil-refonte
maj: 09/09/2026
---

# ACCUEIL-03 — Actions rapides

> Troisième des six US de la refonte de l'accueil (lot unique, `feature/accueil-refonte`).

## 1. Le défaut, chiffré

Sur les cinq gestes réellement quotidiens, **un seul** était accessible en un tap depuis l'accueil :

| Geste | Avant | Après |
|---|---|---|
| Démarrer la séance | **1 tap** (bouton du widget) | 1 tap (zone 1) |
| Ajouter un repas | 1 tap, mais **toujours le petit-déjeuner** | 1 tap, le bon repas |
| Démarrer une course | changement d'onglet + 1 tap | **1 tap** |
| Se peser | **3 taps** (Muscu › Progression › Mensurations) | **1 tap** |
| Check-in bien-être | **3 taps** (Réglages › Suivi › Bien-être) | **1 tap** |

## 2. Ce qui est livré

Une rangée de **quatre pastilles** (zone 2, 64 px), fixe, sous la carte « maintenant » :
`+ Repas` · `Course` · `Pesée` · `Bien-être`.

### 2.1 Règles

- **R1 · Quatre, pas cinq.** Sur un cadre de 392 px, quatre cibles font 82 px de large — largement
  au-dessus des 44 dp exigés (navigation-ux §8). Une cinquième descendrait à ~64 px : encore
  acceptable en largeur, mais le libellé passerait sur deux lignes et deviendrait illisible aux
  grandes tailles de police système.
- **R2 · Filtrées par piliers actifs** (décision H — intégration sans imposition). Proposer
  « Course » à quelqu'un qui n'a pas activé le pilier serait lui imposer une fonctionnalité qu'il a
  explicitement écartée. `Pesée` et `Bien-être` sont **transverses** : ils n'appartiennent à aucun
  pilier, comme les pas.
- **R3 · Le repas suit l'heure** (`mealForHour`, cf. ACCUEIL-02) : le libellé de la pastille change
  avec le moment de la journée (« Petit-déj » → « Déjeuner » → « Dîner »).
- **R4 · La pastille du moment prend l'accent.** Quand la carte « maintenant » réclame une saisie de
  repas, la pastille correspondante passe en plein accent : l'écran a **une** action mise en avant,
  et c'est la même partout.
- **R5 · Moins de deux pastilles → la rangée disparaît.** Un utilisateur « musculation seule » n'a
  que les deux transverses ; en dessous, ce serait un bouton déguisé en barre.

## 3. i18n

`home.quick.*`, FR et EN. `maxFontSizeMultiplier` borné à 1.2 : la pastille ne peut pas s'élargir,
mieux vaut borner la mise à l'échelle que laisser rogner le libellé.

## 4. Offline

Aucune donnée réseau. Toutes les destinations sont des écrans locaux.

## 5. Cas limites

| Cas | Comportement |
|---|---|
| Nutrition inactive | pas de pastille repas → 3 pastilles |
| Course inactive | pas de pastille course |
| Muscu seule | 2 pastilles (pesée, bien-être) — la rangée reste affichée |
| Aucun pilier (cas théorique) | la rangée disparaît |
| Police système très grande | libellé sur une ligne, mise à l'échelle bornée |

## 6. Recette

- [ ] Les quatre pastilles sont visibles et chacune mène au bon écran.
- [ ] Le libellé de la pastille repas change selon l'heure (matin / midi / soir).
- [ ] Quand la carte du haut réclame un repas, la pastille correspondante est **en accent**.
- [ ] Désactiver le pilier Course dans les réglages : la pastille « Course » disparaît.
- [ ] Désactiver Nutrition **et** Course : il reste Pesée et Bien-être, la rangée tient.
- [ ] Cibles tactiles confortables à bout de bras (test en salle, gant ou main humide).
