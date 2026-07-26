# Environnement de développement local (Windows)

Mise en place d'un poste Windows pour développer et builder l'app mobile.
Référence : poste `DESKTOP-DBMKL8J` configuré le 26/07/2026.

## 1. Versions de référence

| Outil | Version | Emplacement |
|---|---|---|
| Node.js | 24.11.1 (≥ 20 requis) | `C:\Program Files\nodejs` |
| npm | 11.6.2 | — |
| Git | 2.51.2 | `C:\Program Files\Git` |
| **JDK** | **Temurin 17.0.19+10** | `C:\Users\<user>\dev-tools\jdk-17` |
| Android SDK Platform | **36** (Android 16) | `%LOCALAPPDATA%\Android\Sdk` |
| Android Build-Tools | **36.0.0** | idem |
| Android Platform-Tools | 37.0.0 (`adb`) | idem |
| **NDK** | **27.1.12297006** | idem |
| CMake | 3.22.1 | idem |
| Gradle | 9.3.1 (via wrapper) | téléchargé par `gradlew` |

> **JDK 17 obligatoire.** React Native 0.86 / Expo SDK 57 exigent le JDK 17 ; une version
> supérieure fait échouer le build Gradle. La version du NDK est celle épinglée par React Native
> dans `node_modules/react-native/gradle/libs.versions.toml` (`ndkVersion`) — la vérifier après
> chaque montée de version de RN.

## 2. Installation (sans droits administrateur)

Tout s'installe dans le profil utilisateur, via archives ZIP — aucun UAC, entièrement réversible.

### JDK 17

```powershell
# URL et empreinte fournies par l'API Adoptium :
#   https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse
curl.exe -L -o "$env:TEMP\jdk17.zip" `
  "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.19%2B10/OpenJDK17U-jdk_x64_windows_hotspot_17.0.19_10.zip"
(Get-FileHash "$env:TEMP\jdk17.zip" -Algorithm SHA256).Hash   # vérifier avant d'extraire
Expand-Archive "$env:TEMP\jdk17.zip" -DestinationPath "$env:USERPROFILE\dev-tools"
# puis renommer le dossier extrait en « jdk-17 »
```

### Android SDK (command line tools)

⚠️ **Extraire depuis un chemin court** (`C:\Users\<user>\`) : certains fichiers de l'archive
dépassent la limite MAX_PATH de 260 caractères et l'extraction échoue silencieusement à
mi-parcours depuis un chemin profond.

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
curl.exe -L -o "$env:USERPROFILE\cli.zip" `
  "https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip"
Expand-Archive "$env:USERPROFILE\cli.zip" -DestinationPath "$sdk\cmdline-tools"
Rename-Item "$sdk\cmdline-tools\cmdline-tools" "latest"
```

### Paquets SDK

`sdkmanager` demande la validation interactive des licences : rediriger un fichier de `y`.

```cmd
set JAVA_HOME=C:\Users\<user>\dev-tools\jdk-17
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set SDKM=%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat

call "%SDKM%" --licenses < yes.txt
call "%SDKM%" --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" ^
                        "ndk;27.1.12297006" "cmake;3.22.1" < yes.txt
call "%SDKM%" --list_installed
```

### Variables d'environnement (portée utilisateur)

| Variable | Valeur |
|---|---|
| `JAVA_HOME` | `C:\Users\<user>\dev-tools\jdk-17` |
| `ANDROID_HOME` | `%LOCALAPPDATA%\Android\Sdk` |
| `ANDROID_SDK_ROOT` | idem (héritage, certains outils le lisent encore) |

Ajouter au `Path` : `%JAVA_HOME%\bin`, `%ANDROID_HOME%\platform-tools`,
`%ANDROID_HOME%\cmdline-tools\latest\bin`, `%ANDROID_HOME%\emulator`.

> Ne **jamais** utiliser `setx` pour modifier `Path` : la commande le tronque au-delà de
> 1024 caractères. Passer par l'interface Windows ou par le registre
> (`HKCU\Environment`, en conservant le type `REG_EXPAND_SZ`).

## 3. Mise en route du dépôt

```powershell
cd c:\wellness-app\wellnass-app
npm install                                  # monorepo npm workspaces
Copy-Item apps\mobile\.env.example apps\mobile\.env
npm run typecheck ; npm run test             # contrôle de santé
```

Compléter ensuite dans `apps/mobile/.env` les deux clés laissées vides par l'exemple :
`EXPO_PUBLIC_MAPTILER_KEY` (carte running) et `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (OAuth Google).
Sans elles, la carte et la connexion Google ne fonctionnent pas ; le reste de l'app tourne.

## 4. Builder l'APK en local

Le dépôt est en **workflow managé** : le dossier `apps/mobile/android/` n'est pas versionné
(voir [.gitignore](../../../apps/mobile/.gitignore)). Il faut donc le **générer** avant tout
appel à `gradlew` — c'est l'étape qu'on oublie facilement sur un poste neuf.

```powershell
cd apps\mobile
npx expo prebuild --platform android         # génère android/ + gradlew
```

Créer `apps/mobile/android/local.properties` (non versionné) :

```properties
sdk.dir=C\:\\Users\\<user>\\AppData\\Local\\Android\\Sdk
```

Puis, depuis `apps/mobile/android/` :

| Commande | Résultat |
|---|---|
| `.\gradlew.bat assembleDebug` | APK debug → `app\build\outputs\apk\debug\app-debug.apk` |
| `.\gradlew.bat assembleRelease` | **APK release** → `app\build\outputs\apk\release\app-release.apk` |
| `.\gradlew.bat bundleRelease` | AAB (Play Store) → `app\build\outputs\bundle\release\app-release.aab` |
| `.\gradlew.bat clean` | Nettoie les sorties de build |

### Réduire le temps de build local

`gradle.properties` déclare `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` : le C++
est donc compilé **4 fois**. Sur un premier build, c'est l'essentiel du temps (~50 min observées).
Pour du test sur un appareil physique — tous les Android récents sont en `arm64-v8a` — cibler une
seule architecture divise le temps par ~4 :

```powershell
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

L'APK produit ne tournera que sur arm64. Garder le build complet (4 ABI) pour ce qui est diffusé.

Installer sur un appareil branché en USB (débogage USB activé) :

```powershell
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

> **Signature.** Le template React Native signe le buildType `release` avec le **keystore de
> debug** (`android/app/build.gradle`, `signingConfig signingConfigs.debug`). L'APK produit est
> donc installable pour du test interne mais **non publiable** sur le Play Store. La signature de
> production est gérée par EAS (`npm run build:prod`) ; ne pas créer de keystore local en doublon.

> **`prebuild` écrase le dossier natif.** Toute modification manuelle dans `android/` est perdue au
> prochain `prebuild`. Les réglages natifs passent par `app.json` (plugins de configuration).

### Après un changement de dépendances natives

`npx expo prebuild --platform android --clean` puis rebuild. Le premier build natif est long
(compilation C++ via NDK : op-sqlite, reanimated, worklets) ; les suivants sont incrémentaux.

## 5. Développement au quotidien

L'app dépend de modules natifs (PowerSync, MapLibre, op-sqlite) : **Expo Go ne suffit pas**, il
faut un **dev build**.

```powershell
cd apps\mobile
.\android\gradlew.bat -p android assembleDebug   # ou : npm run build:dev (via EAS)
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
npm run start                                   # serveur Metro (--dev-client)
```

## 6. Dépannage

### `MalformedJsonException` sur une tâche `configureCMakeRelWithDebInfo[<abi>]`

```
Execution failed for task ':expo-modules-core:configureCMakeRelWithDebInfo[x86_64]'.
> com.google.gson.stream.MalformedJsonException: Use JsonReader.setLenient(true)
  to accept malformed JSON at line 1 column 1 path $
```

**Cause : un build natif précédent a été interrompu** (Ctrl+C, fermeture du terminal, arrêt de la
machine). Sous NTFS, la taille du fichier est écrite dans les métadonnées avant que les données
soient vidées sur le disque : après un arrêt brutal, les fichiers en cours d'écriture ont la bonne
taille mais sont **remplis d'octets NUL**. Le plugin Android Gradle relit ce JSON vide et échoue.

Ce n'est **pas** un problème d'installation — inutile de réinstaller le NDK ou le SDK.

**Correctif** — supprimer le dossier de la variante concernée (artefacts de build purs, CMake les
régénère). Le message d'erreur donne le module et l'ABI :

```powershell
Remove-Item -Recurse -Force `
  "node_modules\expo-modules-core\android\.cxx\RelWithDebInfo\*\x86_64"
```

Pour localiser précisément les fichiers corrompus (utile si plusieurs modules sont touchés) —
un dossier d'ABI sain contient ~100 fichiers, un dossier interrompu beaucoup moins :

```powershell
Get-ChildItem node_modules -Recurse -Directory -Filter ".cxx" | ForEach-Object {
  Get-ChildItem $_.FullName -Recurse -File | Where-Object { $_.Length -gt 0 -and $_.Length -lt 20MB } | ForEach-Object {
    if (([System.IO.File]::ReadAllBytes($_.FullName) | Where-Object { $_ -ne 0 }).Count -eq 0) { $_.FullName }
  }
}
```

En dernier recours, supprimer tous les dossiers `.cxx` force une recompilation native complète
(long, mais garanti propre) :

```powershell
Get-ChildItem node_modules -Recurse -Directory -Filter ".cxx" | Remove-Item -Recurse -Force
Remove-Item -Recurse -Force apps\mobile\android\app\.cxx
```

### `'gradlew.bat' n'est pas reconnu`

Lancer la commande **depuis `apps/mobile/android/`** et la préfixer par `.\` sous PowerShell
(`.\gradlew.bat`) : Windows ne cherche pas les exécutables dans le répertoire courant.
Depuis un autre dossier, utiliser `-p` : `.\android\gradlew.bat -p android assembleRelease`.

### `NODE_ENV environment variable is required but was not specified`

Avertissement bénin de `expo-constants` quand `gradlew` est appelé directement au lieu de passer
par Expo CLI. Le `.env` est bien chargé. Pour le faire taire : `set NODE_ENV=production`.

### `SDK XML file of version 4 was encountered`

Décalage bénin entre le plugin Android Gradle et des cmdline-tools plus récents. Sans effet.

## 7. Optionnel — émulateur

Un appareil physique reste préférable (GPS réel pour le pilier Running, synchro en arrière-plan).
Pour ajouter un émulateur :

```cmd
call "%SDKM%" --install "emulator" "system-images;android-36;google_apis;x86_64"
call "%ANDROID_HOME%\cmdline-tools\latest\bin\avdmanager.bat" create avd -n wellness -k "system-images;android-36;google_apis;x86_64"
emulator -avd wellness
```
