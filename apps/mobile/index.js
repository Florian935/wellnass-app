// US LAUNCHER-01 — enregistre la tâche de fond du widget d'écran d'accueil AVANT tout le reste.
//
// Root cause d'un widget resté transparent (constaté en recette le 03/08/2026, logcat à l'appui) :
// après un WIDGET_ADDED à froid, Android relance le process et appelle la tâche de fond du widget
// ~1,7 s après le démarrage — mais `registerWidgetTaskHandler` ne s'exécutait qu'au fond du graphe
// de require d'Expo Router (_layout.tsx → i18n → PowerSync → tous les écrans...), qui met lui plus
// de 3,5 s à charger. Résultat : « No task registered for key RNWidgetBackgroundTask » côté natif,
// et le widget reste dans son état par défaut (transparent, jamais dessiné).
//
// Correctif : enregistrer la tâche en tout premier, avant même Expo Router — c'est le patron
// standard des tâches Headless JS React Native (registre au niveau le plus haut possible du
// bundle, jamais dans un composant profondément imbriqué).
import './src/widgets/register-home-widget';

import 'expo-router/entry';
