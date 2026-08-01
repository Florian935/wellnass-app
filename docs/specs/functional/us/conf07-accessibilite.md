---
id: CONF-07
titre: "Accessibilité — solde des non-conformités WCAG AA"
roadmap: [9.11, 9.12]
catalogue: []
etape: recette
branche: fix/conf07-accessibilite
maj: 30/07/2026
---

# US CONF-07 — Accessibilité : solde des non-conformités WCAG AA

> **Dernier chantier de code du P0** avant publication, gardé en dernier délibérément : un balayage
> d'accessibilité refait après chaque nouvel écran aurait été du travail perdu.
>
> ⚠️ **Cette US n'est pas un audit neuf.** Une première passe a été livrée le 30/07/2026
> (`fix/theme-contraste-et-flash`) : elle a corrigé `textMuted`, `accent` et introduit le token
> `borderStrong`. **Cette US solde ce qui restait — et ce que cette passe avait manqué.**

## 0. Ce que le nouvel audit a trouvé (30/07/2026)

La première passe n'a mesuré que **trois paires texte/fond**. En rejouant l'audit sur **toutes** les
paires réellement utilisées, **5 non-conformités subsistent** — dont **3 en thème clair, contrairement
à ce qu'affirment la roadmap 9.12 et le CHANGELOG du 30/07** (« le clair passe désormais AA »).

Méthode : calcul WCAG 2.1 (luminance relative) sur [colors.ts](../../../../apps/mobile/src/theme/colors.ts),
sans device. Le seuil dépend de l'usage réel du token, vérifié par lecture du code — **4,5 si le token
sert de couleur de texte, 3,0 s'il ne sert qu'à peindre une donnée ou une limite de composant**.

### 0.1 Thème clair — 3 non-conformités **non documentées jusqu'ici**

| Rôle | Valeur | Paire | Mesuré | Seuil | Pourquoi ce seuil |
|---|---|---|---|---|---|
| `success` | `#7c8a5b` | / `background` | **3,23** | 4,5 | Employé **comme texte** : « Compte créé » ([sign-in](../../../../apps/mobile/src/app/(auth)/sign-in.tsx)), « Objectif atteint » ([steps](../../../../apps/mobile/src/app/steps.tsx)), [WeightGoalCard](../../../../apps/mobile/src/components/WeightGoalCard.tsx), suggestion de [CurrentSetCard](../../../../apps/mobile/src/components/workout/CurrentSetCard.tsx). |
| `warnText` | `#a97b1f` | / `warn` | **3,19** | 4,5 | Le nom dit « text », et c'en est : titre + message + bandeau de [DeficitVolumeAlertCard](../../../../apps/mobile/src/components/dashboard/DeficitVolumeAlertCard.tsx), joker de [StreakCard](../../../../apps/mobile/src/components/dashboard/StreakCard.tsx), [GoalCard](../../../../apps/mobile/src/components/goals/GoalCard.tsx). Également **3,29 / page** et **3,65 / surface**. |
| `amber` | `#cc9544` | / `background` | **2,29** | 3,0 | Couleur de **donnée** (barre glucides de [NutritionSummaryCard](../../../../apps/mobile/src/components/dashboard/NutritionSummaryCard.tsx), [MicroCoverageGrid](../../../../apps/mobile/src/components/nutrition/MicroCoverageGrid.tsx), [MacroTriple](../../../../apps/mobile/src/components/nutrition/MacroTriple.tsx)). Échoue **même au seuil abaissé de 3,0** — c'est la plus nette des cinq. |

### 0.2 Thème sombre — 2 non-conformités **déjà connues, jamais tranchées**

| Rôle | Paire | Mesuré | Seuil | Statut |
|---|---|---|---|---|
| `accentText` `#ffffff` | / `accent` `#dd6e40` | **3,29** | 4,5 | 🔴 Touche le libellé de **chaque bouton plein**, dans le **mode par défaut** de l'app. C'est la plus grave des cinq par sa portée. |
| `accent` `#dd6e40` | / `surface` `#30271e` | **4,45** | 4,5 | 🟠 À **0,05** du seuil. |

### 0.3 Dynamic Type (9.11) — **rien à faire, et c'est vérifié**

41 écrans capturés à `font_scale` 1,5× le 30/07/2026 : **aucune troncature**, uniquement du reflux
attendu. Le comportement RN par défaut suffit. Cette US **ne pose donc pas** de `maxFontSizeMultiplier`
en masse — ce serait *dégrader* l'accessibilité (brider l'agrandissement) pour satisfaire une case.
Le garde-fou reste posé **ponctuellement**, là où il existe déjà et où il est justifié : sur une
image partagée à taille fixe (`ShareCard`) et sur un libellé de tuile calibré (`StreakCard`, 1,3).

## 1. Périmètre

**Dans le périmètre** — corriger les 5 paires ci-dessus, dans la palette et **uniquement** dans la
palette. Aucune modification écran par écran.

**Hors périmètre** :
- Le rétro-maquettage des écrans livrés (tranché au CHANGELOG du 30/07 : les écrans réutilisant le
  système de composants n'en ont pas besoin).
- Les lecteurs d'écran / TalkBack : déjà couverts par les critères de recette des US individuelles.
- Les zones de touche ≥ 48 dp : traitées par UX-LOT-01 (roadmap 7.18).

## 2. Règles de correction

**R1 — Teinte et saturation sont conservées.** Chaque correctif est un pur assombrissement en HSL.
L'identité chaude du produit ne change pas. C'est la règle qu'avait suivie la première passe ; on la
garde pour que les deux moitiés du correctif se ressemblent.

**R2 — Le seuil suit l'usage, pas le nom.** Un token qui ne peint qu'une donnée relève de WCAG 1.4.11
(3,0), pas de 1.4.3 (4,5). C'est pourquoi `amber` est jugé à 3,0 — et échoue quand même.

**R3 — `success` et `chartGreen` divergent.** Ils partagent aujourd'hui `#7c8a5b`. `success` sert de
**texte** (4,5) et doit descendre à `#66714b` ; `chartGreen` ne peint que des **courbes** (3,0) et
passe déjà à 3,23. Les assombrir tous les deux noircirait les graphes sans aucun gain. Ce sont déjà
**deux tokens distincts** : la divergence ne coûte rien, il suffit de ne toucher qu'à l'un.

**R4 — `border` n'est toujours pas monté à 3:1.** Règle héritée de la première passe, reconduite :
WCAG 1.4.11 vise les limites de composants, pas les séparateurs décoratifs.

## 3. Valeurs proposées

Calculées par recherche de l'assombrissement **minimal** qui franchit le seuil.

| Rôle | Thème | Avant | Après | Ratio | Contrôle |
|---|---|---|---|---|---|
| `success` | clair | `#7c8a5b` | **`#66714b`** | 3,23 → **4,53** | / surface **5,02** |
| `warnText` | clair | `#a97b1f` | **`#8a6419`** | 3,19 → **4,52** | / surface **5,16** |
| `amber` | clair | `#cc9544` | **`#b47f31`** | 2,29 → **3,03** | / surface **3,36** |
| `accentText` | sombre | `#ffffff` | **`#1c150e`** | 3,29 → **5,48** | = le fond sombre |
| `accent` | sombre | `#dd6e40` | *voir §4* | 4,45 | — |

## 4. 🔴 Deux décisions qui ne m'appartiennent pas

**D1 — `accentText` en sombre : le texte des boutons pleins passe du blanc au brun foncé.**
C'est **le** changement visible de cette US : chaque bouton principal de l'app, en mode sombre,
troque un libellé blanc contre un libellé brun très foncé sur fond terracotta. Le ratio passe de
3,29 à **5,48**. L'alternative — assombrir `accent` — changerait **la couleur signature du produit**,
ce qui est pire. Mais le résultat doit être vu avant d'être acté. **→ Damien / Florian.**

**D2 — `accent` / `surface` en sombre à 4,45, soit 0,05 sous le seuil.** Trois options :
1. **Ne rien faire** et le documenter comme écart assumé (0,05 est sous le bruit de l'arrondi).
2. Éclaircir `accent` en sombre — mais il devient alors plus clair que la version claire.
3. Assombrir `surface` en sombre de deux points — touche **toutes** les cartes.
   *Ma recommandation : option 1.* L'accent sur surface sert des libellés accentués, pas du corps de
   texte, et les deux autres options coûtent plus qu'elles ne rapportent. **→ Damien / Florian.**

## 5. i18n

**Aucun impact.** Cette US ne touche aucune chaîne : le diff est un fichier de constantes de couleur.

## 6. Comportement offline

**Aucun impact.** La palette est une constante du bundle JS — aucune lecture PowerSync, aucune
migration, aucune sync rule. Le correctif s'applique hors ligne comme en ligne.

## 7. Critères de recette

- [ ] 1. **Thème sombre, écran avec un bouton plein** (« Démarrer la séance ») : le libellé est
      lisible sans effort. C'est le critère de la décision D1 — s'il déplaît, D1 est à rejouer.
- [ ] 2. Thème **clair**, dashboard : le message d'alerte de volume/déficit se lit sans forcer.
- [ ] 3. Thème **clair**, nutrition : la barre **glucides** (ambre) se distingue du fond crème.
- [ ] 4. Thème **clair**, écran Pas : « Objectif atteint » en vert se lit sans forcer.
- [ ] 5. Thème **clair**, création de compte : le message de succès se lit sans forcer.
- [ ] 6. **Le test qui compte** : l'app ne paraît **pas** plus terne. Si l'identité chaude a viré au
      boueux, la règle R1 a été mal appliquée — c'est un rejet.
- [ ] 7. Les **graphes** n'ont pas noirci (vérifie R3 : `chartGreen` ne devait pas bouger).
- [ ] 8. Mode avion : sans objet, mais vérifier que rien n'a régressé au démarrage.
- [ ] 9. `font_scale` 1,5× sur 3 écrans au hasard : toujours aucune troncature (non-régression 9.11).

## 8. Vérification automatisable

Le calcul se refait **sans device**. Le plan prévoit d'ancrer l'audit dans un **test unitaire**
(`packages/shared`) qui parcourt les paires de §0 et échoue si l'une repasse sous son seuil — pour
qu'une future retouche de palette ne puisse pas rouvrir silencieusement le trou. C'est le vrai
livrable durable de cette US : la première passe a échoué **parce que rien ne mesurait**.
