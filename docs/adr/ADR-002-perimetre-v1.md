# ADR-002 — Périmètre de la V1

- **Statut** : ✅ **Accepté**
- **Date** : 04/07/2026
- **Décideurs** : les 2 devs (Florian + Damien).
- **Lié à** : décision de cadrage [A — Périmètre du premier livrable](../../SYNTHESE-CADRAGE.md) · [roadmap versionnée](../roadmap/roadmap.md) · [ADR-001](./ADR-001-moteur-sync-offline.md).

---

## Contexte

Les deux cadrages menés séparément décrivaient le même produit (app bien-être multi-piliers dont le différenciateur est **l'intégration** entre piliers), mais divergeaient sur le **périmètre du premier livrable** :

- **Position Flo** : livrer d'abord **la musculation seule** — un module excellent en autonomie, zéro dépendance externe, pour valider vite le produit et limiter le risque technique à un seul front (la synchro offline).
- **Position Dams** : livrer d'emblée **3 piliers** (muscu + running + nutrition), car c'est l'intégration inter-piliers qui constitue le différenciateur ; un seul pilier ne prouve pas la promesse produit.

Il fallait trancher entre **profondeur d'un seul pilier** et **démonstration de la promesse d'intégration**.

## Options envisagées

### A — Musculation seule (position Flo)
- **+** Un seul gros risque technique (synchro offline). Time-to-value court. Périmètre maîtrisable à 2.
- **−** Ne démontre pas le différenciateur (l'intégration). Risque de ressembler à un énième tracker muscu.

### B — 3 piliers : muscu + running + nutrition *(retenu)*
- **+** Démontre la promesse produit (piliers qui se parlent : calories adaptées à l'entraînement, coordination muscu/running, streak transverse). Couvre le trio d'apps que le produit veut remplacer.
- **−** **Deux** gros risques techniques (synchro offline **et** GPS running arrière-plan). Délai plus long. Exige une discipline de livraison par versions.

### C — muscu + nutrition (sans running)
- **+** Démontre déjà une intégration (calories/entraînement) sans le risque GPS.
- **−** Amputé du pilier le plus demandé par la cible « multi-apps » (Strava) ; reporter le running ne fait que déplacer le risque.

## Décision

**Option B — V1 = 3 piliers : Musculation + Running + Nutrition.**

Le différenciateur du produit est l'intégration ; le prouver dès la V1 justifie d'assumer le périmètre élargi de Dams. La [roadmap versionnée de Dams](../roadmap/roadmap.md) (V0.1 → V1.1) devient le **plan de référence**.

## Conséquences

- **Deux gros risques techniques** à piloter, au lieu d'un :
  1. la **synchro offline** (voir [ADR-001](./ADR-001-moteur-sync-offline.md)) ;
  2. le **GPS running en arrière-plan** (batterie, écran verrouillé, tracking fiable).
- **Le running est abordé en dernier des piliers** (V0.5), une fois la base stable — c'est le plus risqué techniquement.
- **Impératif de livrer par versions** : ne pas attendre que les 3 piliers soient finis pour confronter le produit à de vrais utilisateurs. **Chaque fin de version = un build installable et testable.** C'est la contrepartie non-négociable du choix B.
- **Délai plus long** que l'option muscu seule ; estimation de référence ~470 h de code brut (chiffres indicatifs, recalculés après arbitrages du 04/07/2026 — voir roadmap).
- Le principe **« intégration sans imposition »** s'applique : chaque pilier reste utile seul, l'intégration inter-piliers est une couche opt-in.
