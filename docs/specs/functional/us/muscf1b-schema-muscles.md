---
id: MUSC-F1b
titre: "Muscles ciblés sur schéma corporel"
roadmap: [6.2]
catalogue: []
etape: validation
branche: feature/muscf1b-schema-muscles
maj: 30/07/2026
---

# US MUSC-F1b — Muscles ciblés sur schéma corporel

> Sujet **distinct** des GIF de démonstration abandonnés (roadmap 6.1) : celui-ci reste ouvert.
> Roadmap **6.2**, P1.

## 0. 🔴 Le point dur n'est pas le dessin — c'est la granularité de la donnée

La formulation d'origine dit « corps humain SVG avec **muscles** travaillés en évidence ». Or la base
ne connaît **que six groupes** ([exercise.ts](../../../../packages/shared/src/exercise.ts)) :

```
chest · back · legs · shoulders · arms · core
```

`musclesSecondary` puise dans **la même liste** — c'est un second groupe, pas un muscle fin.

**Conséquence à regarder en face** : un schéma anatomique détaillé — biceps distinct du triceps,
quadriceps distinct des ischio-jambiers, deltoïde antérieur distinct du postérieur — **afficherait une
précision que la donnée n'a pas**. Sur un curl, il faudrait éclairer « arms » : le dessin allumerait
donc *tout* le bras, triceps compris. Un utilisateur qui connaît son anatomie y lirait une **erreur**.

Deux voies s'ouvrent, et **il faut choisir avant de dessiner** :

| | **Voie A — schéma à 6 zones** | **Voie B — enrichir la donnée d'abord** |
|---|---|---|
| Ce qu'on dessine | 6 zones larges, franchement stylisées | anatomie fine, ~15-20 muscles |
| Donnée | **celle qui existe** | nouvelle table + **re-tagger toute la bibliothèque** |
| Honnêteté | ✅ le dessin ne promet que ce qu'on sait | ✅ mais seulement une fois la donnée saisie |
| Coût | ~6-8 h | ~6-8 h **+ un travail de coach sur chaque exercice** |
| Migration | **aucune** | oui, + sync rules à redéployer |
| Risque | le schéma paraît grossier | **la bibliothèque est vide** (CONTENU-01) : re-tagger quoi ? |

→ **Ma recommandation : voie A.** La voie B fait dépendre une US P1 d'un travail de contenu qui n'a
même pas commencé (CONTENU-01 attend encore ses programmes). Un schéma à 6 zones **assumé comme tel**
— silhouette stylisée, pas planche d'anatomie — est utile, honnête, et n'empêche pas la voie B plus
tard. **→ Décision Damien / Florian.**

Le reste de cette spec décrit la **voie A**.

## 1. Périmètre

**Dans le périmètre** — une silhouette (face + dos) où les groupes sollicités s'éclairent, à trois
endroits :
1. **Fiche d'exercice** — le groupe primaire, et les secondaires dans un ton atténué.
2. **Aperçu d'une séance** (avant démarrage) — union des groupes de tous les exercices.
3. **Bilan hebdomadaire** — intensité par groupe sur la semaine (voir R3).

**Hors périmètre** : l'animation du mouvement (c'est 6.1, abandonné), la vue latérale, la distinction
gauche/droite, et toute mention de muscle nommé individuellement.

## 2. Règles

**R1 — Deux niveaux d'emphase, pas plus.** Primaire = accent plein ; secondaire = **le même accent à
~35 % d'opacité**. Introduire une troisième couleur rendrait le schéma illisible à la taille où il
s'affiche.

**R2 — Un groupe non sollicité n'est pas « éteint », il est neutre.** Il garde la couleur de
silhouette. Le schéma montre ce qui travaille, il n'accuse pas ce qui ne travaille pas.

**R3 — Au bilan hebdomadaire, l'échelle est relative à la semaine de l'utilisateur.** Le groupe le
plus sollicité = opacité pleine ; les autres au prorata du **tonnage** (unité déjà calculée par
`weekly-review`). Une échelle absolue n'aurait aucun sens : 20 séries de jambes ne se comparent pas à
20 séries de bras.

**R4 — `core` et `back` se recouvrent visuellement.** Sur une silhouette de face, `core` occupe
l'abdomen ; sur le dos, `back` occupe la même hauteur. Les deux vues sont donc **nécessaires**, pas
décoratives — sans la vue de dos, `back` n'a nulle part où s'afficher.

**R5 — Le schéma est un complément, jamais le seul porteur d'information.** La liste textuelle des
groupes reste affichée à côté. C'est ce qui rend l'écran utilisable sans voir le dessin (§5).

## 3. Rendu

`react-native-svg` est **déjà présent** (utilisé par `ShareCard` et les graphes) — aucune dépendance
nouvelle. Le schéma est un composant `<BodyMap groups={...} />` avec 12 tracés (6 groupes × 2 vues),
écrits à la main, sans asset externe : il doit fonctionner **hors ligne** et suivre le thème.

⚠️ **Ne pas importer une planche anatomique trouvée en ligne** : question de licence, et cela
ramènerait le problème de granularité de §0.

## 4. i18n

Aucune chaîne neuve **sur le schéma lui-même** — les noms de groupes sont déjà traduits
(`muscles.chest`, etc.). Deux ajouts pour l'accessibilité seulement :
- `bodyMap.a11yLabel` — « Schéma corporel : {{liste}} sollicités » / « Body map: {{list}} worked ».
- `bodyMap.frontBack` — « Face » / « Dos », « Front » / « Back ».

## 5. Accessibilité

Le schéma est **purement visuel** : il doit donc porter un `accessibilityLabel` qui énonce les groupes
(`bodyMap.a11yLabel`), et **la liste textuelle reste à l'écran** (R5). C'est aussi la réponse au
daltonisme : l'information passe par le texte, la couleur ne fait que l'appuyer.

Contraste : la couleur de remplissage doit tenir **3:1 contre la silhouette** — non textuel, WCAG
1.4.11. À vérifier avec la palette **issue de CONF-07**, pas l'actuelle.

## 6. Comportement offline

**Total.** Tracés SVG en dur dans le bundle, données lues depuis PowerSync local. Aucun réseau, aucune
image distante, **aucune migration, aucune sync rule**.

## 7. Critères de recette

- [ ] 1. Fiche d'un développé couché : **pectoraux** en plein, **épaules/bras** en atténué.
- [ ] 2. Fiche d'un exercice sans secondaires : un seul groupe éclairé, aucun résidu.
- [ ] 3. Aperçu d'une séance complète : l'union des groupes, sans doublon d'intensité.
- [ ] 4. Bilan hebdo : le groupe le plus travaillé est le plus marqué (R3).
- [ ] 5. Semaine **vide** : silhouette neutre, **pas** d'écran cassé ni de division par zéro.
- [ ] 6. Vue de **dos** présente et atteignable — sans elle, `back` ne s'affiche nulle part (R4).
- [ ] 7. Thème **clair** et **sombre** : la silhouette reste lisible dans les deux.
- [ ] 8. **TalkBack** énonce les groupes sollicités ; la liste textuelle est là (R5).
- [ ] 9. Mode avion : le schéma s'affiche (aucune ressource distante).
- [ ] 10. En **EN** : « Front » / « Back » et l'annonce d'accessibilité sont en anglais.
- [ ] 11. **Le critère qui juge la voie A** : montrer la fiche d'un curl biceps à quelqu'un qui
      connaît l'anatomie. S'il dit « c'est faux, ça allume aussi le triceps », c'est que le dessin
      est **trop détaillé** pour la donnée — il faut styliser davantage, pas enrichir la base.

## 8. Ce que cette US ne prétend pas faire

Elle n'apporte **aucune** précision anatomique nouvelle. Elle rend visible, d'un coup d'œil, une
information déjà présente sous forme de liste. Si l'attente réelle est « savoir quel muscle précis
travaille », alors c'est la **voie B** qu'il faut ouvrir — et elle commence par du travail de contenu,
pas par du code.
