---
id: NARR-01
titre: "L'IA raconte le dossier d'enquête — et ne peut pas inventer un chiffre"
roadmap: [7.33]
catalogue: []
etape: recette
branche: dev
maj: 19/09/2026
---

# US NARR-01 — La narration du dossier d'enquête

> Première US du **lot IA** de la salve « carnet d'innovation » du 13/09/2026 (idée **5**,
> [analyse](../../../product/analyse-innovation-2026-09.md) §8, décision D3).
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, 15/09/2026).

## 1. Le problème

L'analyse recommandait « L'Enquête » comme première US IA. **L'inventaire du 19/09/2026 montre
qu'elle est déjà livrée** : LABO-01 a construit [`lab-investigations.ts`](../../../../packages/shared/src/lab-investigations.ts)
et l'onglet « Pourquoi ? » — détection de plateau (force, allure, poids), suspects classés par
force, facteurs **écartés** affichés, facteurs **non jugeables** affichés aussi, et l'expérience qui
tranche. Le socle IA est posé par IA-LAB-01 (fonction Edge, consentement, quotas, liste blanche).

Ce qui manque n'est donc pas le raisonnement, c'est **la première lecture**. Le panneau « Pourquoi ? »
demande de lire trois suspects, leurs chiffres, deux facteurs écartés et une expérience avant de
comprendre ce qui se passe. Un humain veut d'abord **une phrase**.

Et c'est exactement le rôle que la salve a assigné à l'IA : *le moteur calcule, l'IA raconte*.

## 2. Ce que fait la fonctionnalité

Sur un dossier d'enquête déjà calculé, un bouton **« Résumer »** demande au modèle d'en faire deux
ou trois phrases. Le texte rendu est **vérifié contre le dossier** : tout nombre qu'il cite doit
exister dans les données du dossier, sinon le résumé est **refusé** et l'écran le dit.

**Hors périmètre, explicitement :**

- **toute nouvelle analyse** : les suspects, leurs forces et l'expérience viennent du moteur, et rien
  d'autre n'est calculé ;
- **le dialogue** : pas de question de suivi, pas de conversation. Un résumé, à la demande ;
- **la mémoire** (idée 10) : rien n'est retenu d'une fois sur l'autre ;
- **une nouvelle route serveur** : la fonction Edge `ai-assist` et son type `coach` suffisent —
  aucun déploiement, aucun secret nouveau ;
- **le Conseil des trois** (idée 6) : c'est CONS-01, la seconde US du lot.

## 3. Surfaçage (ADR-007)

| Surface | Ce qui apparaît |
|---|---|
| Labo → onglet « Pourquoi ? » | Un bouton « Résumer », **seulement si le consentement IA est donné** |
| Le résumé | Deux ou trois phrases, suivies de « résumé par l'IA, vérifié contre le dossier » |
| Le refus | « Résumé écarté : il citait un chiffre absent du dossier » — le dossier reste affiché |

**Aucun widget d'accueil, aucune notification, aucun résumé automatique.**

## 4. Décisions de cadrage

| # | Question | Décision |
|---|---|---|
| **D1** | Quel appel serveur ? | **Le type `coach` existant.** Son invite système impose déjà « N'utilise QUE les chiffres du bloc DONNÉES ». Zéro déploiement, zéro secret nouveau, quota déjà en place (20/jour). |
| **D2** | Résumé automatique à l'ouverture ? | **Non.** Un appel par ouverture d'écran épuiserait un quota partagé par tout le projet, pour un texte que personne n'a demandé. Le geste est explicite. |
| **D3** | Que faire d'un résumé qui invente un chiffre ? | **Le jeter**, et le dire. Ni correction, ni seconde tentative automatique : réessayer masquerait la fréquence du défaut, qui est précisément ce qu'on veut mesurer. |
| **D4** | Et si le modèle invente une **recommandation** (pas un chiffre) ? | **Limite assumée**, écrite noir sur blanc dans la spec et à l'écran : le garde-fou porte sur les nombres. L'expérience proposée reste celle du moteur, affichée séparément, et le résumé ne peut pas la remplacer. |
| **D5** | Où vit le garde-fou ? | Dans **`packages/shared`**, pur et testé. Un garde-fou dans un écran ne se relit pas. |
| **D6** | Le résumé est-il stocké ? | **Non.** Il vit le temps de l'écran. Le stocker obligerait à l'invalider à chaque recalcul du dossier — et un résumé périmé est pire que pas de résumé. |

## 5. Règles métier

**R1 — Le dossier est la seule source.** Le contexte envoyé est construit **à partir du
`LabQuestion` affiché** : constat, suspects retenus avec leurs chiffres, facteurs écartés, facteurs
non jugeables, expérience proposée. Rien n'est relu en base pour l'occasion.

**R2 — Aucun chiffre ne peut être inventé.** Le texte rendu est analysé : chaque nombre qu'il
contient doit correspondre à une valeur du dossier, à la tolérance d'arrondi près. Au premier nombre
inconnu, le résumé est **refusé en entier**.

> Le garde-fou est **mécanique**, pas contractuel. L'invite système demande déjà au modèle de ne pas
> inventer de chiffre ; cette règle vérifie qu'il a obéi. C'est la différence entre une promesse et
> une garantie.

**R3 — Sans IA, rien ne change.** Consentement non donné, hors ligne, quota épuisé, fournisseur non
configuré : le panneau « Pourquoi ? » est **exactement** celui d'aujourd'hui. Aucun bouton mort,
aucun message d'erreur au chargement.

**R4 — Rien de neuf ne quitte l'appareil.** Le dossier est déjà un agrégat : pas de journal brut,
pas de trace GPS, pas de texte libre, aucune identité. La liste blanche d'IA-LAB-01
([`ai-context.ts`](../../../../packages/shared/src/ai-context.ts)) garde sa valeur de référence.

**R5 — Le résumé ne remplace jamais le dossier.** Il s'ajoute au-dessus ; les suspects, les écartés
et l'expérience restent affichés et cliquables.

**R6 — i18n.** Le résumé est demandé dans la langue de l'application (FR ou EN) ; les libellés des
faits envoyés au modèle sont ceux, déjà traduits, que l'écran affiche.

**R7 — Toujours une association, jamais une preuve.** La mention qui encadre le panneau
(« associations, pas des preuves ») vaut aussi pour le résumé, et l'invite le rappelle au modèle.

**R8 — La liste des nombres autorisés est celle du dossier AFFICHÉ.** Elle est construite en
relisant le texte du dossier, pas seulement ses valeurs brutes. Sans ça, le premier faux refus
arrive immédiatement : le dossier stocke 365 minutes de sommeil et les affiche « 6 h 05 » ; un
modèle qui recopie honnêtement « 6 h 05 » citerait deux nombres introuvables dans les valeurs
brutes. La règle qui en découle est simple et sûre : **le modèle ne peut citer que ce qu'on lui a
donné, et tout ce qu'on lui a donné est autorisé.**

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Aucun suspect dans le dossier | Pas de bouton : il n'y a rien à raconter |
| Réponse vide ou tronquée | Refusée comme une réponse invalide |
| Réponse trop longue (> 400 caractères) | Refusée : un résumé qui ne résume pas n'en est pas un |
| Le modèle cite « 34 % » quand le dossier porte 0,34 | **Accepté** : c'est la même valeur, écrite autrement |
| Le modèle cite « 45 % » quand le dossier porte 34 % | **Refusé**, et l'écran le dit |
| Le modèle écrit « trois semaines » en toutes lettres | Accepté : on vérifie les nombres écrits en chiffres |
| Quota épuisé | Message d'IA-LAB-01, inchangé |
| Changement de dossier | Le résumé précédent disparaît : il portait sur un autre constat |

## 7. i18n (FR + EN)

Espace de clés `lab.why.narrate.*`.

| Clé | FR | EN |
|---|---|---|
| `narrate.cta` | « Résumer » | “Summarize” |
| `narrate.loading` | « Lecture du dossier… » | “Reading the file…” |
| `narrate.source` | « Résumé par l'IA, vérifié contre le dossier. » | “Summarized by AI, checked against the file.” |
| `narrate.rejected` | « Résumé écarté : il citait un chiffre absent du dossier. » | “Summary discarded: it quoted a number that isn't in the file.” |
| `narrate.invalid` | « Résumé écarté : réponse inexploitable. » | “Summary discarded: unusable answer.” |

> ⚠️ **Une clé de moins qu'annoncé** : les pannes du serveur (hors ligne, quota, consentement,
> fournisseur) **réutilisent les messages d'IA-LAB-01** (`aiLab.errors.<code>`). En écrire des
> seconds ici aurait fait deux phrases pour une même panne, qui auraient divergé à la première
> retouche. Seuls les deux verdicts du garde-fou ont un texte à eux.
| `narrate.limit` | « Le résumé lit le dossier ; il ne le remplace pas. » | “The summary reads the file; it doesn't replace it.” |

## 8. Comportement offline

**Le dossier est local et le reste.** Le résumé, lui, exige le réseau : hors ligne, le bouton
affiche l'erreur `offline` d'IA-LAB-01 et le panneau reste entier (R3). Rien n'est mis en file
d'attente : un résumé différé porterait sur un dossier qui aura changé.

## 9. Accessibilité

- Le bouton est un vrai bouton, cible ≥ 48 dp, avec un libellé explicite.
- L'état de chargement est annoncé (`accessibilityState.busy`).
- Le résumé et son refus sont des **régions vivantes** : ils apparaissent après une action, donc
  TalkBack doit les lire sans avoir à rechercher le focus.
- Le texte du modèle grandit avec la police système, sans troncature.

## 10. Critères de recette (device)

1. Sans consentement IA : le panneau « Pourquoi ? » est identique à avant. **Aucun bouton.**
2. Consentement donné : le bouton « Résumer » apparaît sur un dossier qui a au moins un suspect.
3. Le résumé cite des chiffres, et ces chiffres sont bien ceux affichés dans le dossier.
4. Le dossier reste affiché en entier sous le résumé.
5. Changer de dossier efface le résumé précédent.
6. Mode avion : message d'erreur clair, dossier intact.
7. Quota épuisé : message d'IA-LAB-01, dossier intact.
8. Le refus se voit au moins une fois si le modèle s'écarte — à défaut, le vérifier en coupant
   volontairement le réseau au milieu (réponse tronquée).
9. FR et EN : le résumé revient dans la langue de l'app.
10. TalkBack lit le résumé dès son apparition ; à 1,5× de police, rien n'est coupé.
