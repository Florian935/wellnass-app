---
id: CORPS-03
titre: "Priorités confirmées et lecture du programme"
roadmap: [6.6]
catalogue: []
etape: recette
branche: feature/corps03-priorites-entrainement
maj: 14/09/2026
---

# CORPS-03 — De la silhouette à l'entraînement

Suite autorisée par Florian le 13/09/2026 après validation Android de CORPS-01 / CORPS-02.
Premier incrément du lot 3 de l'[analyse validée](../../../product/analyse-mon-corps-2026-09.md).
Le programme reste une décision explicite de l'utilisateur. Cet incrément rend ses priorités
durables et lui montre où elles apparaissent dans son programme actuel. L'adaptation automatique
des séances avec prise en compte du matériel, de l'expérience et du temps disponible appartient
à un incrément suivant ; aucun réglage graphique n'est converti en dose d'entraînement.

## Parcours et présentation

1. Entrée **Mes priorités d'entraînement** dans Mon corps, et **Passer à l'entraînement** dans
   Ma silhouette lorsque l'objectif est enregistré et le brouillon propre. Ouvre `/body-training`.
2. Sans objectif enregistré : expliquer le lien et proposer **Créer mon objectif visuel**.
   Aucune priorité persistée automatiquement. Document visuel illisible/futur/erreur : état explicite.
   Si des priorités avaient déjà été confirmées, les conserver à l'écran avec leur ancien
   objectif et le lien de création ; leur effacement reste possible, une nouvelle confirmation attend un objectif.
3. Montrer le mannequin objectif, un rappel **Illustration d'intention** et sept zones cochables.
   Présélection suggérée : au plus trois accents strictement positifs, par importance graphique
   décroissante puis ordre canonique. L'utilisateur peut choisir d'autres zones, de une à trois.
   Cette limite sert la lisibilité et ne constitue pas une règle physiologique.
4. **Confirmer mes priorités** sauvegarde seulement cette sélection. Une confirmation existante
   affiche sa date, un bouton **Modifier** et **Effacer mes priorités** avec confirmation.
   Les modifications restent un brouillon ; Annuler et retour protégé. Pas de sauvegarde au tap.
5. Si l'objectif sauvegardé change, les priorités restent visibles avec **Objectif modifié :
   revoir mes priorités**. Pas de remplacement automatique ni de faux accord avec le nouveau dessin.
   La comparaison porte sur la copie de l'objectif complet, pas sur la silhouette de départ courante.
6. Une fois les priorités confirmées, carte **Dans mon programme** : nom, nombre de séances du
   modèle, puis détail par priorité. La période est **un passage dans les séances du programme**,
   jamais une semaine supposée ni l'entraînement réellement réalisé.
7. Pour chaque priorité : nombre de séries prévues dont le muscle est explicitement renseigné,
   nombre de lignes associées seulement par groupe général, lignes sans nombre de séries, puis
   exercices et noms de séances. Afficher les sous-muscles des bras/cuisses pour éviter que des
   biceps seuls paraissent représenter les triceps. Les totaux des zones ne sont pas additifs.
8. Absence de tag fin n'est pas preuve d'absence de travail : **Association générale seulement**
   ou **Aucun exercice associé dans les données du programme**, sans diagnostic de déficit.
   Séries d'échauffement exclues ; poids de corps inclus même sans charge ; aucun calcul de tonnage.
9. Actions : ouvrir le programme pour le consulter/éditer via son parcours existant, ouvrir
   l'explorateur sur chacun des muscles correspondants. Sans programme actif, lien vers la
   bibliothèque ; programme vide et erreur de lecture distincts. Aucun programme créé, remplacé,
   activé, planifié ou modifié par cet écran.
10. FR/EN, clair/sombre, textes extensibles, TalkBack, cibles ≥44, pas de geste obligatoire.
    Données et rendu locaux, aucune dépendance native nouvelle. Aucune modification des mesures,
    douleurs, objectifs personnels, activité de course ou nutrition.

## Contrats métier — `packages/shared/src/body-training.ts`

```ts
type BodyTrainingDocument = {
  version: 1;
  priorities: BodyGoalZone[]; // uniques, 1..3, ordre canonique
  sourceGoal: BodyVisualGoal; // copie indépendante, savedAt non null
  confirmedAt: string; // ISO UTC
};
type BodyTrainingParseResult = {
  status: 'empty' | 'ready' | 'invalid' | 'unsupported';
  document: BodyTrainingDocument | null;
};
const BODY_TRAINING_MUSCLES: Record<BodyGoalZone, readonly FineMuscle[]>;
function parseBodyTrainingDocument(raw: unknown): BodyTrainingParseResult;
function suggestBodyPriorities(goal: BodyVisualGoal): BodyGoalZone[];
function createBodyTrainingDocument(priorities: BodyGoalZone[], goal: BodyVisualGoal,
  now: string): BodyTrainingDocument;
function bodyTrainingNeedsReview(document: BodyTrainingDocument, goal: BodyVisualGoal | null): boolean;

type BodyTrainingPlan = {
  id: string; exerciseId: string; exerciseName: string; setType: SetType;
  targetSets: number | null; musclePrimary: MuscleGroup | null;
  musclesSecondary: MuscleGroup[]; musclesFine: FineMuscle[];
};
type BodyTrainingProgram = {
  id: string; name: string;
  sessions: { id: string; name: string | null; plans: BodyTrainingPlan[] }[];
};
type BodyTrainingMatch = {
  planId: string; exerciseId: string; exerciseName: string;
  sessionId: string; sessionName: string | null;
  kind: 'exact' | 'general'; muscles: FineMuscle[]; targetSets: number | null;
};
type BodyTrainingCoverage = {
  zone: BodyGoalZone; exactSets: number; unknownSetPlans: number;
  generalPlans: number; matches: BodyTrainingMatch[];
};
function analyseBodyTrainingProgram(program: BodyTrainingProgram,
  priorities: BodyGoalZone[]): BodyTrainingCoverage[];
```

Mapping fin : épaules→shoulders, poitrine→chest, dos→back, bras→biceps/triceps,
fessiers→glutes, cuisses→quadriceps/hamstrings, mollets→calves. Mapping général vers le
groupe primaire ou secondaire seulement si **aucun** tag fin : glutes/thighs/calves→legs,
autres zones vers leur groupe éponyme. Ne pas changer le mapping historique de l'explorateur.
Une ligne plan compte une fois par zone même si elle cible deux muscles de cette zone.
Une valeur de séries négative, non entière, non finie ou nulle est inconnue ; zéro est connu.
`exactSets` somme uniquement les séries connues des associations fines ; `unknownSetPlans`
compte uniquement les associations fines sans nombre exploitable ; les générales restent séparées.

## Stockage et concurrence

Colonne additive nullable `user_settings.body_training_state jsonb`, contrainte objet ou null.
Schéma PowerSync TEXT et conversion JSON explicite. RLS/bucket/export/suppression du compte
existants couvrent cette colonne. Migration CLI, dry-run puis cloud et types générés.

```ts
function useBodyTraining(): {
  document: BodyTrainingDocument | null; raw: string | null;
  status: BodyTrainingParseResult['status']; isLoading: boolean; error: unknown;
};
function saveBodyTraining(priorities: BodyGoalZone[] | null,
  expectedRaw: string | null, expectedVisualRaw: string | null): Promise<BodyTrainingDocument | null>;
// null efface uniquement les priorités. Erreurs typées : conflict, settings_missing,
// unauthenticated, invalid, goal_missing. Une transaction vérifie les deux chaînes brutes.
function useBodyTrainingProgram(): {
  program: BodyTrainingProgram | null; isLoading: boolean; error: unknown;
};
```

La confirmation reconstruit `sourceGoal` depuis le document visuel lu dans la transaction.
Un objectif non enregistré ne peut pas être confirmé. Données futures/illisibles jamais écrasées,
y compris pour effacer. Pas de modification du JSON visuel. La lecture du programme utilise
une requête locale cohérente, programme muscu actif appartenant au compte, lignes non supprimées,
noms traduits dans la langue puis FR (séance : dernier repli sur `sessions.name`). Un exercice
supprimé ou sans marquage valide reste non associé. Aucune lecture de programme d'un autre compte.

Le brouillon est conservé lors d'une erreur, d'une arrivée de synchro ou d'un conflit. Recharger
est explicite et confirme la perte de modifications. Gérer l'écho asynchrone d'une écriture locale
sans ressusciter une ancienne confirmation. Changement de compte démonte l'état local.

## Recette

Vérifier confirmation/édition/effacement, conservation du dessin, objectif modifié, départ modifié
seul, mode avion et réouverture, comptes séparés, conflit sans perte, limites de sélection, retour
sale, programme absent/vide, tags généraux/fins, bras/cuisses non doublés, programme inchangé,
liens, FR/EN, clair/sombre, grande police et TalkBack.
