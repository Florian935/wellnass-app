#!/usr/bin/env python3
"""Génère la bibliothèque d'aliments du seed depuis la table CIQUAL 2025 (ANSES, Etalab).

Entrées (dans ce dossier) :
  - foods-catalog.json   : identité de chaque aliment (id, noms FR/EN, catégorie, portions) + code CIQUAL.
  - mapping-columns.json : index de colonne CIQUAL -> cible interne (macros, sous-macros, 31 micros).
  - <csv>                : export CIQUAL en CSV UTF-8 (hors git). Voir README.md pour la conversion XLSX->CSV.

Sorties (dans ce dossier) :
  - seed-block.sql   : bloc bibliothèque à intégrer dans supabase/seed.sql (INSERT foods + translations + micros).
  - cloud-update.sql : UPDATE des aliments existants + INSERT des nouveaux, à jouer UNE fois sur le cloud.

Règles : macros de base + sous-macros + micros = 100 % CIQUAL (present-only : traces/NC/'<x'/'-' -> omis).
oméga = somme des AG mesurés. trans_fat_g / vitamin_b7_ug : absents de CIQUAL 2025 -> jamais renseignés.
Usage : python generate.py [chemin/vers/ciqual.csv]   (défaut : ./ciqual2025.csv)
        python generate.py <csv> --bulk [--limit N]      (import massif, voir ci-dessous)

── Mode --bulk (US NUTRI-UX01, décision D1) ────────────────────────────────────────────────────
Le catalogue se remplissait **une entrée à la main à la fois**, ce qui explique qu'il n'en compte
que 80 — une base sur laquelle un utilisateur français tape le mur à son deuxième repas. `--bulk`
la construit directement depuis le CSV CIQUAL : il sélectionne les aliments **du quotidien**
(groupes alimentaires courants, valeurs énergétiques renseignées), leur attribue une catégorie
interne et un id déterministe, puis fusionne dans `foods-catalog.json`.

Trois garanties, dans l'ordre où elles comptent :
  • **Aucune valeur nutritionnelle inventée** : tout vient du CSV, comme en mode normal.
  • **Idempotent** : l'id dérive du code CIQUAL, donc relancer ne crée pas de doublon.
  • **Non destructif** : une entrée déjà présente dans le catalogue est **conservée telle quelle**
    (nom retouché, portions saisies à la main, traduction EN) — `--bulk` n'ajoute que ce qui manque.

⚠️ **CIQUAL est monolingue.** Les entrées importées portent `nameEn = nameFr` et un marqueur
`needsTranslation`. La base est donc utilisable en français immédiatement, et la traduction EN
devient une tâche traçable (décision G) au lieu d'un oubli silencieux.
"""
import csv, io, os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
FLAGS = [a for a in sys.argv[1:] if a.startswith('--')]
CSV = ARGS[0] if ARGS else os.path.join(HERE, 'ciqual2025.csv')
BULK = '--bulk' in FLAGS
BULK_LIMIT = next((int(f.split('=')[1]) for f in FLAGS if f.startswith('--limit=')), None)
if BULK_LIMIT is None and '--limit' in sys.argv:
    i = sys.argv.index('--limit')
    BULK_LIMIT = int(sys.argv[i + 1]) if i + 1 < len(sys.argv) else None
BULK_LIMIT = BULK_LIMIT or 900

# ── Groupes CIQUAL -> catégories internes (les 9 valeurs de `foods.category`) ──────────────
# Colonne 3 du CSV = `alim_grp_nom_fr`. La correspondance est volontairement **grossière** : elle
# sert à ranger, pas à qualifier. Un groupe non listé est ignoré — mieux vaut une base plus
# petite qu'une base où les légumes sont classés en boissons.
BULK_GROUPS = {
    # 🔴 Libellés RELEVÉS dans la table 2025, pas devinés. Trois pièges vérifiés le 13/09/2026 :
    # « oeufs » s'y écrit sans ligature (pas « œufs »), les laitages sont « produits laitiers »
    # tout court, et les boissons « eaux et autres boissons ». Un libellé faux ne lève aucune
    # erreur : le groupe est simplement ignoré, et la catégorie disparaît de l'import en silence.
    'viandes, oeufs, poissons': 'meat',
    'produits céréaliers': 'starchy',
    'fruits, légumes, légumineuses et oléagineux': 'vegetables',
    'produits laitiers': 'dairy',
    'eaux et autres boissons': 'drinks',
    'entrées et plats composés': 'other',
    'aides culinaires et ingrédients divers': 'other',
    'matières grasses': 'other',
    'produits sucrés': 'other',
    'glaces et sorbets': 'other',
    # 'aliments infantiles' : volontairement absent — l'app ne vise pas les nourrissons.
}

# Sous-groupes qui affinent le rangement quand le groupe est trop large.
BULK_SUBGROUPS = {
    'poissons crus': 'fish', 'poissons cuits': 'fish',
    'produits à base de poissons et produits de la mer': 'fish',
    'mollusques et crustacés crus': 'fish', 'mollusques et crustacés cuits': 'fish',
    'viandes crues': 'meat', 'viandes cuites': 'meat', 'oeufs': 'meat',
    'charcuteries et alternatives végétales': 'meat', 'autres produits à base de viande': 'meat',
    'fruits': 'fruits', 'légumes': 'vegetables', 'algues': 'vegetables',
    'fruits à coque et graines oléagineuses': 'nuts',
    'légumineuses': 'starchy', 'pommes de terre et autres tubercules': 'starchy',
    'pâtes, riz et céréales': 'starchy', 'pains et assimilés': 'starchy',
    'farines': 'starchy', 'céréales de petit-déjeuner': 'starchy',
    'produits laitiers frais et alternatives végétales': 'dairy',
    'fromages et alternatives végétales': 'dairy', 'laits': 'dairy',
    'crèmes et spécialités à base de crème': 'dairy',
    'boissons sans alcool': 'drinks', 'eaux': 'drinks', 'boisson alcoolisées': 'drinks',
    # 'huiles de poissons' n'est PAS ici : c'est une matière grasse, pas un poisson. Absente de
    # cette table, elle retombe sur son groupe -> 'other'. Le silence est ici le bon comportement.
}

# CIQUAL DÉCLARE la cuisson dans le sous-groupe. C'est une source bien meilleure que la lecture
# du nom (`preparationStateFromName`), qui n'est qu'un filet de sécurité : 100 g de poulet cru et
# 100 g de poulet cuit, ce n'est pas le même apport, et l'écart passe inaperçu au journal.
BULK_PREPARATION = {
    'viandes crues': 'raw', 'poissons crus': 'raw', 'mollusques et crustacés crus': 'raw',
    'viandes cuites': 'cooked', 'poissons cuits': 'cooked',
    'mollusques et crustacés cuits': 'cooked',
}

# Ordre d'import : les aliments bruts du quotidien AVANT les plats préparés. Le CSV est trié par
# code de groupe, si bien qu'un `--limit` appliqué dans l'ordre du fichier remplissait la base de
# salades appertisées et n'atteignait jamais les légumes. L'ordre ci-dessous rend `--limit`
# utilisable : couper à 300 donne une base cohérente, pas un rayon traiteur.
BULK_PRIORITE = ['vegetables', 'fruits', 'meat', 'fish', 'dairy', 'starchy', 'nuts', 'drinks', 'other']

catalog = json.load(open(os.path.join(HERE, 'foods-catalog.json'), encoding='utf-8'))
COL = json.load(open(os.path.join(HERE, 'mapping-columns.json'), encoding='utf-8'))
BASE = {int(k): v for k, v in COL['base'].items()}
SUB = {int(k): v for k, v in COL['submacro'].items()}
MIC1 = {int(k): v for k, v in COL['micro'].items()}
MICSUM = COL['microSum']

rows = list(csv.reader(open(CSV, encoding='utf-8')))
CIQ = {r[6]: r for r in rows[1:]}


def pv(raw):
    """Valeur CIQUAL -> float exploitable, ou None (present-only)."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s == '-':
        return None
    low = s.lower()
    if low in ('traces', 'nc') or low.startswith('<'):
        return None
    try:
        n = float(s.replace(' ', '').replace(',', '.'))
    except ValueError:
        return None
    return n if n > 0 else None


def nutri(code):
    r = CIQ.get(code)
    if not r:
        return None
    base = {}
    for i, k in BASE.items():
        v = pv(r[i])
        base[k] = v if v is not None else 0.0
    for i, k in SUB.items():
        base[k] = pv(r[i])
    mic = {}
    for i, k in MIC1.items():
        v = pv(r[i])
        if v is not None:
            mic[k] = round(v, 3)
    for k, idxs in MICSUM.items():
        parts = [pv(r[i]) for i in idxs if pv(r[i]) is not None]
        if parts:
            mic[k] = round(sum(parts), 3)
    return base, mic


def sq(s):
    return "'" + s.replace("'", "''") + "'"


def num(v):
    return 'null' if v is None else f"{v:g}"


def bulk_extend(catalog, rows, limit):
    """Complète le catalogue depuis le CSV CIQUAL. Retourne (catalogue, nb ajoutés).

    Ne touche jamais une entrée existante : le catalogue reste la **source éditable**, `--bulk`
    n'est qu'un moyen de le peupler vite.
    """
    connus = {c['ciqualCode'] for c in catalog if c.get('ciqualCode')}
    # Id déterministe dérivé du code CIQUAL : relancer l'import ne duplique rien, et une entrée
    # gardera le même id d'une régénération à l'autre (sans quoi les traductions se détacheraient).
    def bulk_id(code):
        return f"d4{int(code):06d}-0000-4000-8000-000000000000"

    candidats = []
    for r in rows[1:]:
        code = r[6].strip()
        if not code or code in connus:
            continue
        groupe = (r[3] or '').strip().lower()
        sous_groupe = (r[4] or '').strip().lower()
        categorie = BULK_SUBGROUPS.get(sous_groupe) or BULK_GROUPS.get(groupe)
        if not categorie:
            continue
        # Sans énergie exploitable, l'aliment ne peut rien apporter au journal.
        if pv(r[10]) is None:
            continue
        nom = (r[7] or '').strip()
        if not nom:
            continue
        candidats.append((categorie, sous_groupe, code, nom))

    # Tri stable et déterministe : priorité de catégorie, puis nom. Deux exécutions sur le même
    # CSV produisent exactement le même catalogue — sans quoi `--limit` serait un tirage au sort.
    candidats.sort(key=lambda c: (BULK_PRIORITE.index(c[0]), c[3]))

    ajoutes = 0
    for categorie, sous_groupe, code, nom in candidats[:limit]:
        catalog.append({
            'id': bulk_id(code),
            'nameFr': nom,
            # 🔴 CIQUAL est monolingue : on recopie le français et on le SIGNALE, plutôt que
            # d'inventer une traduction ou de laisser un nom vide côté anglais (décision G).
            'nameEn': nom,
            'needsTranslation': True,
            'category': categorie,
            'preparationState': BULK_PREPARATION.get(sous_groupe),
            'portions': '[]',
            'ciqualCode': code,
            'new': True,
        })
        connus.add(code)
        ajoutes += 1
    return catalog, ajoutes


bulk_ajoutes = 0
if BULK:
    catalog, bulk_ajoutes = bulk_extend(catalog, rows, BULK_LIMIT)
    json.dump(
        catalog,
        io.open(os.path.join(HERE, 'foods-catalog.json'), 'w', encoding='utf-8'),
        ensure_ascii=False,
        indent=1,
    )

recs, audit = [], []
for c in catalog:
    if c['ciqualCode']:
        res = nutri(c['ciqualCode'])
        if res is None:
            audit.append(f"{c['nameFr']}: code CIQUAL {c['ciqualCode']} absent du CSV")
            continue
        base, mic = res
    else:
        base, mic = c['base'], {}
        audit.append(f"{c['nameFr']}: non mappé CIQUAL -> valeurs du catalogue conservées")
    recs.append({**c, 'base': base, 'mic': mic})


def micjson(r):
    return json.dumps(r['mic'] or {}, ensure_ascii=False, separators=(',', ':'))


def food_row_mic(r):
    """Ligne foods avec micronutrients en ligne (pour la migration upsert)."""
    b = r['base']
    # État de cuisson : renseigné uniquement quand CIQUAL le DÉCLARE (sous-groupe « viandes cuites »,
    # « poissons crus »…). Ailleurs on laisse null, et l'app retombe sur la lecture du nom.
    prep = f"'{r['preparationState']}'" if r.get('preparationState') else 'null'
    return (f"  ('{r['id']}', null, 'library', '{r['category']}', null, {prep}, {num(b['kcal'])}, "
            f"{num(b['protein'])}, {num(b['carbs'])}, {num(b['sugars'])}, {num(b['fat'])}, "
            f"{num(b['satfat'])}, {num(b['fiber'])}, '{r['portions']}', '{micjson(r)}', now(), now())")


# --- migration idempotente (upsert) : biblio d'aliments 100 % CIQUAL ---
# 🔴 L'id de traduction dérive de celui de l'aliment, il n'est PLUS positionnel. L'ancienne
# forme `d2000{n:03d}` avait deux défauts qui ne se voyaient qu'à grande échelle : au-delà de
# 999 aliments elle produisait `d20001000-…`, soit 9 caractères dans le premier bloc — un UUID
# invalide, et la migration entière rejetée ; et surtout un simple changement d'ordre du catalogue
# réattribuait l'id d'une traduction à un AUTRE aliment.
trs = []
for r in recs:
    prefixe = r['id'][:8]
    trs.append(f"  ('{prefixe}-0001-4000-8000-000000000000', '{r['id']}', null, 'fr', {sq(r['nameFr'])}, now(), now())")
    trs.append(f"  ('{prefixe}-0002-4000-8000-000000000000', '{r['id']}', null, 'en', {sq(r['nameEn'])}, now(), now())")

mig = [
    "-- Bibliothèque d'aliments — données CIQUAL 2025 (ANSES, Licence Ouverte / Etalab).",
    "-- GÉNÉRÉ par supabase/scripts/enrich-ciqual/generate.py — NE PAS éditer à la main (régénérer).",
    "-- Migration volontairement IDEMPOTENTE (upsert) : réconcilie les aliments existants sur le cloud",
    "-- et se rejoue sans effet de bord au db:reset. Attribution : Table Ciqual, ANSES.",
    "",
    ("insert into public.foods (id, owner_id, source, category, barcode, preparation_state, "
     "kcal_per_100g, protein_per_100g, "
     "carbs_per_100g, sugars_per_100g, fat_per_100g, saturated_fat_per_100g, fiber_per_100g, portions, "
     "micronutrients, created_at, updated_at)\nvalues\n" + ",\n".join(food_row_mic(r) for r in recs) +
     "\non conflict (id) do update set\n"
     "  source = excluded.source, category = excluded.category, barcode = excluded.barcode,\n"
     "  preparation_state = excluded.preparation_state,\n"
     "  kcal_per_100g = excluded.kcal_per_100g, protein_per_100g = excluded.protein_per_100g,\n"
     "  carbs_per_100g = excluded.carbs_per_100g, sugars_per_100g = excluded.sugars_per_100g,\n"
     "  fat_per_100g = excluded.fat_per_100g, saturated_fat_per_100g = excluded.saturated_fat_per_100g,\n"
     "  fiber_per_100g = excluded.fiber_per_100g, portions = excluded.portions,\n"
     "  micronutrients = excluded.micronutrients, updated_at = now();"),
    ("insert into public.food_translations (id, food_id, owner_id, lang, name, created_at, updated_at)\n"
     "values\n" + ",\n".join(trs) +
     "\non conflict (food_id, lang) do update set name = excluded.name, updated_at = now();"),
]
open(os.path.join(HERE, 'migration.sql'), 'w', encoding='utf-8').write("\n\n".join(mig) + "\n")

print(f"OK — foods: {len(recs)} | nouveaux: {sum(1 for r in recs if r['new'])} | micros: {sum(1 for r in recs if r['mic'])}")
if BULK:
    a_traduire = sum(1 for r in recs if r.get('needsTranslation'))
    print(f"--bulk : {bulk_ajoutes} aliments ajoutés au catalogue (limite {BULK_LIMIT}).")
    # Pas d'emoji dans les prints : la console Windows (cp1252) les refuse et fait planter le
    # script en toute fin de course, apres avoir ecrit le catalogue — le pire moment pour echouer.
    print(f"ATTENTION : {a_traduire} aliments portent un nom anglais identique au francais")
    print("            (CIQUAL est monolingue). La traduction EN reste a faire - decision G.")
print("migration -> supabase/scripts/enrich-ciqual/migration.sql")
if audit:
    print("Audit :")
    for a in audit:
        print("  -", a)
