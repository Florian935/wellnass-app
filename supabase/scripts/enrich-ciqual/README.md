# Enrichissement de la bibliothèque d'aliments depuis CIQUAL

Génère la bibliothèque d'aliments du seed (`supabase/seed.sql`) à partir de la table de composition
nutritionnelle **CIQUAL** (ANSES). Toute la nutrition (macros de base + sous-macros + 31
micronutriments) provient de CIQUAL — **aucune valeur saisie à la main**.

> **Source & licence** : Table Ciqual — ANSES, sous **Licence Ouverte / Etalab**. Redistribution
> autorisée **avec attribution**. Le fichier brut (XLSX/CSV) **n'est pas versionné** (volumineux) :
> le télécharger sur <https://ciqual.anses.fr>.

## Fichiers

| Fichier | Rôle | Versionné |
|---|---|---|
| `foods-catalog.json` | Identité de chaque aliment (id, noms FR/EN, catégorie, portions) + `ciqualCode`. **Source unique éditable.** | ✅ |
| `mapping-columns.json` | Index de colonne CIQUAL → cible interne (macros / sous-macros / 31 micros). | ✅ |
| `generate.py` | Générateur (stdlib Python, sans dépendance). | ✅ |
| `migration.sql` | Migration idempotente générée (upsert biblio). Copiée dans `supabase/migrations/`. | ✅ (référence) |
| `ciqual2025.csv` | Export CIQUAL converti en CSV. | ❌ (gitignore) |

> **Livraison** : la bibliothèque d'aliments n'est **pas** dans `seed.sql` — c'est une **donnée de
> référence versionnée**, livrée par une **migration** (`supabase/migrations/*_seed_library_foods_ciqual.sql`)
> poussée via `npm run db:push` (jamais de SQL collé à la main — voir CLAUDE.md). La migration est
> **idempotente** (upsert) : elle réconcilie les aliments existants sur le cloud et se rejoue sans
> effet de bord au `db:reset`.

## Convertir l'export CIQUAL (XLSX → CSV)

L'ANSES fournit un XLSX. Conversion ponctuelle (nécessite `openpyxl`) :

```python
import openpyxl, csv, re
wb = openpyxl.load_workbook('Table_Ciqual_2025_FR.xlsx', read_only=True, data_only=True)
ws = wb['composition nutritionnelle']
with open('ciqual2025.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    for row in ws.iter_rows(values_only=True):
        w.writerow([re.sub(r'\s+', ' ', str(c)).strip() if c is not None else '' for c in row])
```

Colonnes utiles : `alim_code` (index 6), `alim_nom_fr` (7), puis les nutriments par index (voir
`mapping-columns.json`). Les intitulés CIQUAL contiennent des retours-ligne → on référence par **index**.

## Régénérer

```bash
python supabase/scripts/enrich-ciqual/generate.py chemin/vers/ciqual2025.csv
```

Produit `migration.sql`. Puis :
1. **Copier** son contenu dans une nouvelle migration versionnée
   `supabase/migrations/<timestamp>_seed_library_foods_ciqual.sql` (créer le fichier via
   `npm run db:new seed_library_foods_ciqual`, ou remplacer la migration existante si simple mise à jour).
2. **Local** : `npm run db:reset` (rejoue migrations + seed) puis `npm run db:types`.
3. **Cloud** : `npm run db:push` (jamais la console) et cocher la ligne dans
   [supabase/MIGRATIONS.md](../../MIGRATIONS.md).

## Ajouter / modifier un aliment

Éditer `foods-catalog.json` (ajouter une entrée avec un `id` UUID unique `d1000NNN-…`, `nameFr`,
`nameEn`, `category` ∈ {meat,fish,starchy,vegetables,fruits,dairy,nuts,drinks,other}, `portions`,
`ciqualCode`), puis régénérer. Un aliment sans équivalent CIQUAL porte `ciqualCode: null` + un bloc
`base` (nutrition conservée telle quelle).

## Règles de données

- **Present-only** : `traces`, `NC`, `-`, vide, seuils `< x` → **omis** (jamais 0 par défaut).
- **Oméga** : sommes des AG mesurés — `omega_3 = ALA+EPA+DHA`, `omega_6 = linoléique+arachidonique`,
  `omega_9 = oléique`.
- **Absents de CIQUAL 2025** (jamais renseignés) : `trans_fat_g`, `vitamin_b7_ug` (biotine).
- **Café noir** : pas de café-boisson dans CIQUAL (seulement « café moulu ») → non mappé, valeurs
  actuelles conservées.
- **Macros de base** manquantes dans CIQUAL (« - ») → 0 (nutritionnellement correct pour ces aliments :
  glucides des viandes/poissons, lipides des fruits/légumes, etc.).
