---
id: RUN-F2a
titre: "Annonces audio périodiques"
roadmap: [5.19]
catalogue: []
etape: validation
branche: feature/runf2a-annonces-audio
maj: 02/08/2026
---

# US RUN-F2a — Annonces audio périodiques

> **Scindée de RUN-F2 le 02/08/2026** (backlog). RUN-F2 regroupait 4 items de roadmap hétérogènes
> (5.19, 5.23, 5.9, 5.18) — trop inégaux en taille et en dépendances pour un seul incrément. Celle-ci
> est la plus petite et la plus autonome des quatre : aucune dépendance aux blocs fractionnés
> (RUN-F2c) ni à la cible en temps réel (RUN-F2b), et elle introduit `expo-speech`, brique dont
> RUN-F2d (guidage vocal fractionné) aura ensuite besoin.

## 0. Ce qui existe déjà, et ce qui manque

`run/active.tsx` calcule déjà en direct tout ce qu'il faut annoncer : `distanceM` (réactif à chaque
flush du tracker), `elapsedSeconds` (horloge locale), `avgPaceValue`/`instantPaceValue` (allure).
**Rien de ce calcul n'est à refaire.** Ce qui manque entièrement :
- `expo-speech` : absent du projet, module natif → **nouveau dev build EAS requis** avant toute
  recette device (même situation que `expo-haptics` pour MUSC-F9 — le module natif n'est pas déjà
  compilé dans le dev build existant).
- Un réglage utilisateur (le roadmap dit « paramétrable ») : rien n'existe aujourd'hui pour
  configurer un comportement de course (`autoPause` est câblé en dur à `true`, jamais exposé à
  l'utilisateur) — ce sera le premier réglage de ce type, posé sur `running_profiles` (déjà le
  logement des préférences course : objectif, niveau, allure de référence, fréquence).
- Le déclenchement d'une annonce à chaque franchissement de seuil de distance — rien n'existe.

## 1. Décision de conception — déclenché depuis l'écran, pas depuis la tâche de fond

**Les annonces se déclenchent depuis `run/active.tsx` (contexte React, premier plan), pas depuis
`tracker-task.ts` (tâche de fond).** Alternative écartée consciemment : appeler `Speech.speak()`
directement dans `handleLocationBatch` aurait permis un fonctionnement écran verrouillé/app en
arrière-plan, mais cela ajoute une vraie inconnue (lecture audio depuis une tâche de fond sans
configuration de session audio dédiée, non garantie sur iOS/Android) **dans le fichier le plus
sensible du projet** (RUN-F1b vient d'y toucher ; CLAUDE.md le désigne comme le plus gros risque).
Le rapport coût/valeur ne le justifie pas pour une première version.

**Limite assumée et documentée, avec un cas réel bien plus fréquent que l'écran verrouillé** : les
annonces ne se déclenchent que lorsque `run/active.tsx` est **monté**. Deux façons concrètes de le
démonter pendant une course active, toutes deux déjà présentes dans l'app :
- **Écran verrouillé / app mise en arrière-plan** (cas le plus rare en pratique) ;
- **Changer d'onglet dans l'app** (ex. consulter Nutrition ou l'Accueil pendant la course) — le
  tracker continue de tourner en tâche de fond (foreground service Android) et la distance continue
  d'avancer, mais `run/active.tsx` est démonté : **aucune annonce ne se déclenche tant qu'on n'est
  pas revenu sur cet écran**, même app au premier plan. C'est le cas le plus probable en usage réel,
  pas un cas limite théorique — à documenter en recette (critère 7), pas seulement le verrouillage.

Si c'est insuffisant en usage réel, un futur candidat pourra explorer le déclenchement en tâche de
fond avec une session audio configurée, une fois que la valeur du besoin est confirmée.

## 2. Les règles

**R1 — Un réglage à deux volets, sur `running_profiles`** : `voiceAnnouncementsEnabled` (booléen,
**défaut désactivé**) et `voiceAnnouncementIntervalM` (entier, mètres, **défaut 1000**, choix parmi
500 / 1000 / 2000). Défaut désactivé — pas activé — car une annonce vocale peut interrompre une
musique/un podcast en cours (aucune configuration de mixage audio n'est ajoutée par cette US, spec
R5) : mieux vaut un opt-in explicite qu'une surprise à la première course après mise à jour (même
philosophie prudente que CYCLE-01 pour un comportement nouveau et intrusif).

**R2 — Annonce à chaque franchissement d'un multiple de l'intervalle, jamais deux fois le même.**
Un compteur interne (« dernier seuil annoncé ») avance d'un cran à chaque franchissement. Il est
**initialisé depuis la distance courante au montage de l'écran** (`Math.floor(distanceM /
intervalM)`), pas depuis 0. **Cas réel, pas hypothétique** (relu) : le hub course
(`(tabs)/running.tsx`) et `run/index.tsx` affichent tous deux une carte « Reprendre » qui renvoie
sur `run/active.tsx` dès qu'une course est active — quitter l'onglet Course puis y revenir est un
chemin de navigation **normal et fréquent** pendant une course, pas un cas limite. Sans cette
initialisation, rouvrir l'écran à 3,4 km redéclencherait en rafale les annonces de 1, 2 et 3 km.

**R3 — Contenu de l'annonce : distance, temps, allure — dans cet ordre, une seule phrase, pluriels
i18next corrects.** Ex. FR : « 3 kilomètres, 18 minutes, allure 5 minutes 30 au kilomètre. »
[docs/specs/technical/i18n.md](../../technical/i18n.md) impose la syntaxe plurielle i18next
(`_one`/`_other` + paramètre `count`) — **jamais une concaténation manuelle** qui produirait « 1
kilomètres » ou « 1 minutes » à la première annonce. La distance et le temps sont donc deux
fragments **pluralisés indépendamment** (chacun son propre `count`), composés en une seule phrase,
plutôt qu'un unique gabarit à deux compteurs (i18next pluralise par appel, pas par variable
interpolée dans un gabarit partagé).

**R3 bis — Unité de distance selon l'intervalle : mètres sous 1 km, kilomètres entiers sinon.** Avec
un intervalle de 500 m, les seuils tombent aussi sur des demi-kilomètres (500 m, 1500 m…). Plutôt que
de prononcer une décimale (« 1,5 kilomètre », ambigu à l'oral) ou une forme composée (« 1 kilomètre
500 »), la règle est simple : un seuil multiple de 1000 m s'annonce en kilomètres entiers, tout autre
seuil s'annonce en mètres (500, 1500, 2500…) — jamais une valeur décimale lue à voix haute. Les
minutes, elles, sont arrondies à l'entier (pas de secondes lues).

**R4 — GPS uniquement.** Une course manuelle (`source='manual'`) n'a pas de distance qui progresse
en direct (saisie a posteriori) — aucune annonce n'est possible, comme l'allure instantanée
aujourd'hui (déjà limitée à `isGps`).

**R5 — Aucune gestion de mixage audio ajoutée.** L'annonce coupe ou se superpose à un autre flux
audio selon le comportement par défaut de la plateforme/d'`expo-speech` — pas de configuration de
session audio dédiée dans cette US (ce serait un chantier séparé si le comportement par défaut
s'avère mauvais en usage réel, cf. §1).

**R6 — La pause suspend naturellement les annonces.** Aucune règle dédiée nécessaire : la distance
ne progresse pas pendant une pause (comportement déjà existant du tracker), donc aucun nouveau seuil
n'est jamais franchi pendant ce temps.

## 3. Périmètre

**Dans le périmètre** :
- Ajout d'`expo-speech` (dépendance native neuve).
- `running_profiles` : 2 colonnes (`voice_announcements_enabled`, `voice_announcement_interval_m`).
- Réglage dans `running-profile.tsx` : un `Switch` (RN, déjà utilisé pour CYCLE-01) + un choix
  d'intervalle (500 m / 1 km / 2 km) affiché seulement quand le réglage est activé.
- Déclenchement dans `run/active.tsx` : effet réactif sur `active.distanceM`, franchissement de
  seuil → `Speech.speak(phrase)`.
- i18n de la phrase annoncée (R3), FR + EN — texte parlé, pas juste un libellé d'écran.

**Hors périmètre** :
- Fonctionnement garanti écran verrouillé / arrière-plan (§1, limite assumée).
- Configuration de session audio / ducking d'une musique en cours (R5).
- Tout ce qui dépend des blocs fractionnés ou de la cible en temps réel (RUN-F2c/RUN-F2d/RUN-F2b,
  candidats distincts).
- Réglage de la voix/langue TTS (utilise la langue système par défaut d'`expo-speech`).

## 4. i18n

Nouvelle famille `running.announcement.*`, FR + EN — **texte parlé**, pas un libellé d'écran.
Fragments pluralisés indépendamment (R3/R3 bis), composés en phrase plutôt qu'un gabarit unique à
plusieurs compteurs :
- `distanceKm_one` / `distanceKm_other` — « {{count}} kilomètre » / « {{count}} kilomètres »
  (EN : « {{count}} kilometer » / « {{count}} kilometers »).
- `distanceM_other` — « {{count}} mètres » (EN : « {{count}} meters ») — un seul cas au pluriel
  suffit ici, aucun seuil en mètres ne peut valoir 1 (intervalles 500/1000/2000, jamais 1 m).
- `minutes_one` / `minutes_other` — « {{count}} minute » / « {{count}} minutes » (EN idem).
- `pacePart` — « allure {{pace}} au kilomètre » / « pace {{pace}} per kilometer ».
- `template` — « {{distance}}, {{time}}, {{pace}}. » (assemble les 3 fragments déjà traduits).
- Réglages (`running-profile.tsx`) : `announcementsToggle` (« Annonces vocales » / « Voice
  announcements »), `announcementsInterval` (« Fréquence » / « Frequency »).

Note plan : l'unité impériale (miles) n'est pas traitée dans cette US (annonce toujours en
kilomètres/mètres, quel que soit le réglage d'unité) — `units.formatPace`/`formatDistance`
gèrent déjà la conversion **visuelle**, mais convertir la phrase **parlée** en miles est un
chantier à part si le besoin est confirmé, non bloquant pour une première version.

## 5. Comportement offline

**Total.** `expo-speech` est un moteur TTS **embarqué** (natif iOS/Android), aucun appel réseau,
aucune dépendance à un service tiers. Fonctionne en mode avion comme le reste du tracker.

## 6. Accessibilité

Les annonces vocales sont un **canal supplémentaire**, jamais un remplacement de l'affichage visuel
existant (distance/temps/allure restent affichés à l'écran comme aujourd'hui). Le réglage
(`Switch` + choix d'intervalle) suit les mêmes conventions d'accessibilité que le reste de l'écran
profil (labels déjà `accessibilityLabel`-friendly via les composants partagés).

## 7. Critères de recette

- [ ] 1. Réglage désactivé (défaut) → aucune annonce pendant toute une course GPS.
- [ ] 2. Réglage activé, intervalle 1 km → une annonce à 1, 2, 3 km, etc., jamais deux fois au même
      kilomètre.
- [ ] 3. Intervalle changé à 500 m → annonces deux fois plus fréquentes.
- [ ] 4. Rouvrir l'écran de suivi après avoir navigué ailleurs (ex. revenir sur l'onglet course puis
      rouvrir le suivi) à 3,4 km ne redéclenche pas les annonces de 1 km, 2 km, 3 km (R2).
- [ ] 5. Une course manuelle n'émet jamais d'annonce, quel que soit le réglage (R4).
- [ ] 6. La phrase annoncée est prononçable et grammaticale en FR **et** en EN (pas de nombre à
      rallonge, pas de décimale lue à voix haute).
- [ ] 7. **Device réel, écran verrouillé pendant le suivi** : noter si les annonces continuent ou
      s'arrêtent — comportement non garanti (§1), mais à documenter tel qu'observé.
- [ ] 8. **Device réel, changer d'onglet (ex. Nutrition) pendant la course puis revenir via
      « Reprendre »** : aucune annonce pendant l'absence de l'écran (§1) ; au retour, aucune rafale
      des seuils déjà franchis pendant ce temps (R2) — le cas le plus probable en usage réel, à ne
      pas confondre avec le critère 7 (verrouillage).
- [ ] 9. **Mode avion** : les annonces fonctionnent normalement (aucun réseau requis).
- [ ] 10. Une pause manuelle suspend les annonces (aucune pendant la pause), la reprise ne rattrape
      pas les seuils manqués pendant l'arrêt (ils n'ont pas été franchis, R6).
