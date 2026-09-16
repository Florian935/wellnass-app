---
id: CORPS-04
titre: "Choisir un programme compatible avec mes priorités"
roadmap: [6.7]
catalogue: []
etape: recette
branche: feature/corps04-programme-compatible
maj: 16/09/2026
---

# CORPS-04 — Un programme compatible, expliqué avant d'être choisi

Suite autorisée par Florian le 15/09/2026 après validation visuelle de CORPS-03. Ce lot est le
deuxième incrément du lien entre intention visuelle et entraînement. Il compare des programmes
existants et relus ; il ne génère pas librement une prescription à partir du dessin.

## Résultat attendu

Depuis **Mes priorités d'entraînement**, l'utilisateur renseigne ou confirme son contexte de
musculation, puis compare son programme actif aux programmes éditoriaux compatibles. Chaque carte
explique ce qui correspond aux priorités, ce qui manque dans les données et quelles contraintes
ont été prises en compte. Choisir une proposition crée une copie personnelle inactive et ouvre son
éditeur. Le programme actif et le programme source restent inchangés ; l'activation utilise le
parcours existant et demeure un second geste explicite.

## Choix d'approche

Trois approches ont été évaluées : générer un programme libre, modifier automatiquement le
programme actif, ou classer des programmes éditoriaux puis en créer une copie personnelle. La
troisième est retenue. Les deux premières nécessiteraient des données de mouvements, de fatigue,
de blessures et une validation éditoriale que le catalogue actuel ne porte pas. Le classement
choisi apporte déjà une décision utile, déterministe, testable hors-ligne et réversible.

Ce choix est cohérent avec l'ACSM 2026 : plusieurs formes d'entraînement en résistance produisent
des bénéfices, tandis que les variables de prescription n'ont pas toutes un effet uniforme. La
méta-analyse en réseau de Currier et al. conclut également que toutes les prescriptions étudiées
font mieux que l'absence d'entraînement et que la préférence de la personne peut guider le choix.
Sources de conception : PMID `41843416`, DOI `10.1136/bjsports-2023-106807`. L'interface ne cite
pas ces travaux comme une promesse individuelle et ne prédit ni résultat ni délai.

## Parcours

1. Une confirmation CORPS-03 est obligatoire. Sans elle, retour vers le choix des priorités.
2. Le contexte reprend le niveau déclaré et le nombre de jours disponibles du profil GUID-01.
   Une valeur absente est présentée comme **À confirmer**, jamais comme un choix utilisateur.
3. L'utilisateur renseigne une durée maximale habituelle par séance parmi 30, 45, 60, 75 ou
   90 minutes, ainsi que son matériel disponible. Le poids du corps et l'absence de matériel sont
   toujours compatibles ; une liste de matériel vide signifie **Tout le matériel**, explicitement.
4. **Comparer les programmes** n'écrit rien. Le calcul inclut le programme muscu actif, s'il existe,
   et les programmes muscu éditoriaux publiés lisibles dans SQLite.
5. Au plus trois propositions sont affichées. Le programme actuel peut être classé premier et porte
   l'action **Conserver ce programme**. Chaque carte montre : niveau, séances par passage, estimation
   de durée par séance, matériel requis, séries fines par priorité et muscles fins absents.
6. Les associations musculaires générales sont nommées mais ne remplissent jamais un critère fin.
   Une durée impossible à estimer est **Non vérifiable avec les données du programme**, jamais zéro.
7. Un programme dépassant le nombre de jours choisi ou utilisant du matériel explicitement absent
   est exclu. Une durée estimée au-dessus de la limite est conservée dans les résultats uniquement
   si aucune proposition entièrement compatible n'existe ; elle porte une alerte et n'est pas
   présentée comme compatible.
8. L'ordre est déterministe. Les raisons sont affichées en langage naturel ; aucun score numérique
   opaque n'est montré.
9. **Préparer ce programme** ouvre une confirmation qui rappelle que l'original reste intact.
   Après accord, l'app duplique le programme éditorial dans le compte courant, ajoute le suffixe
   localisé « adapté à mes priorités », le laisse inactif et ouvre `/programs/edit?id={id}`.
10. Un programme personnel appartenant déjà au compte n'est jamais dupliqué silencieusement : le
    programme actif renvoie vers son éditeur. Aucun autre programme personnel n'entre dans le
    classement de bibliothèque.
11. Une modification du contexte, des priorités ou de la source entre comparaison et confirmation
    invalide la proposition. Le brouillon de contexte reste visible et un recalcul explicite est
    demandé. Double appui, changement de compte et ancien écho SQLite sont protégés.
12. FR/EN, clair/sombre, petit écran, textes extensibles, TalkBack, cibles tactiles de 44 px minimum.
    Données locales et aucune dépendance native nouvelle.

## Contexte stocké

Deux colonnes additives et nullable sur `profiles` :

```ts
strength_session_minutes: 30 | 45 | 60 | 75 | 90 | null;
strength_equipment: Equipment[] | null;
```

`null` sur l'équipement signifie **jamais choisi / tout autorisé**. `[]` est refusé : poids du corps
reste implicite et ne nécessite aucune valeur. La liste est unique et dans l'ordre canonique
`EQUIPMENTS`. Ces préférences sont réutilisables par le profil musculation. Elles ne modifient pas
le niveau, la disponibilité hebdomadaire ou les équipements déclarés sur les exercices.

## Contrats purs

```ts
type StrengthProgramCandidate = {
  program: Omit<BodyTrainingProgram, 'sessions'> & {
    ownerId: string | null;
    level: ProgramLevel | null;
    sessions: Array<Omit<BodyTrainingProgram['sessions'][number], 'plans'> & {
      plans: Array<BodyTrainingPlan & {
        restSeconds: number | null;
        equipment: Equipment | null;
      }>;
    }>;
  };
  isCurrent: boolean;
};

type StrengthProgramContext = {
  level: TrainingLevel | null;
  weeklyAvailability: number | null;
  sessionMinutes: 30 | 45 | 60 | 75 | 90 | null;
  equipment: Equipment[] | null;
};

type StrengthProgramRecommendation = {
  programId: string;
  isCurrent: boolean;
  compatible: boolean;
  exactPriorityCount: number;
  exactFineMuscles: FineMuscle[];
  missingFineMuscles: FineMuscle[];
  generalPriorityZones: BodyGoalZone[];
  sessionDurationMinutes: (number | null)[];
  reasons: ('priorities' | 'level' | 'schedule' | 'equipment' | 'duration')[];
  issues: ('schedule' | 'equipment' | 'duration')[];
};

function estimateStrengthSessionMinutes(session: StrengthProgramCandidate['program']['sessions'][number]): number | null;
function recommendStrengthPrograms(
  candidates: StrengthProgramCandidate[],
  priorities: BodyGoalZone[],
  context: StrengthProgramContext,
): StrengthProgramRecommendation[];
```

Estimation : pour chaque ligne non échauffement dont `targetSets` est connu, `targetSets ×
(45 secondes d'effort + restSeconds ou 90 secondes de repli)`, puis 60 secondes de transition
entre deux lignes. Si une ligne non échauffement a un nombre de séries inconnu, la séance entière
est `null`. Le résultat est arrondi à la minute supérieure et toujours qualifié d'estimation.

Classement, dans cet ordre : compatible avant incompatible ; nombre de muscles fins demandés
couverts ; nombre de priorités ayant au moins une association fine ; niveau exact ; programme
actuel ; proximité du nombre de séances avec la disponibilité ; identifiant comme dernier départage.
Les séries servent à expliquer la couverture, jamais à calculer un score de résultat physique.
La fonction retourne au plus trois résultats compatibles. Si aucun candidat ne l'est, elle retourne
au plus trois résultats incompatibles afin d'expliquer précisément les contraintes à revoir.

## Lecture et écriture

Le repository lit en une requête cohérente les programmes éditoriaux `strength` publiés, leurs
séances/plans/exercices non supprimés et traductions langue→FR. Il inclut séparément le programme
actif du compte, y compris s'il s'agit d'une copie personnelle. Ownership vérifié à chaque niveau.

La sauvegarde du contexte passe par `saveStrengthProgramContext(context, expectedUpdatedAt)` dans
un repository dédié, avec comparaison de `profiles.updated_at` dans la transaction.
La préparation appelle une nouvelle transaction dédiée qui relit le programme source, vérifie son
empreinte canonique produite par `fingerprintStrengthProgram(program)`, l'identité courante et son
caractère éditorial publié, puis reprend le mécanisme de
duplication existant. Elle ne change jamais `is_active`. Chaque traduction disponible conserve sa
langue et reçoit son suffixe localisé ; aucun contenu traduit absent n'est inventé. Les contenus et
paramètres du programme sont copiés sans dosage supplémentaire.

## États et erreurs

- priorités absentes, futures ou invalides ;
- profil/contextes manquants ou illisibles ;
- aucun programme éditorial ; programme actuel seul ;
- candidat vide, tags fins absents, séries ou durée inconnues ;
- aucune proposition compatible ;
- source modifiée/supprimée entre lecture et copie ;
- conflit de profil, compte changé, écriture locale en attente ;
- échec de duplication sans activation ni copie partielle.

Chaque état conserve les choix locaux et propose une action claire. Une erreur de lecture reste
distincte d'une bibliothèque vide.

## Hors périmètre

- modifier automatiquement séries, répétitions, charge, repos ou ordre des exercices ;
- choisir un exercice à la place de l'utilisateur ;
- activer, remplacer ou planifier un programme ;
- traiter une douleur, une pathologie, la nutrition ou la course ;
- promettre une transformation ou une date ;
- IA générative, serveur distant, 3D ou reconstruction photo.

## Recette finale

La recette globale vérifiera contexte complet/incomplet, filtre jours/matériel, estimation connue et
inconnue, classement stable, programme actuel, aucune correspondance fine, trois priorités,
bibliothèque vide, changement concurrent, duplication unique et inactive, original intact,
éditeur ouvert, offline/redémarrage, deux comptes, FR/EN, clair/sombre, grande police et TalkBack.

## Livraison en recette — 16/09/2026

La migration cloud `20260915115333_corps04_strength_program_context` est appliquée. Un second
dry-run confirme que la base distante est à jour ; les types régénérés portent les deux colonnes
sur `profiles.Row`, `Insert` et `Update`. `profiles` étant déjà publiée et synchronisée en
`select *`, aucune sync rule n'est à redéployer.

Les suites ciblées passent : 34 tests Vitest sur le moteur et le profil, puis 106 tests Jest sur
les repositories SQL, les deux écrans et le décodage JSON PowerSync. L'APK release Android a été
construit avec les quatre ABI, signé en v2 et contrôlé contre son bundle embarqué. La recette
device reste volontairement non cochée dans [RECETTES.md](../../../../RECETTES.md) §66 et se joue
dans la même campagne finale « Mon corps » que CORPS-03 §65. Les trois points device différés à
la fin de Task 5 — métriques natives, parcours TalkBack et alerte système — restent dans cette
recette ; aucun changement applicatif supplémentaire n'est introduit par la clôture.
