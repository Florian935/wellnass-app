# Health Connect — déclaration Google Play (prérequis de publication)

> **À lancer dès la validation de [CONF-06](../functional/us/conf06-health-connect.md), sans attendre
> la fin du code.** Le délai est externe et cumulé (~2 semaines) : il est sur le chemin critique de
> **LANCE-01**, pas sur celui du développement.
>
> Rédigé le 26/07/2026. Action humaine (Florian) — rien ici n'est automatisable.

## 1. Ce qui est bloqué, et ce qui ne l'est pas

| | Health Connect fonctionne ? |
|---|---|
| **Build de développement / interne** (`build:dev`, `build:preview`) | ✅ oui, sans déclaration |
| **Build de production publiée** (Play Store) | ❌ non tant que la déclaration n'est pas validée |

Sans déclaration validée, l'utilisateur d'une build publiée voit **« cette application ne peut pas
accéder à Health Connect »** et le lien échoue. Le développement et la recette device, eux, ne sont
pas bloqués : on peut tout construire et tout recetter pendant que le dossier est en cours.

## 2. Ce que l'app demande — exactement

Trois permissions, pas une de plus (principe de minimisation : chaque type de donnée supplémentaire
doit être justifié et rallonge l'instruction).

| Permission | Sens | Ce qu'on en fait | Justification à donner |
|---|---|---|---|
| `android.permission.health.WRITE_EXERCISE` | écriture | Écrire les séances de musculation et les courses terminées dans le hub santé | « L'application est un carnet d'entraînement. Les séances et courses enregistrées par l'utilisateur sont écrites dans Health Connect pour qu'il puisse les retrouver dans les autres applications de santé de son choix. » |
| `android.permission.health.WRITE_DISTANCE` | écriture | Distance parcourue associée à chaque course | « Une course sans sa distance n'a pas de valeur pour l'utilisateur dans les autres applications ; la distance est écrite avec la séance de course correspondante. » |
| `android.permission.health.READ_WEIGHT` | lecture | Alimenter le suivi de poids de l'app depuis une balance connectée | « L'application suit l'évolution du poids corporel, saisi manuellement aujourd'hui. La lecture évite à l'utilisateur de ressaisir une pesée déjà mesurée par sa balance connectée. » |

**Ne pas demander** (et donc ne pas déclarer) : pas, sommeil, fréquence cardiaque, calories, VO2max,
`READ_EXERCISE`, `WRITE_WEIGHT`. Toute extension future **impose une nouvelle déclaration**.

## 3. Les étapes, dans l'ordre

1. **Formulaire « Health apps declaration »** (Play Console → *Politique* → *Contenu de l'application*).
   - Catégorie : **Health & Fitness → Activité (fitness / entraînement)**.
   - Cocher l'usage de Health Connect, puis **justifier chaque type de données** du §2.
   - Règles d'instruction : justification claire et spécifique, accès **minimal**, aucune demande
     « au cas où ». Une justification vague est le premier motif de refus.
2. **Politique de confidentialité publiée** à une URL publique, accessible **depuis la fiche Play**
   *et* **depuis Health Connect**. Elle doit mentionner explicitement le traitement des données de
   santé. → dépend de la rédaction juridique déjà listée comme prérequis de LANCE-01
   ([BACKLOG.md](../../../BACKLOG.md)). Le texte in-app existe déjà (clé `legal.privacy.body`,
   paragraphe Health Connect ajouté par CONF-06) mais **n'est pas encore une URL publique**.
3. **Écran de justification des permissions** — exigence technique de Google, déjà satisfaite par le
   code : le plugin `expo-health-connect` pose l'intent-filter
   `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` sur `MainActivity` et l'`activity-alias`
   `ViewPermissionUsageActivity` (Android 14+). Vérifier après chaque `expo prebuild` (cf. §5).
4. **Section « Sécurité des données »** de la fiche Play : déclarer la collecte / le partage. Point
   d'attention : les données Health Connect **ne transitent pas par nos serveurs** (échange local
   appareil ↔ hub) — le formulaire doit le refléter honnêtement.
5. **Attendre la validation.** Compter ~7 jours pour l'instruction du formulaire, puis 5 à 7 jours
   ouvrés de propagation de l'autorisation. **Ne pas soumettre la build de production avant.**

## 4. Conséquences si on saute l'étape

- Fonctionnalité inopérante en production (message d'erreur système côté utilisateur).
- Tant que le formulaire dû n'est pas soumis, **aucune modification de la fiche** ne peut être
  envoyée en review — ce qui bloque bien plus que Health Connect.

## 5. Contrôles techniques associés (après chaque `expo prebuild`)

`apps/mobile/android/` n'est pas versionné : le manifest est **régénéré**. Vérifier dans
`android/app/src/main/AndroidManifest.xml` :

```
android.permission.health.WRITE_EXERCISE / WRITE_DISTANCE / READ_WEIGHT   ← app.json (android.permissions)
androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE                          ← plugins/withHealthConnect.js
<activity-alias android:name="ViewPermissionUsageActivity">                ← plugins/withHealthConnect.js
<queries> … com.google.android.apps.healthdata                             ← manifest de la bibliothèque (fusion auto)
```

Et dans `android/app/src/main/java/com/wellness/app/MainActivity.kt` :
`HealthConnectPermissionDelegate.setPermissionDelegate(this)` juste après `super.onCreate(...)`
(posé par le même plugin ; sans lui, la demande de permissions plante à l'exécution).

⚠️ **Ne pas ajouter `react-native-health-connect` à la liste des plugins** d'`app.json` : son
`app.plugin.js` pousse le même intent-filter **sans garde d'idempotence** → doublon dans le manifest.
Notre plugin maison suffit et couvre déjà tout.

## 6. Références

- Publier une app santé sur Google Play : https://developer.android.com/health-and-fitness/health-connect/publish
- Formulaire de déclaration (aide Play Console) : https://support.google.com/googleplay/android-developer/answer/14738291
- Permissions santé — règles et FAQ : https://support.google.com/googleplay/android-developer/answer/12991134
