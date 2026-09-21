---
id: PARTAGE-02
titre: "La carte de partage transparente — à coller sur sa propre photo"
roadmap: [7.35]
catalogue: []
etape: recette
branche: dev
maj: 21/09/2026
---

# US PARTAGE-02 — La carte de partage transparente

> Issue de l'**analyse Strava du 20/09/2026** —
> [analyse-strava-2026-09.md](../../../product/analyse-strava-2026-09.md) §7.6, observation **O21**.
> Étend **PARTAGE-01** (roadmap 7.17, livré, en recette). Demande de Florian le 20/09.
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, cf. FANT-01 et CARDIO-UX02).
>
> ✅ **Étape design franchie** : <https://claude.ai/artifact/Fp7sCrnKZ3YbVink6RBt5U>, planche **5 (le
> partage)** et onglet *Partage* de la planche **10 (prototype jouable)**.

## 1. Le problème

**PARTAGE-01 produit une seule image, et elle est opaque.**
[ShareCard.tsx](../../../../apps/mobile/src/components/share/ShareCard.tsx) dessine une carte carrée
sur `CARD_BG = '#1c130c'`, capturée en PNG par
[share-card-export.ts](../../../../apps/mobile/src/lib/share-card-export.ts). Résultat : on partage
**notre** visuel, tel quel.

**Strava en propose sept, dont une transparente** (O21) : chiffres et tracé sur fond alpha, à coller
par-dessus **sa propre photo** dans une story. C'est la variante la plus utilisée, et c'est la seule
qui laisse l'utilisateur rester l'auteur de son image — on n'impose plus un fond, on ajoute une
couche.

**Le coût est dérisoire** : même composant, fond retiré. `captureRef` est déjà appelé en
`format: 'png', quality: 1` — le PNG porte déjà un canal alpha.

## 2. Ce que fait cette US

1. **Deux variantes** de carte partageable : **Pleine** (l'actuelle, inchangée) et **Transparente**.
2. **Un sélecteur** dans la feuille de partage, avec aperçu — l'aperçu de la transparente est posé
   sur un **damier**, pour qu'on comprenne d'un coup d'œil ce qu'on va obtenir.
3. **La lisibilité garantie** sur n'importe quelle photo (§3.2) — c'est le vrai travail.

**Hors périmètre** : les cinq autres formats de Strava, les destinations nommées (Stories, WhatsApp…
— la feuille de partage de l'OS les propose déjà), et le format vertical 9:16.

## 3. Règles métier

### 3.1 Les variantes

**R1** — Deux variantes, exposées dans cet ordre : **Pleine** (par défaut) · **Transparente**.

**R2** — La variante **Pleine est strictement inchangée**. PARTAGE-01 est en recette : cette US ne
doit rien déplacer de ce qui y est vérifié. Un test de garde compare le rendu de la variante Pleine
avant / après.

**R3** — La variante Transparente porte **les mêmes données** : titre, date, chiffres, tracé,
mention de l'app. Rien de moins, rien de plus.

**R4** — Le **choix ne persiste pas** entre deux partages : on repart de Pleine. Un réglage caché
qui change l'image qu'on envoie est une mauvaise surprise.

### 3.2 🔴 La lisibilité — le seul vrai point dur

**R5** — Sur fond opaque, le contraste est **vérifié et connu** : le commentaire de `ShareCard.tsx`
le documente — texte 15,58 · secondaire 9,34 · accent 5,56 contre `CARD_BG`. Sur fond **transparent**,
le contraste devient **inconnaissable** : l'image d'arrière-plan est celle de l'utilisateur, elle peut
être blanche, claire, chargée.

**R6** — Chaque élément de texte et le tracé portent donc **leur propre lisibilité** :
- un **halo sombre** (ombre portée diffuse, opacité ~0,55, rayon proportionnel à la taille) sous
  chaque texte et sous le tracé ;
- **aucune information portée par la couleur seule**.

C'est la solution de tous les incrustateurs de story, et c'est la seule qui tienne sans connaître le
fond.

**R7** — Le **texte reste clair** (l'app est lisible sur photo sombre comme claire grâce au halo).
Pas de variante « texte foncé » : deux variantes transparentes doubleraient le sélecteur pour un gain
marginal.

### 3.3 L'aperçu

**R8** — L'aperçu de la Transparente s'affiche sur un **damier** (deux gris alternés), la convention
universelle de la transparence. Sans lui, l'utilisateur croit que le fond sera celui de la feuille.

**R9** — Une pastille **TRANSPARENT** en coin de l'aperçu, cohérente avec la convention.

### 3.4 Cas limites

**R10** — **Course sans tracé** (tapis, saisie manuelle) : la variante Transparente reste offerte,
sans tracé — elle devient un bloc de chiffres, ce qui est exactement l'usage sur tapis.

**R11** — Si la capture échoue, le contrat d'erreur existant de PARTAGE-01 s'applique tel quel
(`'unavailable' | 'failed'`) : aucun échec muet.

**R12** — ⚠️ **À vérifier sur appareil** : `react-native-view-shot` ne conserve l'alpha que si la vue
capturée **et son conteneur** sont réellement transparents. Sur Android, un fond de fenêtre opaque
peut aplatir la transparence en noir. Si l'alpha ne passe pas, la variante est **retirée** plutôt que
livrée cassée — c'est le point dur de la recette.

## 4. Modèle de données

**Aucun.** Aucune table, aucune colonne, **aucune migration**, aucune sync rule à redéployer. Tout
est local et éphémère — comme PARTAGE-01.

## 5. Comportement offline

Inchangé : **100 % local, aucun réseau**. La capture et la feuille de partage de l'OS fonctionnent en
mode avion. C'est déjà le contrat de PARTAGE-01
([share-card-export.ts](../../../../apps/mobile/src/lib/share-card-export.ts) : *« 100 % local, aucun
réseau, aucune migration »*).

## 6. i18n — FR + EN

| Clé | FR | EN |
|---|---|---|
| `share.variant.full` | Pleine | Full |
| `share.variant.transparent` | Transparente | Transparent |
| `share.variant.label` | Format | Format |
| `share.variant.transparentHint` | À coller sur ta photo | To place over your photo |

Le mot **TRANSPARENT** de la pastille (R9) reste **non traduit** : c'est un marqueur de convention,
comme sur les outils d'image.

## 7. Critères de recette

- [ ] La feuille de partage propose **deux variantes**, Pleine sélectionnée par défaut.
- [ ] L'aperçu de la Transparente s'affiche sur un **damier**, avec la pastille TRANSPARENT.
- [ ] 🔴 Le PNG exporté est **réellement transparent** : collé sur une photo claire **et** sur une photo sombre, le fond ne s'ajoute pas.
- [ ] Les textes restent **lisibles sur une photo blanche** (halo effectif).
- [ ] Les textes restent lisibles sur une photo **très chargée** (feuillage, foule).
- [ ] Le tracé reste visible sur fond clair.
- [ ] La variante **Pleine est identique** à avant cette US (comparer à une capture de recette PARTAGE-01).
- [ ] Une **course sur tapis** (sans tracé) produit une Transparente correcte, sans trou.
- [ ] Le choix **ne persiste pas** : rouvrir la feuille repart sur Pleine.
- [ ] **Mode avion** : les deux variantes s'exportent.
- [ ] **EN** : les deux libellés sont traduits, la pastille reste « TRANSPARENT ».
- [ ] Depuis une **séance de musculation** aussi (`workout-summary.tsx` utilise le même composant).

## 8. Décisions prises dans cette spec

| # | Décision | Pourquoi |
|---|---|---|
| **D1** | Deux variantes, pas sept | Les cinq autres formats de Strava sont des déclinaisons de mise en page. La transparente est la seule qui change l'**usage**. |
| **D2** | Halo sombre plutôt que plaque de fond (R6) | Une plaque annulerait l'intérêt de la transparence. Le halo est la solution de tous les incrustateurs. |
| **D3** | Une seule variante transparente, texte clair (R7) | Doubler le sélecteur pour un texte foncé coûte plus que ça ne rapporte. |
| **D4** | Le choix ne persiste pas (R4) | Un réglage caché qui change l'image envoyée est une mauvaise surprise. |
| **D5** | Retirer la variante si l'alpha ne passe pas sur Android (R12) | Mieux vaut une fonctionnalité en moins qu'un PNG à fond noir partagé publiquement. |
