---
id: BIEN-04
titre: "La boucle — la nuit et « malade » changent la forme du jour, la séance et le bilan"
roadmap: [1.33]
catalogue: [BW-02, BW-03]
etape: recette
branche: dev
maj: 01/10/2026
---

# US BIEN-04 — La boucle

> Chantier « pilier Bien-être » — contexte et décisions dans [BIEN-02](bien02-pilier-bien-etre.md).
> Toile : planches « 04b · Aujourd'hui », « 04e · Le contexte dans une sortie » et
> « 05 · Prototype — un matin » de [design/pilier-bien-etre-2026-10/](../../../../design/pilier-bien-etre-2026-10/).
> Plan : [docs/plans/bien04-boucle.md](../../../plans/bien04-boucle.md).

## 1. Le problème

Le check-in était **un relevé** : un matin après une nuit de 5 h 10, l'app le notait… et proposait la
même séance de fractionné, le même score de forme, le même bilan. Le bien-être ne servait à rien
d'autre qu'à lui-même. C'est **la boucle** qui fait du pilier autre chose qu'un journal.

## 2. Ce que fait l'US

Tout ne vaut que **pilier allumé** ; pilier éteint, chaque surface se comporte exactement comme avant.

### 2.1 La forme du jour (TRI-03) connaît la nuit et « malade »

La composante bien-être du score de forme (`classifyWellbeingComponent`) devient **défavorable** aussi
quand la nuit du jour est **courte ou agitée** (`isPoorNight` : moins de 6 h — le même seuil que le
Labo, `SHORT_NIGHT_MINUTES` — ou une qualité de 1-2) ou quand le jour porte l'étiquette **malade**.
Le verdict reste celui de TRI-03 (un seul calcul, le même mot qu'à l'accueil). Une nuit **inconnue
n'est pas une bonne nuit** : `null`, sans effet.

Dans la scène de l'onglet Aujourd'hui : le verdict, et **les raisons du jour** en pastilles (nuit,
énergie, stress de la veille, envie, malade), chacune avec sa flèche **et** son mot.

### 2.2 L'adaptation de séance (CARDIO-UX01) connaît trois signaux de plus

| Signal | Raison | Ce que propose l'adaptation |
|---|---|---|
| étiquette **malade** | `sick` (alerte) | **décaler au lendemain**, intense ou non (une douleur passe devant) |
| **nuit courte ou agitée** | `short_night` (prudence) | même traitement que l'énergie basse : **retirer du volume** sur une séance intense, garder l'échauffement |
| **envie ≤ 2** | `low_motivation` (info) | signalée, **rien ne change** : la version courte se propose dans le pilier |

### 2.3 « Ce que ça change aujourd'hui » (onglet Aujourd'hui)

Pour chaque séance prévue du jour (`buildWellbeingDay`) :

1. **Malade** → « décaler à demain » ;
2. séance **intense** + un signal défavorable (nuit courte ou agitée, énergie ≤ 2, stress de la veille
   ≥ 4 — un seul suffit, comme R4 de TRI-03) → **alléger** ;
3. envie ≤ 2 sans autre signal → **version courte** proposée ;
4. tout au vert → on le dit (« bon jour pour tenter la charge prévue ») ;
5. une séance **déjà adaptée** (Labo, CARDIO-UX01) ne reçoit pas de seconde proposition.

Et pour l'assiette, une note du jour : malade, nuit courte, soirée la veille, journée stressée.

**Rien d'automatique.** « Décaler » et « Alléger » passent par la feuille « ce qui change dans ton
plan » du Labo, qui **nomme** le changement avant de l'écrire. Décaler écrit le report au lendemain
(`reschedulePlannedSession`) ; alléger n'écrit que sur une **course intense** (seule séance qui lit
`adapted_reps_pct`, CARDIO-UX01) — sur une séance de muscu, l'allègement reste un **conseil**, et le
bouton ouvre le pilier.

### 2.4 La ligne « contexte » des bilans

Sur le bilan d'une séance de muscu, d'une sortie, d'une journée nutrition, et sur le détail d'une
séance passée : une ligne **« Ce jour-là »** qui dit l'état du jour (nuit et sa qualité, énergie, envie
— pas pour la nutrition —, étiquettes). Si la nuit était courte ou agitée **et** que le lien du Labo
correspondant a assez de cas (« probable » ou « solide », [BIEN-05](bien05-ce-qui-compte.md)), elle
ajoute **ce que ça fait d'habitude** (« après une nuit courte, ton tonnage baisse en moyenne de 9 %,
sur 11 séances »). Un lien « Ouvrir le journal ».

Elle **explique, elle ne juge pas** : jamais « tu aurais dû ». Rien pilier éteint, rien sans
check-in ce jour-là — une ligne vide n'existe pas.

## 3. Cas limites

| Cas | Comportement |
|---|---|
| Nuit non renseignée | aucun signal de nuit (ni bon ni mauvais) |
| Malade + douleur | la douleur décide (arrêt ou report) |
| Séance déjà adaptée | pas de seconde proposition |
| Allègement d'une séance de muscu | conseil seul, aucune écriture ; le bouton ouvre le pilier |
| Écriture du report ou de l'allègement en échec | message dans la feuille, rien n'est marqué « appliqué » |
| Lien « d'habitude » encore en apprentissage | la ligne contexte ne cite aucun chiffre |
| Pilier éteint | score, adaptation, bilans identiques à avant |

## 4. Offline

Tout est calculé localement à partir des tables déjà synchronisées ; les écritures (report,
adaptation) passent par les repositories existants.

## 5. i18n

FR + EN : `wellbeingHub.today.*` (conseils, feuille, notes de l'assiette), `wellbeingHub.signals.*`,
`wellbeingHub.context.*`, `home.readiness.wellbeing.negative` (reformulée pour inclure nuit et malade),
raisons d'adaptation `sick`, `short_night`, `low_motivation`.

## 6. Ce qui n'est pas fait

- **Une version courte écrite** d'une séance de muscu (aujourd'hui : un conseil) : il faudrait que la
  séance de muscu sache lire une adaptation, comme la course.
- La note de l'assiette ne change pas la cible calorique (volontaire : l'appétit d'un jour malade ne
  se règle pas par une cible).

## 7. Critères d'acceptation

[RECETTES.md](../../../../RECETTES.md) §90 C.
