---
id: CORPS-02
titre: "Silhouette personnelle et intention visuelle"
roadmap: [6.5]
catalogue: []
etape: close
branche: feature/corps02-morphologie
maj: 13/09/2026
---

# CORPS-02 — Silhouette personnelle et intention visuelle

Code vérifié le 13/09/2026 : 6 196 tests, typecheck, lint et export Android passent. Migration
cloud appliquée, types régénérés. Revue indépendante et planches issues du code inspectées :
[éditeur](../../../../design/mon-corps-2026-09/morphology-editor-qa.png),
[silhouettes](../../../../design/mon-corps-2026-09/morphology-qa.png).
APK release compilé sur les quatre ABI et signature vérifiée après correction des chemins
CMake Windows. **Version testée sur téléphone et validée par Florian le 13/09/2026** ; US
clôturée sur cette validation globale. [Trace et scénarios archivés](../../../recette/mon-corps-2026-09.md).

Suite de l'analyse et des maquettes validées par Florian, puis « ok continue » après CORPS-01. La direction reprend [la deuxième planche](../../../../design/mon-corps-2026-09/02-morphologie-objectifs.png). Ce lot architectural ajoute un profil visuel personnel, un renderer paramétrique et un éditeur. La préférence 2D/3D a été proposée pendant l'analyse ; en l'absence de réponse après un délai de travail indépendant, premier renderer 2D modulable retenu, sans dépendance native nouvelle. La rotation 3D et le moteur de programmation restent séparés.

## Produit

1. Entrée « Ma silhouette et mes objectifs » depuis `/body`, ouvrant `/body-shape`. Trois modes : **Départ**, **Objectif**, **Comparer** ; face/dos disponibles dans chaque mode.
2. Un mannequin lisse, ombré ivoire, dans le langage visuel de CORPS-01. Trois bases **Équilibrée**, **Épaules larges**, **Hanches larges**, sans déduction depuis le sexe, le poids ou les mensurations. Chaque base est ajustable par sept proportions : épaules, poitrine, taille, hanches, bras, cuisses, mollets. Réglages symétriques et bornés, sans trous aux jonctions. Une forme paramétrique commune fournit les deux vues.
3. Les réglages de départ sont des paramètres graphiques dans [-2,2] par pas de 0,25 ; aucune unité cm ou kg ne leur est attribuée. Liste complète de zones, curseur accessible et boutons moins/plus, remise à zéro de la zone, annulation du brouillon. Les formes sont aussi sélectionnables visuellement. Le choix d'une base ne supprime pas les réglages tant que l'utilisateur n'a pas utilisé la remise à zéro explicite.
4. Les dernières mensurations sont des **repères datés** consultables ; absence et ancienneté restent explicites. Elles ne sont ni inventées ni converties automatiquement en forme corporelle. Le lien vers les mensurations utilise la navigation existante. Aucune écriture dans profiles, body_weight_entries, body_measurements ou personal_goals.
5. Créer un objectif copie explicitement la silhouette de départ du brouillon. Les sept zones d'intention sont épaules, poitrine, dos, bras, fessiers, cuisses, mollets. Pour chacune : 0–4 par pas de 1, graduations qualitatives de maintien à volume visuel marqué, aucune promesse de croissance ni de délai. Les longueurs et la taille abdominale ne sont pas des paramètres d'objectif.
6. Le titre **Illustration d'intention** accompagne l'objectif. Le rendu utilise le départ capturé avec l'objectif, jamais le dernier départ de façon implicite. Modifier le départ ne modifie pas un objectif existant. Une action explicite « Repartir de ma silhouette actuelle » recrée l'objectif, après confirmation si l'objectif contient déjà des changements. Les mensurations réelles restent indépendantes.
7. Comparaison dans une pose et une échelle identiques : silhouette d'objectif avec contour de son départ capturé ; bascule pour voir le départ seul. Liste textuelle des zones renforcées, sans priorité d'entraînement appliquée automatiquement. Si le départ a été modifié depuis la création de l'objectif, signaler que celui-ci repose sur une version antérieure, avec action de recréation.
8. Un seul brouillon en mémoire pour les trois modes. Sauvegarde explicite de l'ensemble, atomique, hors-ligne ; erreur visible sans perdre le brouillon, bouton protégé contre le double appui. Annuler restaure la version enregistrée. Retour de l'écran et retour système demandent d'abandonner les modifications si le brouillon est sale. Quitter pendant une sauvegarde ne doit pas afficher une réussite fictive.
9. Une arrivée de données de synchro ne réinitialise jamais un brouillon sale. Un changement concurrent du document local fait échouer la sauvegarde avec un message invitant à recharger ; aucune réécriture silencieuse. Une version future ou un document illisible se présente comme non éditable, jamais comme un document vide.
10. FR/EN, thème clair/sombre, cibles ≥44, textes extensibles, TalkBack, respect des préférences de mouvement existantes. Pas d'animation obligatoire : les réglages changent directement le dessin. Pas de photo, ni réseau pour le rendu.

## Contrat du document et stockage

Colonne additive nullable **user_settings.body_visual_state jsonb**. Un document compact sauvegarde le départ et l'objectif ensemble ; les images ne sont jamais persistées. Table existante sous RLS utilisateur et bucket PowerSync `select *`, déjà incluse à l'export et à la suppression de compte. Pas de nouvelle règle distante de synchronisation. Déclarer la colonne locale TEXT et la conversion JSON dans le connecteur ; migration versionnée, dry-run puis application cloud selon CLAUDE.md, types régénérés.

Contrats exportés par `packages/shared/src/body-visual.ts` :

```ts
type BodyBase = 'balanced' | 'broad_shoulders' | 'broad_hips';
type BodyShapeZone = 'shoulders' | 'chest' | 'waist' | 'hips' | 'arms' | 'thighs' | 'calves';
type BodyGoalZone = 'shoulders' | 'chest' | 'back' | 'arms' | 'glutes' | 'thighs' | 'calves';
type BodyVisualZone = BodyShapeZone | BodyGoalZone;
type BodyShape = { base: BodyBase; proportions: Record<BodyShapeZone, number> };
type BodyEmphasis = Record<BodyGoalZone, number>;
type BodyVisualGoal = { baseline: BodyShape; baselineSavedAt: string | null; emphasis: BodyEmphasis; savedAt: string | null };
type BodyVisualDocument = { version: 1; assetVersion: 'body-shape-v1'; baseline: BodyShape; baselineSavedAt: string | null; goal: BodyVisualGoal | null; updatedAt: string | null };
```

Les dates sont ISO UTC ou null pour un brouillon non enregistré. Fonctions : `createBodyVisualDocument()`, `createBodyVisualGoal(document)`, `prepareBodyVisualSave(draft, previous, now)`, `parseBodyVisualDocument(raw)` → union `{status:'empty'|'invalid'|'unsupported', document:null}` ou `{status:'ready', document:BodyVisualDocument}` ; `bodyVisualDirty(draft,saved)`, `bodyGoalUsesCurrentBaseline(document)`, `bodyGoalZones(emphasis)` ; constantes `BODY_BASES`, `BODY_SHAPE_ZONES`, `BODY_GOAL_ZONES`, bornes et schémas Zod exportés. Aucun objet d'entrée muté. Comparaison de formes sémantique, indépendante de l'ordre des clés JSON.

`useBodyVisual()` → `{document:BodyVisualDocument|null, raw:string|null, status:'empty'|'ready'|'invalid'|'unsupported', isLoading:boolean, error:unknown}`. `saveBodyVisual(draft, expectedRaw)` → Promise<BodyVisualDocument>. Auth exigée ; transaction locale vérifie document attendu et possession, puis écrit uniquement la colonne et updated_at. Réglages utilisateur absents : erreur explicite, pas de deuxième ligne créée. Erreurs typées `conflict`, `settings_missing`, `unauthenticated`, `invalid`.

`BodyShapeFigure` : `{shape:BodyShape, emphasis?:BodyEmphasis, side:'front'|'back', height?:number, selected?:BodyVisualZone|null, mode?:'baseline'|'goal', onSelect?:(zone:BodyVisualZone)=>void, outlineOnly?:boolean}`. Le contour de comparaison passe les mêmes paramètres/pose et s'affiche au même endroit ; `outlineOnly` désactive les cibles tactiles. Renderer pur, sans lecture ni écriture de données.

## Recette

Vérifier sur Android : enregistrement en mode avion puis reprise de synchro ; fermeture/réouverture ; compte A/B distincts ; départ inchangé après édition objectif et inversement ; base capturée conservée ; annulation et retour ; repères absents/anciens ; extrêmes et combinaisons des sept proportions, trois bases et deux vues ; comparison alignée ; TalkBack/grandes polices ; erreur et conflit sans perte du brouillon. Pas de plan d'entraînement généré dans ce lot.
