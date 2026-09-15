# Objectif et niveau de guidage — planches de conception

13/09/2026 · Proposition de design, **non validée pour implémentation**.

Analyse complète : [L'objectif et le niveau de guidage](../../docs/product/analyse-objectif-guidage-2026-09.md)
· [version PDF](../../docs/product/analyse-objectif-guidage-2026-09.pdf).

## Planches

1. [Le parcours](01-planche.png) — onboarding étapes 3 et 4, et le récapitulatif.
2. [Une décision, trois régimes](02-planche.png) — la même collision muscu ↔ course vue en Guidé,
   Accompagné et Autonome. **C'est la planche qui porte la proposition** : elle montre que le
   régime ne change pas le volume de messages, mais qui tranche.
3. [Réglage et intégration](03-planche.png) — le curseur dans un profil de pilier, la carte de
   contradiction, et le rappel des sept décisions ouvertes.

Six écrans au total, plus un panneau de décisions. Ce sont des **images statiques** : aucun bouton
n'est fonctionnel, et les chiffres (2 840 kcal, 4 jours/semaine, 1 180 kcal restantes) sont des
exemples fictifs.

## Source et régénération

Tout vient d'un seul fichier HTML autonome, [objectif-guidage.html](objectif-guidage.html), sans
dépendance autre que les Google Fonts. Ouvert sans ancre, il affiche les trois planches à la suite ;
avec `#p1`, `#p2` ou `#p3`, une seule.

Les PNG sont exportés par Chrome headless :

```bash
for n in 1 2 3; do
  chrome --headless=new --disable-gpu --no-sandbox \
    --virtual-time-budget=20000 --hide-scrollbars --window-size=1280,1190 \
    --screenshot="0$n-planche.png" \
    "file:///C:/wellness-app/design/objectif-guidage-2026-09/objectif-guidage.html#p$n"
done
```

> ⚠️ Ces planches **n'ont pas été produites avec Claude Design**, contrairement aux dossiers
> `.dc.html` + `canvas.json` du dépôt (accueil-refonte, nutrition-refonte). Le skill `/design`
> n'était pas disponible dans la session : le consentement agent renvoie 403 tant que
> `/design-login` n'a pas été passé. Conséquence pratique : **pas d'édition visuelle possible** —
> toute retouche passe par le HTML. Si le sujet avance, il vaut la peine de reprendre les planches
> dans Claude Design pour récupérer l'éditeur.

## Direction artistique

Tokens repris du [design system](../design-system.md), thème clair :
crème `#fffcf7`, surface `#fffaf2`, bordures `#ece0cd`, cacao `#33291f`, terracotta `#c0562f`,
accent tint `#f3ddd0`, vert `#7c8a5b`. Typographies Bricolage Grotesque (titres), Hanken Grotesk
(corps), Space Mono (labels et chiffres) — les trois du projet.

Deux partis pris de représentation :

- **Le cadre pointillé de l'écran Autonome est une annotation de maquette, pas un composant.** À
  l'écran, il n'y a littéralement rien à cet endroit. Il fallait pourtant rendre visible le fait que
  l'analyse tourne toujours et attend dans Insights — sinon la planche donne à croire que le mode
  Autonome désactive le moteur.
- **La mention « déduit » est traitée comme un vrai élément d'interface**, pas comme une note de
  maquette : c'est le motif posé pendant NUTRI-UX01 (ce qui est *appliqué* ≠ ce qui a été *choisi*),
  et il est structurant pour toute la proposition.

## Points à fixer avant intégration

- **Thème sombre non maquetté.** Les six écrans n'existent qu'en clair.
- **Accessibilité non vérifiée** : grandes polices, cibles tactiles ≥ 48 dp, parcours TalkBack. La
  ligne « Cette règle ne me correspond pas » est aujourd'hui dessinée comme un lien texte — elle est
  très probablement sous la cible minimale.
- **Le cadre de téléphone est illustratif** (barre d'état stylisée, coins arrondis génériques). La
  réalisation suit les composants Android du projet.
- **Les libellés sont en français uniquement.** L'anglais est obligatoire au lancement (décision G),
  et c'est là que le sujet est le plus risqué : le ton du mode Guidé (« J'ai déplacé ta séance »)
  ne se traduit pas mécaniquement sans devenir soit sec, soit infantilisant.
- **L'écran 3 pose deux questions (expérience, disponibilité) qui n'ont pas de colonnes en base.**
  Elles sont dessinées comme acquises ; elles sont en réalité le lot B de l'analyse.
- **La barre d'onglets montre 4 entrées** ; elle dépend des piliers actifs et peut en compter moins.
