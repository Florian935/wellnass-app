---
id: BIEN-05
titre: "Ce qui compte — les croisements Bien-être, un lien du Labo et l'onglet du pilier"
roadmap: [1.34]
catalogue: [BW-04, BW-05, BW-06]
etape: recette
branche: dev
maj: 01/10/2026
---

# US BIEN-05 — Ce qui compte

> Chantier « pilier Bien-être » — contexte et décisions dans [BIEN-02](bien02-pilier-bien-etre.md).
> Toile : planches « 03 · Les croisements » et « 04d · Ce qui compte » de
> [design/pilier-bien-etre-2026-10/](../../../../design/pilier-bien-etre-2026-10/).
> Plan : [docs/plans/bien05-ce-qui-compte.md](../../../plans/bien05-ce-qui-compte.md).

## 1. Le problème — et une règle qui a changé entre la maquette et le code

La planche « Ce qui compte » montrait les croisements (nuit → séance, envie → séances faites…) **dans
l'onglet du pilier**. Entre-temps, le Labo carrefour (LIENS-01, 30/09/2026) a posé la règle : **les
croisements entre piliers vivent au Labo**, un pilier n'en garde qu'un **écho**. Cette US suit la
règle la plus récente :

- les croisements Bien-être **× un autre pilier** deviennent **un lien du Labo** : « Ton état du jour
  pèse-t-il sur tes séances ? », avec sa fiche ;
- l'onglet « Ce qui compte » du pilier garde **l'écho** de ce lien, et ce qui reste **à l'intérieur du
  pilier** (ce qui pèse sur les nuits, la régularité du coucher, les moyennes).

## 2. Le moteur (`packages/shared/src/wellbeing-links.ts`) — local, pur, testé

Neuf croisements, chacun **disponible seulement** si son pilier (ou son module) est activé — sinon il
n'existe pas, ni « à apprendre » ni grisé (décision H) :

| Croisement | Exposé / autre | Mesure | Défavorable si |
|---|---|---|---|
| `nightStrength` | nuit courte ou agitée / non | tonnage relatif à la **médiane du même type de séance** (≥ 3 séances) | plus bas |
| `nightRunning` | idem | allure relative à la **médiane au même effort perçu** (≥ 3 sorties) | plus lent |
| `nightIntake` | idem | apport du jour relatif à la médiane (journées finies) | plus haut |
| `motivationTraining` | envie 1-2 / 4-5 (le 3 ne tranche pas) | séance faite ce jour-là (%) | moins de séances |
| `stressJournal` | stress 4-5 / 1-2 | journal nutrition tenu ce jour-là (%) | moins tenu |
| `trainingMood` | jour d'entraînement / non | humeur du soir | plus basse |
| `alcoholRunning` *(module alcool)* | ≥ 2 verres la veille / 0 | allure à effort égal | plus lent |
| `alcoholNight` *(module, interne)* | ≥ 2 verres / 0 | durée de la nuit suivante | plus courte |
| `caffeineNight` *(module, interne)* | café après 16 h / non | durée de la nuit suivante | plus courte |

Règles (les mêmes que le registre des liens) :

1. **Fenêtre de 90 jours.** Assez pour réunir 8 nuits courtes chez quelqu'un qui en a une par semaine.
2. **Au moins 8 cas de chaque côté** avant de dire quoi que ce soit (« à apprendre », jauge « 5 sur 8 »
   sur le côté le plus maigre) ; **14 de chaque côté** pour « solide » plutôt que « probable ».
3. Sous un **seuil de bruit** nommé par unité (5 %, 5 s/km, 150 kcal, 0,4 point, 15 points de
   pourcentage, 20 min), on dit **« rien de visible »** — une piste écartée se dit aussi.
4. Toujours **le nombre de cas** ; « va souvent avec », jamais « parce que ».
5. Une allure hors de 2 à 20 min/km, une course sans effort perçu, une séance sans tonnage sont
   écartées (erreur de trace, marche, saisie incomplète).

## 3. Le lien du Labo « Ton état du jour pèse-t-il sur tes séances ? »

- Disponible si le pilier Bien-être est activé et au moins un autre pilier actif.
- Ses **lignes** : les croisements « × pilier » (`scope: 'cross'`), chacun à son stade.
- **À découvrir** tant qu'aucun croisement n'a dépassé l'apprentissage (« il faut 8 cas de chaque
  côté », jauge).
- **À régler** quand une piste **défavorable** sur la nuit (`nightStrength`, `nightRunning` ou
  `nightIntake`) tient **et** que la semaine compte **au moins deux nuits courtes ou agitées** : c'est
  là qu'il y a quelque chose à faire. Gestes : ouvrir le pilier, ouvrir Apprendre.
- **Ça tient** sinon — y compris quand une piste existe mais que la semaine ne la déclenche pas
  (« Des liens connus, rien à régler cette semaine. » / « Rien de visible pour l'instant. »).
- **Sa fiche** porte un graphique neuf, **les écarts** (`effects`) : une ligne par croisement, un axe
  zéro, l'écart signé dans son unité, les cas de chaque côté. Des unités différentes n'ont pas
  d'échelle commune : chaque barre est rapportée au **seuil de bruit de son unité** (le seuil remplit
  un tiers de la demi-piste, trois fois le seuil la remplit). Une piste sans lien dit « rien de
  visible », jamais un chiffre qu'on lirait comme un effet.
- Écho : la surface `wellbeing` (l'onglet « Ce qui compte » du pilier).

## 4. L'onglet « Ce qui compte » du pilier

1. **L'écho** du lien du Labo (son état et sa phrase courte), qui ouvre la fiche.
2. **Ce qui pèse sur tes nuits** — `alcoholNight`, `caffeineNight`, si les modules sont allumés.
3. **La régularité du coucher** — l'écart des heures de coucher sur les nuits **lues** (BIEN-06),
   à partir de 5 nuits en 14 jours.
4. **Tes moyennes des 30 derniers jours** — nuit, qualité, énergie, envie, humeur, stress.

## 5. Cas limites

| Cas | Comportement |
|---|---|
| Compte neuf | lien « à découvrir », onglet sans croisement (jauges) |
| Pilier Course éteint | `nightRunning` et `alcoholRunning` n'existent pas |
| Module alcool éteint | aucun croisement alcool |
| Pistes connues mais semaine sans nuit courte | « ça tient » |
| Nuits saisies à la main seulement | pas de régularité du coucher (pas d'heure de coucher) |

## 6. Offline

Calcul local, à la lecture, sur les tables synchronisées (90 jours de check-ins, séances, sorties,
journal). Aucune table neuve, aucune écriture.

## 7. i18n

FR + EN : `lab.links.wellbeing.*` (question, verdicts, courts), `lab.links.rows.wellbeing.*`,
`lab.links.figures.wellbeing.*`, `lab.links.missing.wellbeingCases`, `lab.links.source.wellbeing`,
`lab.links.surfaces.wellbeing`, `lab.links.routes.wellbeing`, `lab.fiche.chart.effects*`,
`wellbeingHub.insights.*`. **Vérifiées par le test-garde** `link-texts-coverage.test.ts`, qui fait
tourner le registre sur des situations couvrant les trois états et les quatre stades de chaque
croisement.

## 8. Ce qui n'est pas fait

- « **Cette règle ne me correspond pas** » (écarter une piste) et la **passerelle vers l'enquête** du
  Labo (« Pourquoi ? ») — prévues sur la planche du découpage, reportées.
- L'**historique figé** du lien (comme `cross_link_weeks` pour les liens hebdomadaires) : le lien est
  recalculé à chaque lecture sur 90 jours.
- Les seuils de bruit sont **à rediscuter en recette** (nommés, pas enfouis).

## 9. Critères d'acceptation

[RECETTES.md](../../../../RECETTES.md) §90 D.
