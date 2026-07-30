# ⚠️ Un écart connu entre cette maquette et la décision produit

**Lis ceci avant d'implémenter quoi que ce soit depuis `FitTrio - Cycle.dc.html`.**

## L'écart

La maquette place **« Cycle » en 5ᵉ onglet** de la barre de navigation du bas
(Accueil · Muscu · Running · Nutrition · **Cycle**).

**C'est écarté.** Décision de Damien, 31/07/2026 → voir
[spec §3, règle R16 bis](../../docs/specs/functional/us/cycle01-suivi-menstruel.md).

## Ce qu'il faut faire à la place

Un **widget `cycle`** sur le hub **Accueil**, décliné sur les **3 formes**, avec l'écran de détail
atteint **en appuyant sur le widget** — le patron déjà employé par `steps` (PAS-01) et `wellbeing`
(BIEN-01).

| Forme | Contenu |
|---|---|
| `small` | jour du cycle (« J26 ») + phase |
| `wide` | + prochaine estimation avec sa fourchette, ou l'état « pas assez de données » |
| `large` | + mini-calendrier de la période en cours et accès direct à la saisie du jour |

## Pourquoi

- **Cohérence avec BIEN-01.** Le check-in de bien-être a été explicitement tranché comme une
  « 4ᵉ dimension légère, **pas** un 4ᵉ pilier » : aucun onglet, un widget transverse. Le cycle est de
  la même famille ; en faire un onglet le hisserait au-dessus du bien-être sans justification.
- **La barre du bas varie déjà de 2 à 5 entrées** selon les piliers activés (décision H). Un
  6ᵉ emplacement possible la rendrait ingérable sur petit écran.

## Le reste de la maquette fait foi

**Seule la barre de navigation est à ignorer.** Les 6 écrans, leurs états, leurs libellés et leur
charte sont la référence — et leur conformité à la spec a été vérifiée point par point le 31/07/2026
(avertissement, 3 états de prédiction, fourchette, 4 phases, cycle aberrant conservé, opt-in
désactivé par défaut, seuils par métrique, et absence des formulations interdites).

> 🖼️ La capture de l'écran **04 Historique** manque au bundle — l'écran existe bien dans le HTML.
