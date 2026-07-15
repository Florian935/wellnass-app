# Build Android en local (sans EAS) — procédure

Compiler l'app **en local** (sans consommer de quota de build EAS). Deux modes, mêmes prérequis
(§1) :

- **Mode A — dev build debug + Metro** (§2-3) : build **debuggable** connecté à **Metro**, JS
  servi en direct → un correctif JS ne nécessite **aucun rebuild**. Pour développer au quotidien.
- **Mode B — APK autonome release** (§4) : APK **standalone**, JS embarqué, **sans Metro ni
  câble** pour l'utiliser. Pour installer l'app sur un tél « comme une vraie appli » (démo,
  recette hors-poste, usage perso).

> Rédigé le 13/07/2026 (mode A) puis complété le 16/07/2026 (mode B) sur le poste de Florian
> (Windows 10). Cible : que **Damien** (ou tout dev) puisse reproduire la même chose.

---

## 1. Prérequis (à installer une fois)

### 1.1 Node ≥ 20
Voir [.nvmrc](../../../.nvmrc). `node -v` doit être ≥ 20.

### 1.2 JDK 17 (⚠️ pas 21/25)
L'Android Gradle Plugin d'Expo SDK 57 / RN 0.86 compile avec **JDK 17**. Un JDK 21/25 dans le
PATH **casse** le build.
- Installer un JDK 17 (Temurin/Adoptium ou Oracle). Ex. chez Florian : `C:\Program Files\Java\jdk-17.0.1`.
- **Ne pas dépendre de `JAVA_HOME`/PATH** (souvent pollués par un JDK plus récent). On **force**
  Gradle à utiliser le 17 via un fichier global Gradle :

  Fichier `C:\Users\<user>\.gradle\gradle.properties` (le créer s'il n'existe pas) :
  ```properties
  org.gradle.java.home=C:/Program Files/Java/jdk-17.0.1
  ```
  (adapter le chemin ; slashes `/` acceptés sous Windows). Vérif : le build affiche du
  `compileDebugKotlin` sans erreur de version Java.

### 1.3 Android SDK (via Android Studio)
Le plus fiable sous Windows.
1. Installer **Android Studio** : https://developer.android.com/studio
2. Assistant 1ᵉʳ lancement → installe **SDK Platform** (API 35 **ou** 36, peu importe),
   **Platform-Tools** (fournit `adb`), **Build-Tools**.
3. **SDK Manager → onglet « SDK Tools »** → cocher **« Show Package Details »** :
   - **NDK (Side by side)** → version **exacte** réclamée par Expo : **`27.1.12297006`**
     (visible dans le log de build, ligne `ndk: …`). Sans elle → échec au link natif.
   - **CMake**.
   Le SDK atterrit dans `C:\Users\<user>\AppData\Local\Android\Sdk`.

> ⚠️ La version du NDK doit **matcher** celle demandée par Expo. Si Expo change de version
> (autre ligne `ndk:` dans le log), installer la nouvelle via « Show Package Details ».

### 1.4 Variables d'environnement
```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx ANDROID_SDK_ROOT "$env:LOCALAPPDATA\Android\Sdk"
```
Puis **fermer/rouvrir** le terminal. (Filet de sécurité : voir `local.properties` au §4.)

### 1.5 Téléphone en mode développeur
1. **Réglages → À propos → appuyer 7× sur « Numéro de build »**.
2. **Options pour les développeurs → activer « Débogage USB »**.
3. Brancher en USB, **accepter la clé RSA** sur le tél (cocher « toujours autoriser »).
4. Vérifier : `adb devices` → ta ligne en état `device` (pas `unauthorized`).
   - `adb` est dans `%ANDROID_HOME%\platform-tools\` (ou installé via winget `Google.PlatformTools`).

---

## 2. Premier build + install (une fois par machine / après ajout de natif)

Téléphone **branché** (l'install se fait sur l'appareil connecté en fin de build) :
```powershell
cd apps\mobile
npx expo run:android
```
- 1ʳᵉ fois : **long** (~10-20 min) — prebuild (`android/` généré) + compilation native (NDK).
- Accepter les licences si demandé :
  `& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses` (si `cmdline-tools`
  présent ; sinon via Android Studio → SDK Manager).
- En fin : install + lancement auto du dev build, connecté à Metro.

### Conflit de signature à l'install
Si un **APK EAS (preview/production)** est déjà installé, l'install locale échoue :
```
INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match
```
→ désinstaller l'app d'abord, puis relancer `npx expo run:android` :
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" uninstall com.wellness.app
```
> ⚠️ Désinstaller **efface la base locale** (SQLite) de l'app : on repart d'un compte/onboarding vierge.

---

## 3. Recettes suivantes (au quotidien)

Le dev build est déjà installé → **pas de rebuild** pour un changement **JS** :
```powershell
cd apps\mobile
npm run android        # démarre Metro + ouvre le dev build sur le tél
```
- Recharger le JS après une modif : touche **`r`** dans le terminal Metro.
- Un **rebuild** (`npx expo run:android`) n'est nécessaire **que** si on ajoute/mette à jour une
  **dépendance native** (nouveau module natif, changement de config Android).

---

## 4. Mode B — APK autonome (release, sans Metro ni câble)

But : produire **un fichier `.apk` autonome** qu'on installe sur n'importe quel téléphone par
simple transfert (mail, Drive/OneDrive, Teams, clé USB), **sans Metro et sans câble** à
l'utilisation. Idéal quand le quota EAS est épuisé.

Deux points qui rendent ça possible sans config supplémentaire :
- Le build type `release` est signé avec la **`debug.keystore`** du projet (voir
  [android/app/build.gradle](../../../apps/mobile/android/app/build.gradle)) → APK **signé et
  installable** directement, pas de keystore à générer.
- Les variables `EXPO_PUBLIC_*` du fichier [.env](../../../apps/mobile/.env) local sont
  **embarquées dans le bundle** au moment du build (Expo CLI les inline) → l'app tourne en
  autonomie (Supabase, PowerSync) sans Metro.

### Prérequis
Les **mêmes que §1** (JDK 17, Android SDK + NDK). En revanche, pour **installer** l'APK, le
téléphone n'a **pas besoin** du mode développeur/débogage USB — juste d'autoriser l'installation
d'« applis de sources inconnues ».

### Build
```powershell
cd apps\mobile\android
.\gradlew.bat assembleRelease
```
- 1ᵉʳ build : long (compilation native). Les suivants sont plus rapides (cache Gradle).
- APK produit :
  ```
  apps\mobile\android\app\build\outputs\apk\release\app-release.apk
  ```
- Cet APK est **autonome** : le JS est bundlé dedans, aucun besoin de Metro ni du câble ensuite.

### Installer sur le téléphone (sans fil)
1. Transférer `app-release.apk` sur le tél : mail à soi-même, Google Drive/OneDrive, Teams, ou
   copie via clé USB.
2. Ouvrir le fichier sur le tél → autoriser « installer des applis de sources inconnues » si
   demandé → installer.

### ⚠️ Conflit de signature avec un dev build déjà installé
L'APK release (signé `debug.keystore` **du projet**) et un dev build EAS ont le même
`applicationId` (`com.wellness.app`) mais des **signatures différentes** → Android refuse
l'install par-dessus (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). **Désinstaller d'abord** l'app
existante sur le tél, puis installer l'APK.
> ⚠️ Désinstaller **efface la base locale** (SQLite) de l'app : compte/onboarding repartent à zéro.

### Quand rebuilder ?
Contrairement au mode A, **tout** changement (JS **ou** natif) impose un nouveau
`gradlew.bat assembleRelease` puis une réinstallation : le JS est figé dans l'APK, il n'y a pas
de Metro pour recharger.

---

## 5. Fichiers locaux (non commités)

Ces fichiers sont **spécifiques au poste** et **gitignorés** (ne pas committer) :
- `C:\Users\<user>\.gradle\gradle.properties` — pin du JDK 17 (§1.2).
- `apps/mobile/android/local.properties` — chemin du SDK (filet si `ANDROID_HOME` absent) :
  ```properties
  sdk.dir=C:/Users/<user>/AppData/Local/Android/Sdk
  ```
- `apps/mobile/android/` — dossier natif régénéré par `expo prebuild` / `expo run:android`
  (projet **managed**, `android/` non versionné).

---

## 6. Dépannage rapide

| Erreur | Cause | Fix |
|---|---|---|
| `SDK location not found` | `ANDROID_HOME` non vu par le terminal | §1.4 + rouvrir le terminal, ou créer `local.properties` (§4). |
| Erreur de version Java / Kotlin / AGP | JDK 21/25 utilisé | Pin JDK 17 via `~/.gradle/gradle.properties` (§1.2). |
| `No version of NDK matched …` | NDK absent/mauvaise version | Installer la version **exacte** du log (`ndk:`), cf. §1.3. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | APK EAS déjà installé (autre signature) | `adb uninstall com.wellness.app` puis relancer (§2). |
| `adb: no devices/emulators found` | Tél non autorisé / câble | Réaccepter la popup RSA, `adb devices`, changer de câble (§1.5). |
| Le JS corrigé n'apparaît pas | App **release** (preview/prod) installée → JS embarqué, pas connecté à Metro | Installer un **dev build** (§2) — seul un build `development`/debug se connecte à Metro. |
| APK autonome (mode B) crashe au lancement / pas de connexion | `.env` absent ou vide au build → `EXPO_PUBLIC_*` non embarquées | Vérifier [apps/mobile/.env](../../../apps/mobile/.env) (cf. `.env.example`) **avant** `gradlew.bat assembleRelease`. |
