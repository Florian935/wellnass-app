/**
 * `keyboardEventNames` — recette MUSCU-UX01 §57.19.
 *
 * ── Le défaut ───────────────────────────────────────────────────────────────────────────────────
 * Sur l'écran de séance, ouvrir le clavier pour saisir une charge le faisait passer **par-dessus**
 * la barre de validation : on tapait sans voir ce qu'on tapait. C'était le geste le plus répété de
 * l'app, et c'était précisément ce que l'US MUSCU-UX01 devait corriger.
 *
 * La barre collante avait bien été livrée. Ce qui manquait, c'est que depuis Expo SDK 54
 * l'edge-to-edge est forcé sur Android : `android:windowSoftInputMode="adjustResize"` est toujours
 * au manifeste mais **ne redimensionne plus la fenêtre**. Un montage en colonne, si correct
 * soit-il, ne suffit plus — il faut lire la hauteur de l'IME et décaler soi-même.
 *
 * ── Pourquoi ce test porte sur les noms d'événements ────────────────────────────────────────────
 * C'est la seule vraie connaissance du module, et la seule qu'on puisse casser **sans que rien ne
 * le signale** : s'abonner à `keyboardWillShow` sur Android ne lève pas, ne prévient pas, n'écoute
 * simplement rien. Exactement le même profil de panne silencieuse que les deux requêtes SQL de
 * cette même recette.
 *
 * ⚠️ **Ce qui n'est PAS testé ici**, et pourquoi : le montage du hook lui-même (abonnement, état,
 * désabonnement). Sous RNTL v14, une mise à jour d'état déclenchée depuis un abonnement natif
 * mocké ne se propage pas au rendu — le test paraîtrait vert sans rien vérifier, ou rouge sans rien
 * prouver. Plutôt qu'un test décoratif, on s'en tient à la règle, et le comportement réel relève de
 * la recette device (§57.19). La plomberie restante — deux `addListener`, un `setState`, un
 * `remove` au démontage — est du React standard sans cas limite.
 */

import { keyboardEventNames } from '../useKeyboardHeight';

describe('keyboardEventNames', () => {
  it('🔴 sur Android, les `Did*` — la plateforme n’émet JAMAIS les variantes `Will*`', () => {
    expect(keyboardEventNames('android')).toEqual({
      show: 'keyboardDidShow',
      hide: 'keyboardDidHide',
    });
  });

  it('sur iOS, les `Will*` : ils arrivent avec l’animation, donc le décalage la suit', () => {
    expect(keyboardEventNames('ios')).toEqual({
      show: 'keyboardWillShow',
      hide: 'keyboardWillHide',
    });
  });

  it('toute autre plateforme se comporte comme Android — jamais d’abonnement muet', () => {
    expect(keyboardEventNames('web')).toEqual({
      show: 'keyboardDidShow',
      hide: 'keyboardDidHide',
    });
  });
});
