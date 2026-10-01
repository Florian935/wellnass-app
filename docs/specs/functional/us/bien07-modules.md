---
id: BIEN-07
titre: "Les modules du pilier Bien-être — alcool, café tardif, sieste, fringales"
roadmap: [1.36]
catalogue: []
etape: recette
branche: dev
maj: 01/10/2026
---

# US BIEN-07 — Les modules

> Chantier « pilier Bien-être » — contexte et décisions dans [BIEN-02](bien02-pilier-bien-etre.md).
> Décision appliquée : **D6** (« en modules éteints par défaut ; l'hydratation est NUTR-12 »).
> Toile : planche « 02 · Les indicateurs » (33 indicateurs passés au crible) de
> [design/pilier-bien-etre-2026-10/](../../../../design/pilier-bien-etre-2026-10/).
> Plan : [docs/plans/bien07-modules.md](../../../plans/bien07-modules.md).

## 1. Le problème

Sur les 33 indicateurs passés au crible, une poignée intéresse **une partie** des gens et change une
décision **pour eux** : l'alcool (la nuit et la sortie du lendemain), le café tardif (la nuit), la
sieste (la nuit suivante, la forme), les fringales (l'assiette). Imposés à tous, ils rallongent le
rituel du soir pour rien ; absents, ils privent ceux qui en ont besoin.

## 2. Ce que fait l'US

Quatre interrupteurs dans les réglages du pilier, **éteints par défaut**. Chacun allumé ajoute **sa
question au check-in du soir**, et rien d'autre :

| Module | Question du soir | Réponse | Colonne |
|---|---|---|---|
| **Alcool** | « Des verres aujourd'hui ? » | 0, 1, 2, « 3 et + » | `alcohol_drinks` (0-3) |
| **Café tardif** | « Un café après 16 h ? » | oui / non | `late_caffeine` |
| **Sieste** | « Une sieste aujourd'hui ? » | − / + par 10 min, 20 min au premier « + », 3 h au plus | `nap_minutes` (0-180) |
| **Fringales** | échelle 1-5 | comme les autres échelles | `cravings` (1-5) |

Règles :

1. **Un module éteint ne pose pas sa question et n'écrit rien** — sa colonne n'est pas envoyée du tout
   (pas même `null`) : éteindre un module n'efface pas ce qu'il a enregistré.
2. **`null` = pas répondu**, ce n'est pas « zéro verre ». Retaper une réponse la retire.
3. Ce que les modules nourrissent ([BIEN-05](bien05-ce-qui-compte.md)) : alcool → la nuit suivante
   (« Ce qui compte ») et l'allure du lendemain (lien du Labo, si la course est active) ; café tardif →
   la nuit suivante. La sieste et les fringales sont enregistrées ; aucun croisement ne les lit encore,
   et leurs textes ne promettent rien de plus.
5. **Ce qui a été noté se relit** : les réponses apparaissent sur le jour, dans le Journal du pilier
   (« 2 verres · café après 16 h · sieste de 20 min · Fringales forte »), même module éteint depuis. Un
   « non » au café n'est pas affiché ; « aucun verre » l'est (c'est une réponse).
4. **L'eau n'est pas un module** : elle vit dans Nutrition (NUTR-12). L'onglet Aujourd'hui y mène
   (suivi « Eau »).

## 3. Cas limites

| Cas | Comportement |
|---|---|
| Module allumé, question sautée | la colonne part à `null` (pas répondu) |
| Module éteint après un mois de saisie | les réponses restent en base ; la question disparaît ; le croisement aussi |
| Bornes | les bornes du code (0-3 verres, 0-180 min) sont celles des `check` Postgres : jamais d'upload rejeté |

## 4. Offline

Réglages (`user_settings.wellbeing_*_enabled`) et réponses (`daily_wellbeing`) passent par PowerSync.

## 5. i18n

FR + EN : `wellbeing.modules.{alcohol,caffeine,nap,cravings}.*` (titre, description, question,
réponses, accessibilité), `wellbeingSettings.modules.*`.

## 6. Ce qui n'est pas fait

- **Sieste lue dans Health Connect** (déclarative pour l'instant).
- Croisements « sieste → nuit » et « fringales → apports » : à ajouter au moteur quand assez de
  monde aura allumé ces modules pour qu'ils aient de quoi apprendre.

## 7. Critères d'acceptation

[RECETTES.md](../../../../RECETTES.md) §90 F.
