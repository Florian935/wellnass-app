---
id: ACCUEIL-05
titre: "Le pied « la suite » et le tirer-pour-rafraîchir"
roadmap: [7.27]
catalogue: []
etape: recette
branche: feature/accueil-refonte
maj: 09/09/2026
---

# ACCUEIL-05 — Le pied « la suite » et le rafraîchissement

> Cinquième des six US de la refonte de l'accueil (lot unique, `feature/accueil-refonte`).
> La plus légère du lot, et celle qui contient l'écart de périmètre le plus notable (§3).

## 1. Le défaut

- **Aucun horizon.** L'accueil ne disait rien de ce qui venait après aujourd'hui : pour savoir
  quand était la prochaine séance, il fallait ouvrir le planning.
- **Aucun pull-to-refresh** — pas un seul `RefreshControl` dans **toute** l'application. Le geste
  est un réflexe ; un écran qui n'y répond pas se lit comme un écran figé.
- **« Personnaliser » squattait le coin haut-droit**, la place la plus précieuse de l'écran, pour
  une action qu'on fait une fois.

## 2. Ce qui est livré

### 2.1 Zone 4 — « la suite »

**Trois lignes de texte, pas trois cartes.** C'est le point : répondre par de nouveaux widgets
aurait regonflé le registre que INSIGHTS-02 venait de ramener de 21 à 8. Du texte sur le fond de
l'écran coûte ~137 px et **aucune place au plafond d'ADR-007**.

Contenu : les **trois prochaines occurrences planifiées**, tous piliers, avec leur date en clair.

- **R1 · Strictement après aujourd'hui.** Ce qui est prévu aujourd'hui appartient à la zone 1 ;
  le répéter ici serait du bruit.
- **R2 · Rien n'est inventé.** Une section sans donnée ne s'affiche pas. Un état vide unique et
  sobre remplace le tout si l'agenda est vide et qu'il n'y a rien aujourd'hui.
- **R3 · Horizon d'une semaine.** Au-delà, « la suite » cesse d'être actionnable.
- **R4 · « Personnaliser » vit ici**, à côté de « Voir mon planning ».

### 2.2 Le rafraîchissement (`useSyncRefresh`)

Dans une app offline-first, un pull-to-refresh n'a rien à « recharger » : `useQuery` est déjà
réactif sur SQLite local. Le geste reçoit donc le seul sens qu'il puisse avoir ici — **forcer la
synchronisation à reprendre** (`powerSync.connect`, idempotent). Utile dans un cas réel et
fréquent : au retour de connexion après un tunnel ou une salle en sous-sol, quand PowerSync n'a pas
encore reconnecté de lui-même.

- **R5 · Il ne promet pas que les données distantes sont arrivées.** L'indicateur s'arrête après un
  délai borné (2,5 s max), avec un plancher de 450 ms pour ne pas clignoter. Bloquer jusqu'à
  complétion donnerait un geste qui tourne dans le vide hors ligne.
- **R6 · Aucune alerte en cas d'échec.** Hors ligne ou jeton expiré, il n'y a rien à dire : le
  bandeau de synchronisation de l'en-tête porte déjà l'état de la connexion.
- **R7 · Désactivé en mode édition**, où le geste vertical sert au glisser-déposer.
- **R8 · Garde de réentrance** : deux gestes rapprochés ne lancent pas deux reconnexions.

## 3. ⚠️ Écart de périmètre assumé — l'objectif personnel

La maquette validée prévoyait une **troisième ligne** : « Objectif −3 kg avant le 15/10 · 62 % ».
**Elle n'est pas livrée**, et c'est un choix, pas un oubli.

Un `PersonalGoal` ne porte **ni titre ni libellé** : il porte `kind`, `targetValue`, `exerciseId` et
`deadline`. La phrase lisible est composée par la carte d'objectif de `/goals`. En écrire une
seconde version pour une ligne de 13 px créerait **deux mises en forme du même contenu** —
exactement la duplication qu'ADR-007 §3 proscrit (« construire des briques, pas 180 variantes »).

**À reprendre** le jour où ce libellé sera extrait en brique réutilisable. La place est là, la ligne
s'ajoutera sans rien déplacer.

## 4. i18n

`home.upNext.*`, FR et EN. Dates via `formatDayFull` (déjà i18n-isé).

## 5. Offline

`useUpcomingSessions` lit le planning local. Le rafraîchissement est le **seul** point du lot qui
touche au réseau, et il échoue silencieusement par conception.

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Aucune séance à venir, mais une aujourd'hui | zone 4 réduite aux deux liens |
| Aucune séance du tout | ligne d'état vide unique |
| Plus de trois occurrences dans la semaine | les trois plus proches ; le reste est dans le planning |
| Hors ligne au moment du geste | l'indicateur tourne puis s'arrête, sans message d'erreur |
| Deux tirages rapprochés | une seule reconnexion |

## 7. Recette

- [ ] Le pied affiche les **prochaines** séances, jamais celle d'aujourd'hui.
- [ ] Les dates sont justes et lisibles (format JJ/MM ou jour en clair).
- [ ] « Voir mon planning » ouvre le planning ; « Personnaliser » entre en mode édition.
- [ ] **Tirer vers le bas** : l'indicateur apparaît, tourne brièvement, disparaît.
- [ ] En **mode avion**, le même geste ne produit **aucune alerte** et s'arrête de lui-même.
- [ ] Couper puis rétablir le réseau, tirer : la synchro reprend (pastille « À jour »).
- [ ] En mode édition, le tirage ne déclenche rien (le geste sert au déplacement).
