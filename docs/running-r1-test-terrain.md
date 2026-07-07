# Protocole de test terrain — Running R1 (tracker GPS nu)

> Validation device de R1 (Task 10) — le **vrai juge** du tracker (GPS arrière-plan, écran
> verrouillé, batterie, offline, reprise). À faire en marchant dehors, APK **preview** installé.
> Coche au fur et à mesure ; note ce qui coince (on corrige avant R2).

## Réglages Android préalables (Pixel 6a — Android stock) — INDISPENSABLES

Sans ces deux réglages, le suivi meurt dès que l'écran se verrouille ou après quelques minutes.

### 1. Localisation « Autoriser tout le temps »
Android ne le propose pas dans la 1ʳᵉ popup (il faut le mettre à la main) :
1. Lance une 1ʳᵉ course → à la demande de permission, choisis **« Lorsque l'appli est utilisée »**.
2. Puis : **Réglages → Applications → Wellness → Autorisations → Localisation**
   (ou **Réglages → Localisation → Autorisations des applis → Wellness**).
3. Sélectionne **« Toujours autoriser »**.
4. Vérifie que **« Utiliser la localisation précise »** est **activé**.

### 2. Batterie « Sans restriction »
1. **Réglages → Applications → Wellness → Batterie**
   (ou **… → Wellness → Utilisation de la batterie par l'appli**).
2. Choisis **« Sans restriction »** (et non « Optimisée » / « Restreinte »).
3. Pendant une course, **ne balaie pas** la notification persistante « Course en cours ».

---

## Checklist de test (coche sur le tel)

### A. Démarrage & permissions
- [ ] Connexion à l'app OK (compte existant).
- [ ] Onglet **Running → Démarrer une course libre** lance le suivi.
- [ ] La demande de permission localisation apparaît (1ʳᵉ fois).
- [ ] Refus de permission → l'app propose **« continuer sans GPS »** (bascule en mode manuel), pas d'écran bloqué.

### B. Suivi de base (marche ~5 min)
- [ ] **Distance** augmente de façon cohérente avec ta marche.
- [ ] **Temps écoulé** défile à la seconde.
- [ ] **Allure moyenne** affichée et plausible.
- [ ] **Allure instantanée** réagit quand tu accélères / ralentis.
- [ ] La **notification persistante** « Course en cours » est visible.

### C. Écran verrouillé & arrière-plan (LE point critique)
- [ ] **Verrouille l'écran** et marche 3-5 min → au déverrouillage, distance/temps ont **continué** (pas de gel).
- [ ] **Bascule sur une autre app** (arrière-plan) 3-5 min → au retour, la course a **continué**.
- [ ] Actions **pause / reprise** depuis la **notification** (écran verrouillé) fonctionnent.
- [ ] Aucune interruption / redémarrage inattendu du suivi.

### D. Auto-pause
- [ ] Arrête-toi ~15 s (feu rouge simulé) → la course passe **auto en pause** (le bouton affiche « Reprendre »).
- [ ] Repars → **reprise automatique**, le temps de pause **n'est pas** compté dans la durée.
- [ ] Seuils ressentis OK ? (sinon noter : trop sensible / pas assez — actuel : < 0,5 m/s pendant 8 s).

### E. Offline (mode avion)
- [ ] Active le **mode avion** en cours de course → le suivi **continue** normalement (distance/temps).
- [ ] Termine la course en mode avion → elle s'enregistre (résumé s'affiche).
- [ ] Repasse online → *(si le cloud est activé)* la course **remonte** ; sinon elle reste locale (OK pour ce test).

### F. Reprise après kill
- [ ] Pendant une course, **tue l'app** (balaie depuis le multitâche).
- [ ] Rouvre l'app → la course active est **reprise** (ou au minimum retrouvée, sans perte totale).
- [ ] ⚠️ Vérifier le caveat : après relance du process par Android, les nouveaux points GPS sont-ils bien repris ? (noter le comportement observé).

### G. Batterie (course longue)
- [ ] Fais une course de **30-45 min** → note la conso batterie (%) — doit rester raisonnable.
- [ ] Pas de surchauffe anormale.

### H. Résumé & données
- [ ] Écran de **résumé** : distance / durée / allure cohérentes avec la réalité.
- [ ] Saisie **RPE** + **note** persistées.
- [ ] Mode manuel : saisie **distance** au résumé → allure recalculée.

### I. i18n & isolation (optionnel, si 2 comptes)
- [ ] Bascule **FR/EN** : libellés course/notif traduits.
- [ ] Avec un **2ᵉ compte** : ne voit pas les courses du 1er (RLS) — *nécessite le cloud activé*.

---

## À rapporter
Pour chaque échec : **quoi** (étape), **quand** (écran verrouillé ? arrière-plan ? après combien de temps ?),
et **ce que tu as vu** (gel, redémarrage, distance figée, batterie…). Ces retours pilotent les
correctifs avant R2 (carte).

> Rappel : pour une **synchro cloud** réelle (sections E/I), la migration `runs` + le stream doivent
> être appliqués côté cloud (section 🔴 du TODO). Sans ça, tout le reste (tracker, offline local,
> résumé) se teste quand même — la course reste juste sur le téléphone.
