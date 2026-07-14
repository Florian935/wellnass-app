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
"""
import csv, os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
CSV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'ciqual2025.csv')

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
    return (f"  ('{r['id']}', null, 'library', '{r['category']}', null, {num(b['kcal'])}, "
            f"{num(b['protein'])}, {num(b['carbs'])}, {num(b['sugars'])}, {num(b['fat'])}, "
            f"{num(b['satfat'])}, {num(b['fiber'])}, '{r['portions']}', '{micjson(r)}', now(), now())")


# --- migration idempotente (upsert) : biblio d'aliments 100 % CIQUAL ---
trs = []
for i, r in enumerate(recs):
    n = i + 1
    trs.append(f"  ('d2000{n:03d}-0001-4000-8000-000000000000', '{r['id']}', null, 'fr', {sq(r['nameFr'])}, now(), now())")
    trs.append(f"  ('d3000{n:03d}-0002-4000-8000-000000000000', '{r['id']}', null, 'en', {sq(r['nameEn'])}, now(), now())")

mig = [
    "-- Bibliothèque d'aliments — données CIQUAL 2025 (ANSES, Licence Ouverte / Etalab).",
    "-- GÉNÉRÉ par supabase/scripts/enrich-ciqual/generate.py — NE PAS éditer à la main (régénérer).",
    "-- Migration volontairement IDEMPOTENTE (upsert) : réconcilie les aliments existants sur le cloud",
    "-- et se rejoue sans effet de bord au db:reset. Attribution : Table Ciqual, ANSES.",
    "",
    ("insert into public.foods (id, owner_id, source, category, barcode, kcal_per_100g, protein_per_100g, "
     "carbs_per_100g, sugars_per_100g, fat_per_100g, saturated_fat_per_100g, fiber_per_100g, portions, "
     "micronutrients, created_at, updated_at)\nvalues\n" + ",\n".join(food_row_mic(r) for r in recs) +
     "\non conflict (id) do update set\n"
     "  source = excluded.source, category = excluded.category, barcode = excluded.barcode,\n"
     "  kcal_per_100g = excluded.kcal_per_100g, protein_per_100g = excluded.protein_per_100g,\n"
     "  carbs_per_100g = excluded.carbs_per_100g, sugars_per_100g = excluded.sugars_per_100g,\n"
     "  fat_per_100g = excluded.fat_per_100g, saturated_fat_per_100g = excluded.saturated_fat_per_100g,\n"
     "  fiber_per_100g = excluded.fiber_per_100g, portions = excluded.portions,\n"
     "  micronutrients = excluded.micronutrients, updated_at = now();"),
    ("insert into public.food_translations (id, food_id, owner_id, lang, name, created_at, updated_at)\n"
     "values\n" + ",\n".join(trs) +
     "\non conflict (id) do update set name = excluded.name, updated_at = now();"),
]
open(os.path.join(HERE, 'migration.sql'), 'w', encoding='utf-8').write("\n\n".join(mig) + "\n")

print(f"OK — foods: {len(recs)} | nouveaux: {sum(1 for r in recs if r['new'])} | micros: {sum(1 for r in recs if r['mic'])}")
print("migration -> supabase/scripts/enrich-ciqual/migration.sql")
if audit:
    print("Audit :")
    for a in audit:
        print("  -", a)
