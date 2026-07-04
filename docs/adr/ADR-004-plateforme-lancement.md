# ADR-004 — Plateforme de lancement

- **Statut** : ✅ **Accepté**
- **Date** : 04/07/2026
- **Décideurs** : les 2 devs (Florian + Damien).
- **Lié à** : décision de cadrage [E — Plateforme de lancement](../../SYNTHESE-CADRAGE.md) · [roadmap versionnée](../roadmap/roadmap.md).

---

## Contexte

La stack est cross-platform (React Native + Expo), donc les deux plateformes sont techniquement atteignables. Les cadrages divergeaient sur le **périmètre de lancement** :

- **Position Flo** : **Android d'abord**, iOS plus tard.
- **Position Dams** : **iOS + Android ensemble** dès le lancement.

Enjeux : iOS impose un **compte Apple Developer** (coût annuel), une **review App Store** plus contraignante, et — dès qu'un OAuth tiers est proposé — l'**obligation d'offrir « Connexion avec Apple »**. Pour une équipe de 2, doubler la surface de conformité et de test au lancement est coûteux.

## Options envisagées

### A — Android d'abord, iOS plus tard *(retenu)*
- **+** Une seule cible à publier et tester au lancement. Pas de compte Apple Developer requis. Play Store moins contraignant à l'ouverture. Effort concentré.
- **−** Pas d'utilisateurs iOS au départ. Nécessite de rester rigoureusement cross-platform pour ne pas fermer la porte.

### B — iOS + Android ensemble
- **+** Couverture marché maximale dès J1.
- **−** Double surface de conformité (deux reviews, deux jeux de tests device), compte Apple Developer, OAuth Apple obligatoire, Live Activity iOS spécifique — charge lourde à 2 au moment le plus fragile.

## Décision

**Option A — Android d'abord, iOS plus tard.** On publie sur le **Play Store** au lancement ; iOS et l'App Store sont traités **ultérieurement**, une fois le produit stabilisé sur Android.

## Conséquences

- **Play Store au lancement** ; **pas de publication App Store** dans le périmètre initial (item 9.1 « App iOS » déplacé en section « Ultérieur — iOS » de la roadmap).
- **Pas de compte Apple Developer requis** au lancement (économie de coût et de démarches).
- **OAuth Apple hors périmètre initial** (item 1.3) : l'obligation « Connexion avec Apple » ne s'applique pas tant qu'on ne publie pas sur iOS. On **conserve OAuth Google** (item 1.2).
- **Rester sur des libs cross-platform** et éviter tout choix technique qui fermerait iOS : le portage iOS ultérieur doit rester une extension, pas une réécriture. Attention aux briques à équivalent iOS (ex. notification persistante Android ↔ Live Activity iOS pour le running écran verrouillé).
- Les briques à composante iOS spécifique (ex. écriture Apple Health via `react-native-health`) restent prévues côté Android (Health Connect) et sont complétées côté iOS lors du portage.
