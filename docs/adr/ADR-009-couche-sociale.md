# ADR-009 — Couche sociale : publication choisie, entre amis réciproques

- **Statut** : 🟡 **Proposé** — décisions produit prises par Florian le 20/09/2026, **relecture
  Damien à faire**. Aucune ligne de code écrite.
- **Date** : 20/09/2026
- **Décideurs** : Florian (relecture Damien à faire).
- **Lié à** : [ADR-002 — Périmètre V1](./ADR-002-perimetre-v1.md) *(qui renvoyait le social en V2 —
  cet ADR le rouvre)* · [ADR-005 — Gamification](./ADR-005-gamification.md) ·
  [ADR-006 — Cartographie](./ADR-006-cartographie.md) ·
  [ADR-007 — Surfaçage des analyses](./ADR-007-surfacage-analyses.md) ·
  [analyse-strava-2026-09.md](../product/analyse-strava-2026-09.md) ·
  [offline-sync.md](../specs/technical/offline-sync.md) ·
  décision de cadrage **H — intégration sans imposition** ([SYNTHESE-CADRAGE.md](../../SYNTHESE-CADRAGE.md)).

---

## Contexte

**La demande** (Florian, 20/09/2026) : *« j'aime bien sur Strava le fait de pouvoir publier une
séance avec l'heure, le jour, avec un petit commentaire, et que tout le monde le voit, dans un
système d'amis. C'est bête, mais ça prouve un peu ce que tu fais, et les gens aiment bien montrer ce
qu'ils font. »*

**Pourquoi c'est une décision d'architecture et pas une US.** Aujourd'hui, **chaque table** du schéma
porte les mêmes trois politiques RLS — `select` / `insert` / `update` avec `user_id = auth.uid()` —
et les règles PowerSync bucketisent **par utilisateur**
([powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml)). Il n'existe, à ce jour,
**aucune donnée visible par quelqu'un d'autre que son propriétaire**, nulle part. Rendre une seule
séance visible par un tiers introduit une notion qui n'existe pas dans le modèle. C'est structurant,
donc c'est un ADR.

**Pourquoi maintenant, alors qu'ADR-002 renvoyait le social en V2.** Trois faits ont changé le
20/09/2026 :

1. **La publication Play Store est reportée** (décision Florian + Damien). Or la déclaration
   « Sécurité des données » de la fiche Play **ne se dépose qu'une fois**, et y ajouter une donnée
   après coup impose une re-déclaration et ~2 semaines de délai externe (cf. LANCE-00 dans
   [BACKLOG.md](../../BACKLOG.md)). **Construire la couche sociale maintenant ne coûte donc aucun
   délai** : la déclaration partira plus tard, complète, en une fois. Dans l'autre ordre, elle aurait
   coûté deux semaines. **Le report du lancement rend ce chantier moins cher, pas plus.**
2. **L'objection du démarrage à froid ne tient pas sur un cercle d'amis.** Elle était l'argument le
   plus fort contre le social ([analyse-strava-2026-09.md](../product/analyse-strava-2026-09.md) §8,
   obstacle 2), et elle reste vraie pour le modèle Strava : un fil d'**abonnements** est un réseau de
   **découverte**, qui exige de la densité pour ne pas être vide. Un fil d'**amis choisis** a besoin
   de trois personnes. La demande de Florian porte explicitement sur des amis.
3. **Une meilleure conception existe** (option B ci-dessous), qui divise le coût par rapport à ce que
   la première analyse supposait.

---

## Question 1 — Qu'est-ce qu'on partage ?

### Option A — Ouvrir `workouts` / `runs` en lecture aux amis
- **+** Aucune duplication ; la donnée publiée est toujours à jour.
- **−** Ouvre le **modèle privé** : chaque colonne ajoutée à `runs` ou `workouts` devient une question
  de confidentialité, pour toujours. RLS composée sur des tables centrales et chaudes. PowerSync doit
  bucketiser les mêmes tables deux fois, pour deux raisons différentes. Et surtout : **ce qui est
  publié change dans le dos de l'auteur** — corriger une série trois jours plus tard réécrirait le
  post que les amis ont déjà commenté. **Rejeté.**

### Option B — Une table de publication, projection figée *(retenu)*
Un post est une **copie figée, au moment du geste**, de ce que l'auteur a choisi de montrer :
titre, date et heure, son commentaire, trois ou quatre chiffres, éventuellement le tracé **simplifié**
et une photo.

- **+** **Les tables privées ne bougent pas.** Ce qui est publié est explicite, borné, et
  **ne change plus** : corriger sa séance ensuite ne réécrit pas le post. Un **seul** bucket PowerSync
  nouveau. Dépublier = supprimer le post, la séance reste intacte. Le périmètre de ce qui sort de
  l'appareil est **lisible dans une seule table** — ce qui rend la déclaration Play et la politique de
  confidentialité écrivables sans se tromper.
- **−** Duplication de quelques champs ; il faut décider explicitement ce qui se met à jour (réponse :
  **rien**, sauf une republication volontaire).
- **Accepté.**

## Question 2 — Quel lien entre deux personnes ?

### Option A — Abonnements asymétriques *(modèle Strava)*
- **+** Permet de suivre quelqu'un qu'on ne connaît pas ; c'est ce qui fait grossir un réseau.
- **−** **Abonnés non désirés** ; modération d'inconnus ; exige de la densité pour valoir quelque
  chose. Strava lui-même doit **forcer** l'abonnement à trois personnes dans son onboarding
  (observation O8 de l'analyse) — preuve que le graphe ne se forme pas seul, même chez eux.
  **Rejeté.**

### Option B — Amis réciproques, à double consentement *(retenu)*
- **+** Personne ne me suit sans mon accord. Cercle petit et choisi. **Modération quasi nulle** : pas
  de contenu public, pas d'inconnus. **Fonctionne à trois personnes.** Cohérent avec la décision H
  (intégration sans imposition) : qui ne veut pas d'amis n'en a pas, et ne voit rien de tout ça.
- **−** Ne « grossit » pas tout seul ; l'ajout d'un ami demande un geste des deux côtés.
- **Accepté.**

## Question 3 — Comment une séance arrive-t-elle dans le fil ?

### Option A — Automatique, masquable après coup *(modèle Strava)*
- **+** Plus de contenu, donc un fil plus vivant.
- **−** On publie **sans y penser** — y compris la séance ratée, la sortie dont on n'est pas fier, ou
  le jour où on ne voulait rien dire. Et publier par défaut une donnée de santé géolocalisée est
  exactement ce qu'un consentement RGPD ne doit pas être. **Rejeté.**

### Option B — Geste explicite *(retenu)*
Rien ne part tout seul. À la fin d'une séance : « garder pour moi » ou « publier ». Si on publie, on
choisit le titre, on écrit son mot, on voit **l'aperçu exact de ce que les amis verront** avant de
valider.
- **+** Consentement au bon endroit, au bon moment, sur le bon objet. L'aperçu supprime la mauvaise
  surprise. Et le geste lui-même a de la valeur : on publie ce dont on est content.
- **−** Moins de contenu dans le fil.
- **Accepté.**

---

## Décision

**Option B aux trois questions.** La couche sociale de l'application est une **publication choisie,
figée, visible par des amis réciproques**.

1. **Un post est une projection figée**, écrite au moment du geste dans une table dédiée. Les tables
   privées (`workouts`, `runs`, `sessions`, `workout_sets`…) restent strictement
   `user_id = auth.uid()` et ne sont **jamais** lisibles par un tiers.
2. **Le lien est réciproque** et demande l'accord des deux personnes.
3. **La publication est un geste explicite**, avec aperçu avant validation, et réversible
   (dépublier n'efface pas la séance).
4. **Tout est opt-in** : qui n'ajoute aucun ami ne voit aucun écran social. Décision H.

---

## Conséquences

### Modèle de données — quatre tables neuves, zéro table modifiée

| Table | Rôle | Particularité |
|---|---|---|
| `friendships` | Le lien, avec son état (`pending` / `accepted`) | **La seule table à deux `user_id`** : c'est elle qui porte toute la complexité de droits |
| `activity_posts` | La projection figée de ce qui est publié | Contient sa propre copie des chiffres, jamais une jointure vers `runs`/`workouts` |
| `post_kudos` | Les bravos | Un par personne et par post |
| `post_comments` | Les commentaires | Soft delete, comme partout |

Aucune migration ne touche une table existante — c'est la conséquence directe de l'option B.

### Synchronisation

- **Un seul bucket PowerSync nouveau** : « les posts, bravos et commentaires de mes amis ».
- ⚠️ **Les sync rules ne sont pas versionnées côté outil** : après la migration, coller
  [powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml) dans le dashboard
  PowerSync et déployer. **Étape manuelle, déjà oubliée une fois** (cf. [CLAUDE.md](../../CLAUDE.md)).
- **Retirer un ami retire son bucket** : ses posts disparaissent du local. C'est le comportement
  voulu, et il est gratuit.
- **Offline** : un post, un bravo ou un commentaire écrits hors-ligne suivent la règle commune — UUID
  client, écriture optimiste en SQLite, synchro au retour du réseau
  ([offline-sync.md](../specs/technical/offline-sync.md)). Le fil affiche ce qui a été synchronisé ;
  il ne ment pas sur sa fraîcheur.

### Vie privée — non négociable

- **Les zones de confidentialité deviennent obligatoires et actives par défaut** dès qu'un tracé est
  publié : le départ et l'arrivée sont masqués dans un rayon paramétrable. **Elles sont dans le
  périmètre de ce lot**, pas d'un lot ultérieur. Publier une trace, c'est publier où quelqu'un habite
  et à quelle heure il sort.
- **La déclaration Play « Sécurité des données » devra porter la donnée sociale.** À écrire
  **maintenant** dans les brouillons de LANCE-00
  ([lance00-fiche-play-et-confidentialite.md](../specs/technical/lance00-fiche-play-et-confidentialite.md)) :
  elle ne se dépose qu'une fois.
- **La politique de confidentialité et les CGU** doivent être reprises avant publication du store —
  la relecture juridique déjà prévue porte désormais aussi sur ce lot.
- **Modération** : un **signalement** et un **blocage** suffisent à ce périmètre (pas de contenu
  public, pas d'inconnus). Si le modèle devenait asymétrique un jour, cette conclusion tombe.

### Ce que cet ADR ne décide pas

- **Pas de classement, pas de KOM, pas de club, pas de défi entre amis** : hors périmètre, et la
  gamification reste écartée par [ADR-005](./ADR-005-gamification.md).
- **Pas de fil sur l'écran d'accueil.** Le Tier 0 est cadré par
  [ADR-007](./ADR-007-surfacage-analyses.md) et INSIGHTS-02 ; y planter un fil défairait ce travail.
  Le social vit dans son propre espace.
- **Pas de messagerie**, pas de profil public indexable, pas de partage vers l'extérieur autre que
  celui qui existe déjà (**PARTAGE-01**, carte image via la feuille de partage de l'OS, 100 % local).
- **Aucune monétisation** : [ADR-003](./ADR-003-monetisation.md) tient, l'app est gratuite au
  lancement.

### Réversibilité

Bonne. Les quatre tables sont additives et isolées ; désactiver le social revient à masquer son
espace et à couper un bucket. Aucune donnée privée n'aura été déplacée — c'est le bénéfice principal
de l'option B, et la raison pour laquelle elle a été retenue.
</content>
