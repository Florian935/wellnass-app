#!/usr/bin/env node
// Régénère ETAT.md à partir de sources vérifiables :
//   - le front-matter des specs d'US   (docs/specs/functional/us/*.md)
//   - le backlog                        (BACKLOG.md)
//   - les compteurs de la roadmap       (docs/roadmap/roadmap.md)
//   - le registre des migrations        (supabase/MIGRATIONS.md + supabase/migrations/)
//   - git                               (branche, avance de dev sur main, derniers commits)
//
// Usage : node scripts/etat.mjs [--check]
//   --check : n'écrit rien, sort en code 1 si ETAT.md n'est pas à jour.
//
// ETAT.md ne se modifie JAMAIS à la main : on corrige la source, on relance.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => join(ROOT, ...s);
const read = (f) => (existsSync(p(f)) ? readFileSync(p(f), 'utf8') : '');

const git = (cmd, fallback = '?') => {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
};

// ─── 1. Specs d'US (front-matter) ────────────────────────────────────────────
const US_DIR = 'docs/specs/functional/us';
const ETAPES = ['spec', 'plan', 'design', 'validation', 'code', 'recette', 'relecture', 'close'];

const specs = readdirSync(p(US_DIR))
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const raw = readFileSync(p(US_DIR, f), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return { fichier: f, etape: 'sans-front-matter' };
    const fm = Object.fromEntries(
      m[1].split('\n').map((l) => {
        const i = l.indexOf(':');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
      }),
    );
    return { fichier: f, ...fm };
  });

const sansFm = specs.filter((s) => s.etape === 'sans-front-matter');
const ouvertes = specs.filter((s) => s.etape !== 'close' && s.etape !== 'sans-front-matter');
const closes = specs.filter((s) => s.etape === 'close');

// ─── 2. Backlog : compte les lignes de tableau par section de priorité ───────
const backlog = read('BACKLOG.md');
const idsEnPipeline = new Set(specs.map((s) => s.id));
const compteCandidats = (titreSection) => {
  const bloc = backlog.split(/^## /m).find((b) => b.startsWith(titreSection));
  if (!bloc) return [];
  return [...bloc.matchAll(/^\| \*\*([^*|]+)\*\*/gm)]
    .map((x) => x[1].trim())
    // un candidat qui a déjà une spec est passé dans le pipeline : il vit dans « En cours »,
    // plus dans le backlog. On évite ainsi de le compter deux fois.
    .filter((label) => !idsEnPipeline.has(label.split(/\s+—\s+/)[0].trim()));
};
const p0 = compteCandidats('🔴 P0');
const p1 = compteCandidats('🟠 P1');
const p2 = compteCandidats('🟢 P2');

// ─── 3. Roadmap : compteurs du récapitulatif ─────────────────────────────────
const roadmap = read('docs/roadmap/roadmap.md');
const compteurRoadmap = (label) => {
  const m = roadmap.match(new RegExp(`\\|\\s*${label}[^|]*\\|\\s*(\\d+)\\s*\\|`));
  return m ? Number(m[1]) : null;
};
const rmLivre = compteurRoadmap('✅ Livré');
const rmPartiel = compteurRoadmap('🟡 Partiel');
const rmAFaire = compteurRoadmap('⬜ À faire');
const rmTotalM = roadmap.match(/\*\*Total périmètre de lancement\*\*\s*\|\s*\*\*(\d+)\*\*/);
const rmTotal = rmTotalM ? Number(rmTotalM[1]) : null;

// Contrôle : le récapitulatif doit correspondre au comptage réel des lignes de fonctionnalité.
// Sans ça le % affiché dérive en silence — c'est arrivé (l'item 5.2, compté livré alors qu'il
// est partiel, a faussé le total pendant huit jours).
const SYMBOLES = { '✅': 'livre', '🟡': 'partiel', '⬜': 'afaire', '⏳': 'reporte', '❌': 'abandon' };
const horsDecompte = roadmap.split('## Ultérieur — iOS')[1] ?? '';
const reel = { livre: 0, partiel: 0, afaire: 0, reporte: 0, abandon: 0 };
for (const ligne of roadmap.replace(horsDecompte, '').split('\n')) {
  if (!ligne.startsWith('| ')) continue;
  const cells = ligne.split('|').slice(1, -1).map((c) => c.trim());
  if (!/^\d+\.\d+[a-z]?$/.test(cells[0])) continue; // pas une ligne de fonctionnalité
  const statuts = cells.filter((c) => c in SYMBOLES);
  if (statuts.length) reel[SYMBOLES[statuts[statuts.length - 1]]]++;
}
const totalReel = Object.values(reel).reduce((a, b) => a + b, 0);
const ecarts = [];
if (rmLivre !== null && rmLivre !== reel.livre) ecarts.push(`✅ annoncé ${rmLivre} / compté ${reel.livre}`);
if (rmPartiel !== null && rmPartiel !== reel.partiel) ecarts.push(`🟡 annoncé ${rmPartiel} / compté ${reel.partiel}`);
if (rmAFaire !== null && rmAFaire !== reel.afaire) ecarts.push(`⬜ annoncé ${rmAFaire} / compté ${reel.afaire}`);
if (rmTotal !== null && rmTotal !== totalReel) ecarts.push(`total annoncé ${rmTotal} / compté ${totalReel}`);
const pct = rmLivre && rmTotal ? Math.round((rmLivre / rmTotal) * 100) : null;
// Bornée : un compteur incohérent dans la roadmap ne doit pas faire planter la génération —
// l'écart est signalé en alerte, pas par une exception.
const plein = pct === null ? 0 : Math.min(20, Math.max(0, Math.round(pct / 5)));
const jauge = pct === null ? '' : '█'.repeat(plein) + '░'.repeat(20 - plein);

// ─── 4. Migrations ───────────────────────────────────────────────────────────
const migFiles = existsSync(p('supabase/migrations'))
  ? readdirSync(p('supabase/migrations')).filter((f) => f.endsWith('.sql'))
  : [];
const registre = read('supabase/MIGRATIONS.md');
const migPoussees = migFiles.filter((f) => {
  const version = f.replace(/\.sql$/, '');
  const ligne = registre.split('\n').find((l) => l.includes(version));
  return ligne && /\[x\]/.test(ligne);
}).length;
const migAbsentes = migFiles.filter((f) => !registre.includes(f.replace(/\.sql$/, '')));

// ─── 5. Git ──────────────────────────────────────────────────────────────────
const branche = git('rev-parse --abbrev-ref HEAD');
const nbCommits = git('rev-list --count HEAD', '?');
const mainRetard = git('rev-list --count origin/main..origin/dev', '?');
const derniers = git('log --oneline -5 --no-decorate', '')
  .split('\n')
  .filter(Boolean)
  .map((l) => `- \`${l.slice(0, 7)}\` ${l.slice(8)}`);
const proprete = git('status --porcelain', '') === '' ? 'propre' : 'modifications non commitées';

// ─── 6. Rendu ────────────────────────────────────────────────────────────────
const aujourdhui = process.env.ETAT_DATE ?? new Date().toLocaleDateString('fr-FR');

const tableauOuvertes = ouvertes.length
  ? [
      '| US | Étape | Branche | Roadmap |',
      '|---|---|---|---|',
      ...ouvertes
        .sort((a, b) => ETAPES.indexOf(b.etape) - ETAPES.indexOf(a.etape))
        .map(
          (s) =>
            `| **${s.id}** — ${s.titre}${s.bloque ? ' ⏸️' : ''} | \`${s.etape}\`${s.bloque ? ' *(en pause)*' : ''} | \`${s.branche}\` | ${s.roadmap === '[]' ? '—' : s.roadmap} |`,
        ),
    ].join('\n')
  : '_Aucune US en cours. Le pipeline est vide — piocher dans [BACKLOG.md](BACKLOG.md)._';

/**
 * US en pause sur une **dépendance externe** (champ `bloque:` du front-matter).
 *
 * Ajouté le 04/08/2026 : une US arrêtée faute d'un élément qu'on ne peut pas produire soi-même
 * (un fichier à fournir, un compte à créer, un arbitrage juridique) reste `etape: validation` ou
 * `code` — donc **indistinguable d'une US qui avance** dans le tableau ci-dessus. C'est le meilleur
 * moyen de la retrouver trois semaines plus tard sans savoir ce qu'on attendait.
 */
const bloquees = ouvertes.filter((s) => s.bloque);
const renvoiBloquees = bloquees.length
  ? `\n⏸️ **${bloquees.length} US en pause sur une dépendance externe** :\n` +
    bloquees.map((s) => `- **${s.id}** — ${s.bloque}`).join('\n') +
    '\n'
  : '';

// Les US à `recette` attendent une validation **humaine** : c'est la seule étape que le pipeline ne
// peut pas franchir seul, donc celle qui se perd le plus facilement d'une session à l'autre.
const enRecette = ouvertes.filter((s) => s.etape === 'recette');
const renvoiRecettes = enRecette.length
  ? `\n⏳ **${enRecette.length} US ${enRecette.length > 1 ? 'attendent' : 'attend'} une recette humaine** ` +
    `(${enRecette.map((s) => s.id).join(', ')}) — critères cochables dans [RECETTES.md](RECETTES.md).\n`
  : '';

const liste = (arr) => (arr.length ? arr.map((x) => `- ${x}`).join('\n') : '- _(vide)_');

const alertes = [];
if (sansFm.length) alertes.push(`⚠️ ${sansFm.length} spec(s) sans front-matter : ${sansFm.map((s) => s.fichier).join(', ')}`);
if (migAbsentes.length) alertes.push(`⚠️ ${migAbsentes.length} migration(s) absente(s) du registre : ${migAbsentes.join(', ')}`);
if (migPoussees !== migFiles.length) alertes.push(`⚠️ ${migFiles.length - migPoussees} migration(s) non poussée(s) sur le cloud`);
if (proprete !== 'propre') alertes.push(`⚠️ Working tree : ${proprete}`);
if (ecarts.length)
  alertes.push(
    `🔴 **Le récapitulatif de la roadmap ne correspond pas au comptage réel** : ${ecarts.join(' · ')}. ` +
      `Corriger les compteurs (et le détail par version) dans [la roadmap](docs/roadmap/roadmap.md).`,
  );

const out = `# État du projet — ${aujourdhui}

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par \`node scripts/etat.mjs\`
> (skill [\`/etat\`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** \`${jauge}\` **${pct ?? '?'} %** — ${rmLivre ?? '?'} livré · ${rmPartiel ?? '?'} partiel · ${rmAFaire ?? '?'} à faire (sur ${rmTotal ?? '?'})

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **${p0.length} candidats P0**
avant de pouvoir publier.

## 🔨 En cours

${tableauOuvertes}
${renvoiBloquees}${renvoiRecettes}
## ➡️ Prochain — P0 bloquant (${p0.length})

${liste(p0)}

<details><summary>P1 finitions (${p1.length}) · P2 confort (${p2.length})</summary>

**P1** — ${p1.join(' · ') || '—'}

**P2** — ${p2.join(' · ') || '—'}

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | \`${branche}\` (${proprete}) |
| Commits | ${nbCommits} · \`main\` a **${mainRetard}** commits de retard sur \`dev\` |
| Specs d'US | ${specs.length} au total — ${closes.length} clôturées, ${ouvertes.length} en cours |
| Migrations | ${migPoussees}/${migFiles.length} poussées sur le cloud |
| Tests | \`npm run test\` — **⚠️ lire le code de sortie sans pipe** (un \`tail\` en aval masque l'échec) |

${alertes.length ? '### ⚠️ Alertes\n\n' + alertes.map((a) => `- ${a}`).join('\n') : '✅ Aucune alerte.'}

## 🕒 Derniers commits

${derniers.join('\n') || '—'}

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
`;

if (process.argv.includes('--check')) {
  // On ne compare que la partie **stable** du document : tout ce qui précède « Santé du dépôt ».
  // La suite (branche courante, nb de commits, propreté du working tree) bouge à chaque
  // manipulation git — la comparer produirait un échec permanent, donc inutile.
  const stable = (s) => s.split('## 🩺 Santé du dépôt')[0].replace(/^# État du projet — .*$/m, '');
  if (stable(read('ETAT.md')) !== stable(out)) {
    console.error(
      'ETAT.md est périmé (cap, US en cours ou backlog ont changé) — relance `node scripts/etat.mjs`.',
    );
    process.exit(1);
  }
  console.log('ETAT.md est à jour.');
} else {
  writeFileSync(p('ETAT.md'), out, 'utf8');
  console.log(`ETAT.md régénéré — ${specs.length} specs, ${ouvertes.length} en cours, ${p0.length} P0.`);
  alertes.forEach((a) => console.log('  ' + a));
}
