# Spike 001 — Validation de PowerSync (offline-first)

> **Spike = expérience jetable et bornée**, destinée à **valider ou invalider** un choix technique
> **avant** de s'engager. Le code produit ici n'est **pas** destiné à la production : on le jette ensuite.
> Lié à : [ADR-001](../../adr/ADR-001-moteur-sync-offline.md).

---

## Objectif

Vérifier que **PowerSync + Supabase + Expo (dev build)** tient nos exigences offline-first **avant** de figer l'ADR-001 et de construire le vrai modèle de données dessus.

## Critères de réussite (ce que le spike doit prouver)

1. ✅ **Build** : une app Expo (dev build Android) intègre PowerSync sans blocage majeur.
2. ✅ **Écriture offline** : créer/modifier une donnée **en mode avion** → c'est **persistant localement** et lisible immédiatement.
3. ✅ **Synchro montante** : au retour du réseau, la donnée locale **remonte** dans Supabase **automatiquement**.
4. ✅ **Synchro descendante** : une donnée modifiée côté Supabase (ou depuis un 2ᵉ appareil) **redescend** dans l'app.
5. ✅ **Conflit** : modifier la **même** donnée offline sur 2 appareils, puis reconnecter → observer le comportement de résolution (et confirmer qu'il est **acceptable/configurable**).
6. ✅ **DX/effort** : l'effort d'intégration est **raisonnable pour 2 devs** (jugement qualitatif).

> Si un critère **bloquant** (1–4) échoue → repli sur l'option C (Legend-State) de l'ADR-001.

## Périmètre du spike (volontairement minuscule)

- **Une seule entité** jouet (ex. une table `notes` ou `todos` : `id`, `text`, `updated_at`).
- Un écran : liste + ajout + édition. **Aucune** des vraies features muscu.
- **Aucun** souci d'UI/design : c'est un banc de test.

## Pré-requis à provisionner (côté porteur du projet) 🔑

> Ces étapes nécessitent des comptes/clés que **je ne peux pas créer à ta place**. Je te guiderai pas à pas.

1. **Projet Supabase** (offre gratuite) → récupérer : `Project URL`, `anon key`, et les **identifiants de connexion Postgres** (host, mot de passe DB).
2. **Compte + instance PowerSync** (offre gratuite) → connectée au projet Supabase (réplication logique Postgres à activer).
3. **Environnement Android de dev** pour lancer un **dev build** :
   - soit un **émulateur Android** (Android Studio),
   - soit un **téléphone Android** physique + Expo Dev Client.
   - (Rappel : **Expo Go ne suffit pas** — PowerSync a un module natif.)

## Déroulé prévu

1. Provisionner Supabase + PowerSync (toi, avec mon guidage).
2. Je scaffolde une **mini-app Expo jetable** (hors du futur vrai repo) avec PowerSync.
3. On configure les **sync rules** PowerSync + le **connecteur** d'upload vers Supabase.
4. On déroule les **6 critères de réussite** ci-dessus.
5. On **consigne le verdict** dans l'ADR-001 (figé ✅ ou repli ↩️).

## Livrable

- Un verdict **clair** (✅/↩️) reporté dans l'ADR-001.
- Quelques notes d'apprentissage (pièges, contraintes, effort réel) pour le vrai build.
- Le code du spike est **jeté** (ou archivé hors du repo principal).
