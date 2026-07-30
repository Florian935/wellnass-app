# LANCE-00 — Fiche Play, politique de confidentialité publiable et solde `app.json`

> **Statut : brouillons prêts à relire.** Ce document rassemble tout ce qui peut être **rédigé sans
> compte Google Play**, pour que la création du compte (délai externe : vérification d'identité
> Google, plusieurs jours) ne soit pas suivie d'une deuxième attente de rédaction.
>
> ⚠️ **Ce qui reste hors de portée d'un agent** : créer le compte développeur (25 $), publier la
> politique à une URL, et la **relecture juridique**. Les textes ci-dessous sont des brouillons de
> travail, **pas un avis juridique**.

## 0. Trois constats à traiter avant toute soumission

### 0.1 🔴 `version: "0.0.0"` dans [app.json](../../../apps/mobile/app.json)

Incohérent avec `runtimeVersion: "1.0.0"` déjà présent deux lignes plus bas. La roadmap vise
**V1.0** au lancement → `version` doit passer à **`1.0.0`**.

Conséquence au-delà de la fiche Play : le suivi analytics (US 9.10) **enregistre cette valeur**.
Toutes les mesures collectées jusqu'ici sont donc estampillées `0.0.0` et indistinguables.

### 0.2 🟠 L'écran de démarrage et l'icône adaptative sont restés aux couleurs du gabarit Expo

| Clé | Valeur actuelle | Ce que c'est |
|---|---|---|
| `plugins.expo-splash-screen.backgroundColor` | `#208AEF` | **bleu Expo** — couleur du gabarit de départ |
| `android.adaptiveIcon.backgroundColor` | `#E6F4FE` | **bleu clair Expo** — idem |

La palette du produit est **crème `#f7eede` + terracotta `#dd6e40`**. Aujourd'hui, la toute première
chose que voit un utilisateur au lancement est **bleue**, sans aucun rapport avec l'app. C'est
visible sur **chaque démarrage** et sur la fiche Play (l'icône). `expo-notifications` est déjà réglé
sur `#dd6e40` — la correction est donc l'alignement des deux valeurs restantes.

→ Proposition : `backgroundColor` splash **`#f7eede`**, `adaptiveIcon.backgroundColor` **`#f7eede`**.
**Décision de charte → Damien / Florian**, au même titre que CONF-07 §4.

### 0.3 🟠 Pas de `android.versionCode` explicite

EAS l'incrémente automatiquement (`autoIncrement` selon le profil [eas.json](../../../apps/mobile/eas.json)),
ce qui fonctionne — mais rend le numéro de build non reproductible en **build local Gradle**. À
vérifier au premier AAB de production : Play refuse un `versionCode` déjà soumis, et l'erreur
n'apparaît qu'à l'upload.

## 1. Politique de confidentialité — version publiable

> **Différence avec le texte in-app.** Celui de [fr.json](../../../apps/mobile/src/i18n/locales/fr.json)
> (`legal.privacy`) est un **résumé lisible dans l'app**. Google exige une politique **complète, à une
> URL publique, accessible sans compte**. Les deux doivent rester cohérents : toute modification ici
> doit être répercutée là-bas, et inversement.

**À héberger** sur une URL stable et publique (page GitHub Pages, ou sous-domaine). L'URL est exigée
**deux fois** : fiche Play, et déclaration Health Connect.

---

### Politique de confidentialité — Wellness

*Dernière mise à jour : JJ/MM/AAAA — à dater au jour de la publication.*

**1. Qui est responsable du traitement**
`<Raison sociale ou nom des éditeurs>`, joignable à `<adresse e-mail de contact>`.
→ ⚠️ **À compléter — je ne peux pas l'inventer.** Le RGPD impose une identité et un contact réels.

**2. Les données que nous traitons**

| Catégorie | Détail | Pourquoi |
|---|---|---|
| Compte | adresse e-mail, identifiant | créer et sécuriser l'accès |
| Profil | prénom affiché, langue, unités, objectifs | personnaliser l'app |
| Musculation | séances, séries, charges, répétitions, records, programmes | la fonction principale |
| Course | distance, durée, allure, **tracés GPS** | la fonction principale |
| Nutrition | aliments, quantités, repas, recettes, profil nutritionnel | la fonction principale |
| Santé | poids, mensurations, bien-être quotidien, **pas quotidiens** | suivi demandé par l'utilisateur |
| Usage | écrans consultés, fonctionnalités utilisées | améliorer l'app — **désactivable** |

**3. Ce que nous ne faisons pas**
Nous ne vendons aucune donnée. Nous ne les partageons avec aucun annonceur. Nous n'affichons pas de
publicité. Nous ne pratiquons aucun profilage publicitaire.

**4. Health Connect**
Si tu actives Health Connect : tes séances et tes courses y sont **écrites**, et ton poids y est
**relu** — cet échange a lieu **uniquement sur ton téléphone**. Tes **pas quotidiens**, en revanche,
sont lus dans Health Connect puis **enregistrés sur ton compte** (un total par jour, jamais le détail
de tes déplacements), afin d'alimenter ton objectif, ton historique et ta série sur tous tes
appareils. Tu peux désactiver cette synchronisation dans les réglages et révoquer l'accès à tout
moment depuis Health Connect.

**5. Où vont tes données**
Hébergement Supabase (Union européenne). Chaque utilisateur est isolé des autres par des règles de
sécurité au niveau des lignes (RLS). L'app fonctionne hors ligne : tes données vivent d'abord sur ton
téléphone et se synchronisent quand le réseau revient.

**6. Combien de temps**
Tant que ton compte existe. À la suppression du compte, l'ensemble est effacé.

**7. Tes droits**
Accès, rectification, **export** et **suppression** — tous disponibles directement depuis les
réglages de l'app, sans avoir à nous écrire. Réclamation possible auprès de la CNIL.

**8. Âge minimum**
16 ans.

**9. Modifications**
Toute évolution sera publiée sur cette page, avec une nouvelle date de mise à jour.

---

> 🌐 **Version EN à produire** — obligatoire, l'app est distribuée en FR **et** EN (décision G). Même
> plan, même contenu. À faire relire en même temps que la version FR pour éviter deux allers-retours
> juridiques.

## 2. Fiche Play — brouillon

### Titre (30 caractères max)
`Wellness — Muscu, Course, Nutri` *(31 — à raccourcir : `Wellness · Muscu Course Nutri` = 29)*

### Description courte (80 caractères max)
> Musculation, course et nutrition dans une seule app. Hors ligne, sans publicité.

*(79 caractères.)*

### Description complète (4 000 caractères max)

```
Trois applications en une. Wellness réunit la musculation, la course et la nutrition —
parce que ces trois piliers se parlent, et qu'aucune app ne les fait dialoguer.

MUSCULATION
• Séances guidées, séries, charges, répétitions, temps de repos
• Programmes personnalisés et planning hebdomadaire
• Records personnels détectés automatiquement
• Suggestions de substitution quand un exercice est indisponible

COURSE
• Suivi GPS avec tracé, allure et distance
• Fonctionne écran éteint
• Historique et records par distance

NUTRITION
• Journal alimentaire avec calcul des calories et des macros
• Scan de code-barres
• Recettes et repas types
• Objectifs ajustés selon ton entraînement

CE QUI CHANGE VRAIMENT
• Tout fonctionne HORS LIGNE. Salle en sous-sol, sentier sans réseau : rien ne se perd,
  tout se synchronise au retour du réseau.
• Aucune publicité. Aucune revente de données.
• Gratuit, sans abonnement.
• Français et anglais.
• Health Connect : tes séances et tes courses rejoignent le hub santé d'Android.

TES DONNÉES T'APPARTIENNENT
Export complet et suppression de compte disponibles à tout moment depuis les réglages,
sans avoir à nous écrire.

Wellness ne fournit pas de conseil médical. Consulte un professionnel de santé avant
d'entreprendre un programme d'entraînement ou un régime.
```

> ⚠️ **Trois affirmations à vérifier avant de les publier** — une fiche Play qui promet ce que l'app
> ne fait pas est un motif de rejet, et les captures sont vérifiées par un humain chez Google.
> 1. « Gratuit, sans abonnement » — **exact en V1** (décision D : RevenueCat inactif). À revoir le
>    jour où un paywall arrive.
> 2. « Aucune publicité, aucune revente » — exact, mais doit rester cohérent avec le formulaire
>    Sécurité des données (§3).
> 3. Les captures d'écran devront montrer l'app **réelle**. Ne pas les produire avant l'arbitrage
>    CONF-07 §4 : les couleurs des boutons peuvent changer.

### Éléments graphiques à fournir (non rédactionnels)
- Icône 512×512 · Bannière 1024×500 · 2 à 8 captures par langue (min. 320 px de côté court).
- ⚠️ Les captures doivent être **postérieures** à CONF-07 et au correctif splash (§0.2).

## 3. Formulaire « Sécurité des données » — réponses préparées

Établi d'après les **41 tables** réellement présentes dans [supabase/migrations/](../../../supabase/migrations/).

| Question | Réponse | Justification |
|---|---|---|
| Données collectées ? | **Oui** | compte + activité + santé |
| Données chiffrées en transit ? | **Oui** | HTTPS/TLS (Supabase, PowerSync) |
| Suppression demandable ? | **Oui** | `account_deletion_requests` + parcours in-app |
| Données partagées avec des tiers ? | **Non** | aucun SDK publicitaire |
| Position | **collectée**, liée à l'utilisateur, **non partagée** | tracés GPS des courses (`runs`) |
| Infos personnelles | e-mail, nom | `profiles` |
| Infos de santé et fitness | **collectées, transmises hors de l'appareil** | `daily_steps`, `body_weight_entries`, `body_measurements`, `daily_wellbeing`, `workouts`, `runs` |
| Fichiers/documents, contacts, SMS, photos | **Non** | *(la caméra sert au scan de codes-barres, aucune image n'est stockée)* |
| Activité dans l'app | **collectée**, désactivable | `analytics_events` |

> 🔴 **Le piège à ne pas manquer** : les **pas quotidiens** sont lus dans Health Connect **puis
> synchronisés sur le compte**. Il faut donc déclarer une **donnée de santé transmise hors de
> l'appareil** — beaucoup d'apps déclarent « traitement local uniquement » et se font rejeter là-dessus.
> Décision tranchée le 28/07/2026, déjà consignée au backlog.

## 4. Déclaration « Health apps »

Procédure et textes déjà prêts dans
[health-connect-play-declaration.md](health-connect-play-declaration.md).
**4 types de données** à déclarer : `WRITE_EXERCISE`, `WRITE_DISTANCE`, `READ_WEIGHT`, `READ_STEPS` —
conformes aux `permissions` d'[app.json](../../../apps/mobile/app.json).

## 5. Ordre d'exécution — et pourquoi il compte

Ces étapes sont **en série** et à délai externe. Environ **3 semaines** du début à la fin.

1. **Compte développeur Google Play** (25 $) → vérification d'identité, **plusieurs jours**. ⛔ Rien
   ne peut démarrer avant.
2. **Publier la politique de confidentialité** à une URL publique (après relecture juridique).
3. **Créer la fiche** + remplir Sécurité des données (§3).
4. **Déclaration Health apps** (§4) → ~7 j d'instruction + 5-7 j ouvrés de propagation.
5. **SMTP custom Supabase** — le service e-mail intégré est rate-limité, il ne tiendra pas la
   création de comptes réelle.
6. **Build AAB de production** puis soumission (LANCE-01).

> Les points 1 → 4 ne dépendent d'**aucune** ligne de code. Les lancer maintenant, en parallèle du
> solde de CONF-07, est ce qui raccourcit le plus la date de publication.
