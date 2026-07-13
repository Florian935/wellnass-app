# Dev build Android en local (sans EAS) — procédure

But : installer et lancer l'app **en mode debug sur un téléphone Android physique**, en
compilant **en local** (sans consommer de quota de build EAS). Le build produit est un
**development build** (debuggable) connecté à **Metro** : le JS est servi en direct, donc un
correctif JS ne nécessite **aucun rebuild** (juste `r` dans Metro ou relancer `npm run android`).

> Rédigé le 13/07/2026 après la mise en place sur le poste de Florian (Windows 10).
> Cible : que **Damien** (ou tout dev) puisse reproduire la même chose.

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

## 4. Fichiers locaux (non commités)

Ces fichiers sont **spécifiques au poste** et **gitignorés** (ne pas committer) :
- `C:\Users\<user>\.gradle\gradle.properties` — pin du JDK 17 (§1.2).
- `apps/mobile/android/local.properties` — chemin du SDK (filet si `ANDROID_HOME` absent) :
  ```properties
  sdk.dir=C:/Users/<user>/AppData/Local/Android/Sdk
  ```
- `apps/mobile/android/` — dossier natif régénéré par `expo prebuild` / `expo run:android`
  (projet **managed**, `android/` non versionné).

---

## 5. Dépannage rapide

| Erreur | Cause | Fix |
|---|---|---|
| `SDK location not found` | `ANDROID_HOME` non vu par le terminal | §1.4 + rouvrir le terminal, ou créer `local.properties` (§4). |
| Erreur de version Java / Kotlin / AGP | JDK 21/25 utilisé | Pin JDK 17 via `~/.gradle/gradle.properties` (§1.2). |
| `No version of NDK matched …` | NDK absent/mauvaise version | Installer la version **exacte** du log (`ndk:`), cf. §1.3. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | APK EAS déjà installé (autre signature) | `adb uninstall com.wellness.app` puis relancer (§2). |
| `adb: no devices/emulators found` | Tél non autorisé / câble | Réaccepter la popup RSA, `adb devices`, changer de câble (§1.5). |
| Le JS corrigé n'apparaît pas | App **release** (preview/prod) installée → JS embarqué, pas connecté à Metro | Installer un **dev build** (§2) — seul un build `development`/debug se connecte à Metro. |
