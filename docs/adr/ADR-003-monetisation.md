# ADR-003 — Monétisation

- **Statut** : ✅ **Accepté**
- **Date** : 04/07/2026
- **Décideurs** : les 2 devs (Florian + Damien).
- **Lié à** : décision de cadrage [D — Monétisation](../../SYNTHESE-CADRAGE.md) · principe « intégration sans imposition ».

---

## Contexte

Le produit est pensé, à terme, comme un **vrai produit monétisé** (modèle freemium : on fait payer la *profondeur* et l'*intégration*, jamais l'accès de base). Les deux cadrages divergeaient sur le calendrier et l'outillage :

- **Position Flo** : câbler **RevenueCat multi-paliers dès le départ** (Premium muscu → Écosystème → IA), même si un seul palier payant est lancé, pour éviter une refonte ultérieure.
- **Position Dams** : décision de monétisation **ouverte**, pas de choix figé.

La question à trancher : quelle solution technique, et **quand** activer la monétisation ?

## Options envisagées

### A — RevenueCat câblé + palier payant actif dès la V1
- **+** Revenus dès le lancement. Force à clarifier tôt la proposition de valeur payante.
- **−** L'app est gratuite au lancement dans l'esprit du cadrage ; un paywall en V1 freine l'adoption et la collecte de retours pendant la phase la plus fragile. Grille de prix à figer prématurément.

### B — Aucune brique de monétisation en V1, tout ajouté plus tard
- **+** Simplicité immédiate.
- **−** Ajouter la couche *entitlements* après coup = refonte de l'accès aux fonctionnalités, risque de rétrofit coûteux.

### C — RevenueCat retenu, entitlements câblés tôt mais inactifs, aucun paywall en V1 *(retenu)*
- **+** Le câblage technique des *entitlements* multi-paliers est **peu coûteux** posé tôt et **évite une refonte** ; l'app reste **entièrement gratuite** au lancement (adoption + retours maximisés) ; on active la monétisation le moment venu par de la **configuration**, pas du code.
- **−** Un peu de plomberie non rentabilisée à court terme ; discipline requise pour ne pas laisser dormir un chantier à moitié fait.

## Décision

**Option C.** **RevenueCat** est la solution retenue. Les **entitlements multi-paliers sont câblés tôt** (peu coûteux, évite une refonte future). **Mais aucun paywall ni palier payant en V1** : l'application est **entièrement gratuite au lancement**. La monétisation sera activée **bien plus tard**.

## Conséquences

- **Câblage technique léger dès le départ** : intégration du SDK RevenueCat et définition des *entitlements* (Premium muscu → Écosystème → IA), **laissés inactifs**. Tâche optionnelle et sans écran de paiement dans la roadmap (« Câblage RevenueCat / entitlements (inactif) »).
- **Aucun écran de paiement, aucun paywall, aucune fonctionnalité verrouillée** en V1.
- La **grille de prix et le contenu des paliers** sont à définir **ultérieurement** (rediscussion dédiée le moment venu).
- Cohérence avec le principe **« sans imposition »** : quand la monétisation arrivera, elle fera payer la profondeur et l'intégration, jamais l'accès de base.
