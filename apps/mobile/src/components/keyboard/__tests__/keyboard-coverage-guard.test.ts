/**
 * US CLAV-01 — **test-garde** : aucun champ de saisie hors de la règle commune d'évitement du clavier.
 *
 * ── Pourquoi ce test existe ─────────────────────────────────────────────────────────────────────
 * Depuis Expo SDK 54, l'edge-to-edge est forcé sur Android : `adjustResize` ne redimensionne plus la
 * fenêtre, le clavier se pose par-dessus le bas de l'écran. Le 22/10/2026, l'inventaire a trouvé
 * **45 surfaces de saisie** : une seule l'évitait vraiment (la séance), 31 n'avaient **aucun**
 * mécanisme, et trois feuilles passaient `behavior={undefined}` à `KeyboardAvoidingView` sur
 * Android — c'est-à-dire rien. Le défaut ne se voit ni au typecheck, ni au lint, ni en test :
 * seulement sur un téléphone, clavier ouvert. Ce garde est le seul filet qui survit à la recette.
 *
 * ── Ce qu'il impose ─────────────────────────────────────────────────────────────────────────────
 * - **G1** — aucun `KeyboardAvoidingView` de `react-native` hors de `components/keyboard/`.
 * - **G2** — tout fichier « à champ » figure dans `INVENTORY`, avec une couverture **vérifiée** :
 *   `self` (il rend le conteneur, ou une enveloppe déclarée qui le rend) ou `coveredBy` (la liste
 *   **exacte** de ses importeurs, chacun couvert à son tour, jusqu'à un `self`).
 * - **G3** — un fichier qui rend une `<Modal>` et un champ pose lui-même un conteneur
 *   `kind="sheet"` : une `Modal` est une autre fenêtre, et le contexte React la traverse — sans
 *   `kind="sheet"`, le conteneur serait passif dans un conteneur d'écran.
 * - **D8** — dans un fichier couvert, tout défilement vertical porte `keyboardShouldPersistTaps` :
 *   sans lui, le premier appui sur « Enregistrer » clavier ouvert ferme le clavier **sans
 *   enregistrer**.
 *
 * ── Comment il lit le code ──────────────────────────────────────────────────────────────────────
 * Avec l'analyseur TypeScript, pas avec des regex : un alias (`createAnimatedComponent(TextInput)`),
 * un générique (`RefObject<ScrollView | null>`, `Omit<TextInputProps>`), un commentaire, un import
 * sur plusieurs lignes ou un `=>` dans une prop trompent une regex (constats de la relecture de la
 * spec, §15).
 *
 * ── Ce qu'il ne voit pas (limites assumées, revue du 23/10/2026) ───────────────────────────────
 * - `self` se juge **au fichier** : un champ rendu dans une autre branche du même fichier, hors du
 *   conteneur, passerait (un panneau en retour anticipé). La recette device reste le filet.
 * - Un composant `self` en `kind="screen"` rendu dans la `Modal` d'**un autre** fichier n'est pas vu.
 * - Les ré-exports (`export … from`) ne sont pas suivis dans les importeurs ; `FlashList` et
 *   `Animated.ScrollView` ne sont pas comptés par D8 (aucun dans le code au 23/10/2026).
 *
 * En cas d'échec : poser `KeyboardAwareScrollView` ou `KeyboardAvoidingContainer`
 * (`@/components/keyboard`, spec CLAV-01 §4), puis inscrire le fichier ici.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import * as ts from 'typescript';

/** Racine de `apps/mobile` (le `rootDir` de Jest est le répertoire de travail). */
const APP_ROOT = resolve('.');

// ---------------------------------------------------------------------------
// Ce que la règle connaît
// ---------------------------------------------------------------------------

/** Les composants de champ : leurs **appelants** sont suivis, pas eux. */
const FIELD_COMPONENTS: Record<string, string> = {
  TextField: 'src/components/TextField.tsx',
  DeferredTextField: 'src/components/DeferredTextField.tsx',
  DraftNumberInput: 'src/components/workout/DraftNumberInput.tsx',
  ExerciseTargetsFields: 'src/components/exercise/ExerciseTargetsFields.tsx',
};

/** Les fichiers qui importent `TextInput` sans offrir de saisie. */
const READ_ONLY = new Set([
  // `TextInput` en `editable={false}`, animé par Reanimated : un affichage de chiffre, pas un champ.
  'src/components/motion/AnimatedNumber.tsx',
]);

/** Les deux formes de la règle (`@/components/keyboard`). */
const PRIMITIVES = new Set(['KeyboardAvoidingContainer', 'KeyboardAwareScrollView']);

/** Les enveloppes qui posent la règle pour leurs `children` — chacune vérifiée elle-même. */
const WRAPPERS: Record<string, string> = {
  FormScreen: 'src/components/FormScreen.tsx',
  OnboardingScaffold: 'src/components/OnboardingScaffold.tsx',
  StageScrollView: 'src/components/stage/StageScrollView.tsx',
};

type Coverage = 'self' | { coveredBy: string[] };

/**
 * L'inventaire des surfaces de saisie (spec CLAV-01 §2), fichier par fichier.
 *
 * Un fichier à champ absent d'ici fait échouer le test : c'est voulu. L'ajouter est un geste
 * conscient, après avoir posé la règle.
 */
const INVENTORY: Record<string, Coverage> = {
  // ── Famille A — `FormScreen` ──────────────────────────────────────────────────────────────────
  'src/app/(auth)/sign-in.tsx': 'self',
  'src/app/(auth)/sign-up.tsx': 'self',
  'src/app/(auth)/forgot-password.tsx': 'self',
  'src/app/password-reset.tsx': 'self',
  'src/app/(onboarding)/infos.tsx': 'self',
  'src/app/activity.tsx': 'self',
  'src/app/workout-summary.tsx': 'self',
  'src/app/run/summary.tsx': 'self',
  'src/app/run/analysis.tsx': 'self',
  // ── Famille B — écrans défilants ──────────────────────────────────────────────────────────────
  'src/app/account-delete.tsx': 'self',
  'src/app/ai-lab.tsx': 'self',
  'src/app/food-custom.tsx': 'self',
  'src/app/meal-quick-entry.tsx': 'self',
  'src/app/nutrition-meals.tsx': 'self',
  'src/app/nutrition-profile.tsx': 'self',
  'src/app/nutrition-stats.tsx': 'self',
  'src/app/profile.tsx': 'self',
  'src/app/recipe-edit.tsx': 'self',
  // US CARDIO-02 — les quatre portes, sur leur écran et dans l'accueil du pilier (`OnboardingScaffold`).
  'src/app/running-pace.tsx': 'self',
  'src/app/running-welcome.tsx': 'self',
  'src/components/running/ReferencePaceDoors.tsx': {
    coveredBy: ['src/app/running-pace.tsx', 'src/app/running-welcome.tsx'],
  },
  'src/app/planning/plan.tsx': 'self',
  'src/app/programs/edit.tsx': 'self',
  'src/components/programs/SessionEditor.tsx': { coveredBy: ['src/app/programs/edit.tsx'] },
  'src/components/programs/ExercisePlanEditor.tsx': {
    coveredBy: ['src/components/programs/SessionEditor.tsx'],
  },
  'src/app/running-programs/edit.tsx': 'self',
  'src/components/running/RunningSessionEditor.tsx': {
    coveredBy: ['src/app/running-programs/edit.tsx'],
  },
  'src/components/running/IntervalBlockEditor.tsx': {
    coveredBy: ['src/components/running/RunningSessionEditor.tsx'],
  },
  'src/app/templates/edit.tsx': 'self',
  'src/components/templates/TemplateComposer.tsx': 'self',
  'src/components/templates/TemplateExerciseEditor.tsx': {
    coveredBy: ['src/components/templates/TemplateComposer.tsx'],
  },
  'src/app/history/[id].tsx': 'self',
  'src/components/workout/report/WorkoutReport.tsx': {
    coveredBy: ['src/app/history/[id].tsx', 'src/app/workout-summary.tsx'],
  },
  'src/components/workout/report/FeelingSection.tsx': {
    coveredBy: ['src/components/workout/report/WorkoutReport.tsx'],
  },
  'src/app/body.tsx': 'self',
  'src/components/body/BodyMuscleDetail.tsx': { coveredBy: ['src/app/body.tsx'] },
  'src/app/(tabs)/strength.tsx': 'self',
  'src/components/strength/sections/HistorySection.tsx': {
    coveredBy: ['src/app/(tabs)/strength.tsx'],
  },
  'src/components/strength/ExerciseLastDoneList.tsx': {
    coveredBy: ['src/components/strength/sections/HistorySection.tsx'],
  },
  // ── Famille C — listes et panneaux ────────────────────────────────────────────────────────────
  'src/app/exercises.tsx': 'self',
  'src/app/food-picker.tsx': 'self',
  'src/components/QuantityPanel.tsx': 'self',
  'src/components/programs/ExercisePicker.tsx': 'self',
  // ── Famille D — feuilles ──────────────────────────────────────────────────────────────────────
  'src/components/exercises/CreateExerciseModal.tsx': 'self',
  'src/components/exercises/EditExerciseModal.tsx': 'self',
  'src/components/nutrition/SaveTemplateSheet.tsx': 'self',
  'src/components/nutrition/journal/EntryDetailModal.tsx': 'self',
  'src/components/nutrition/AddFoodSheet.tsx': 'self',
  'src/app/meal-plan/index.tsx': 'self',
  'src/components/goals/GoalFormSheet.tsx': 'self',
  'src/components/goals/GoalLetterSheet.tsx': 'self',
  'src/components/measurements/MeasurementSheet.tsx': 'self',
  'src/components/wellbeing/WellbeingCheckinSheet.tsx': 'self',
  'src/components/wellbeing/MomentCheckinSheet.tsx': 'self',
  // ── Famille E — séance ────────────────────────────────────────────────────────────────────────
  'src/app/workout.tsx': 'self',
  'src/components/workout/CurrentSetCard.tsx': { coveredBy: ['src/app/workout.tsx'] },
  'src/components/workout/SetActionBar.tsx': { coveredBy: ['src/app/workout.tsx'] },
  'src/components/workout/immersive/ImmersiveWorkout.tsx': 'self',
  'src/components/workout/SetOptions.tsx': {
    coveredBy: [
      'src/components/workout/CurrentSetCard.tsx',
      'src/components/workout/immersive/ImmersiveWorkout.tsx',
    ],
  },
};

// ---------------------------------------------------------------------------
// Lecture du code
// ---------------------------------------------------------------------------

/** Un élément JSX : sa balise, ses attributs, et les balises qui l'englobent (de l'extérieur vers lui). */
type JsxFacts = { tag: string; attrs: Map<string, string | true>; ancestors: string[] };
type FileFacts = {
  /** Imports **en valeur** : module → (nom local → nom importé). */
  imports: { module: string; names: Map<string, string> }[];
  elements: JsxFacts[];
};

/** Chemin relatif à `apps/mobile`, en barres obliques. */
const rel = (abs: string) => relative(APP_ROOT, abs).split('\\').join('/');

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...listSources(abs));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|d)\.tsx?$/.test(entry)) {
      out.push(rel(abs));
    }
  }
  return out;
}

function analyse(file: string): FileFacts {
  const text = readFileSync(resolve(file), 'utf-8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const imports: FileFacts['imports'] = [];
  const elements: JsxFacts[] = [];

  const stack: string[] = [];
  const record = (el: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string => {
    const attrs = new Map<string, string | true>();
    for (const attr of el.attributes.properties) {
      if (!ts.isJsxAttribute(attr)) continue;
      const init = attr.initializer;
      let value: string | true = true;
      if (init && ts.isStringLiteral(init)) value = init.text;
      else if (init && ts.isJsxExpression(init) && init.expression) {
        value = ts.isStringLiteral(init.expression)
          ? init.expression.text
          : init.expression.getText(sf);
      }
      attrs.set(attr.name.getText(sf), value);
    }
    const tag = el.tagName.getText(sf);
    elements.push({ tag, attrs, ancestors: [...stack] });
    return tag;
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (clause && !clause.isTypeOnly) {
        const names = new Map<string, string>();
        if (clause.name) names.set(clause.name.text, 'default');
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const el of bindings.elements) {
            if (!el.isTypeOnly) names.set(el.name.text, (el.propertyName ?? el.name).getText(sf));
          }
        }
        if (bindings && ts.isNamespaceImport(bindings)) names.set(bindings.name.text, '*');
        if (names.size > 0) imports.push({ module: node.moduleSpecifier.text, names });
      }
    }
    if (ts.isJsxElement(node)) {
      const tag = record(node.openingElement);
      // Les attributs (ex. `ListFooterComponent={<Button />}`) sont hors de l'élément ; ses enfants, dedans.
      node.openingElement.attributes.properties.forEach(visit);
      stack.push(tag);
      node.children.forEach(visit);
      stack.pop();
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) record(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { imports, elements };
}

/** Résout un import vers un fichier de `src/`, ou `null` (module externe). */
function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) {
    const parts = from.split('/').slice(0, -1);
    for (const seg of spec.split('/')) {
      if (seg === '.' || seg === '') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    base = parts.join('/');
  } else return null;
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
    base,
  ]) {
    if (existsSync(resolve(candidate)) && !statSync(resolve(candidate)).isDirectory())
      return candidate;
  }
  return null;
}

const SOURCES = listSources(resolve('src'));
const FACTS = new Map(SOURCES.map((f) => [f, analyse(f)]));

/** Les noms locaux sous lesquels `react-native` fournit `imported` à ce fichier. */
function localNamesFromRN(facts: FileFacts, imported: string): string[] {
  return facts.imports
    .filter((i) => i.module === 'react-native')
    .flatMap((i) => [...i.names].filter(([, name]) => name === imported).map(([local]) => local));
}

/**
 * D'où vient une balise : le module (fichier de `src/` résolu, ou nom du paquet) et le nom importé.
 * `<RN.TextInput>` (import d'espace de noms) et `<F>` (`import { TextField as F }`) sont résolus : on
 * compare des **imports**, pas du texte de balise.
 */
function resolveTag(file: string, tag: string): { source: string; name: string } | null {
  const facts = FACTS.get(file)!;
  const [head, member] = tag.split('.', 2) as [string, string | undefined];
  for (const imp of facts.imports) {
    const imported = imp.names.get(head);
    if (imported === undefined) continue;
    const source = resolveImport(file, imp.module) ?? imp.module;
    if (member !== undefined) return imported === '*' ? { source, name: member } : null;
    return { source, name: imported };
  }
  return null;
}

const isFromRN = (file: string, tag: string, name: string) => {
  const r = resolveTag(file, tag);
  return r !== null && r.source === 'react-native' && r.name === name;
};
const isPrimitive = (file: string, tag: string) => {
  const r = resolveTag(file, tag);
  return r !== null && r.source.startsWith('src/components/keyboard/') && PRIMITIVES.has(r.name);
};
const isWrapper = (file: string, tag: string) => {
  const r = resolveTag(file, tag);
  return r !== null && WRAPPERS[r.name] === r.source;
};
const isFieldTag = (file: string, tag: string) => {
  const r = resolveTag(file, tag);
  return r !== null && (FIELD_COMPONENTS[r.name] === r.source || isFromRN(file, tag, 'TextInput'));
};

/** Le fichier offre-t-il une saisie au clavier ? */
function isFieldFile(file: string): boolean {
  if (READ_ONLY.has(file) || Object.values(FIELD_COMPONENTS).includes(file)) return false;
  const facts = FACTS.get(file)!;
  return (
    localNamesFromRN(facts, 'TextInput').length > 0 ||
    facts.elements.some((e) => isFieldTag(file, e.tag))
  );
}

/** Importeurs **en valeur** de chaque fichier (hors tests). */
const IMPORTERS = new Map<string, Set<string>>();
for (const [file, facts] of FACTS) {
  for (const imp of facts.imports) {
    const target = resolveImport(file, imp.module);
    if (!target) continue;
    if (!IMPORTERS.has(target)) IMPORTERS.set(target, new Set());
    IMPORTERS.get(target)!.add(file);
  }
}

const rendersRule = (file: string) =>
  FACTS.get(file)!.elements.some((e) => isPrimitive(file, e.tag) || isWrapper(file, e.tag));

/** Un conteneur `kind="sheet"` posé **dans** une `Modal` du fichier (pas seulement quelque part). */
const rendersSheetContainer = (file: string) =>
  FACTS.get(file)!.elements.some(
    (e) =>
      isPrimitive(file, e.tag) &&
      e.attrs.get('kind') === 'sheet' &&
      e.ancestors.some((a) => isFromRN(file, a, 'Modal')),
  );

const rendersModal = (file: string) =>
  FACTS.get(file)!.elements.some((e) => isFromRN(file, e.tag, 'Modal'));

// ---------------------------------------------------------------------------
// Les règles
// ---------------------------------------------------------------------------

describe('CLAV-01 — garde de la règle clavier', () => {
  it('le balayage lit bien le code (garde contre un test vert parce qu’il ne lit rien)', () => {
    expect(SOURCES.length).toBeGreaterThan(300);
    expect(SOURCES.filter(isFieldFile).length).toBeGreaterThanOrEqual(45);
    for (const file of Object.values(FIELD_COMPONENTS)) expect(FACTS.has(file)).toBe(true);
  });

  it('G1 — aucun `KeyboardAvoidingView` de `react-native` hors de `components/keyboard/`', () => {
    const offenders = SOURCES.filter(
      (f) =>
        !f.startsWith('src/components/keyboard/') &&
        (localNamesFromRN(FACTS.get(f)!, 'KeyboardAvoidingView').length > 0 ||
          FACTS.get(f)!.elements.some((e) => isFromRN(f, e.tag, 'KeyboardAvoidingView'))),
    );
    expect(offenders).toEqual([]);
  });

  it('G2 — tout fichier à champ figure à l’inventaire', () => {
    const missing = SOURCES.filter((f) => isFieldFile(f) && !(f in INVENTORY));
    if (missing.length > 0) {
      throw new Error(
        `Nouveau champ de saisie : poser KeyboardAwareScrollView ou KeyboardAvoidingContainer ` +
          `(@/components/keyboard, spec CLAV-01 §4), puis l'inscrire dans INVENTORY :\n` +
          missing.join('\n'),
      );
    }
  });

  it('G2 — l’inventaire ne nomme que des fichiers qui existent', () => {
    expect(Object.keys(INVENTORY).filter((f) => !FACTS.has(f))).toEqual([]);
  });

  it.each(Object.entries(INVENTORY).filter(([, c]) => c === 'self'))(
    'G2 — %s pose la règle lui-même',
    (file) => {
      expect(rendersRule(file)).toBe(true);
    },
  );

  it.each(
    Object.entries(INVENTORY).filter(
      (e): e is [string, { coveredBy: string[] }] => e[1] !== 'self',
    ),
  )('G2 — %s est couvert par tous ses importeurs, et seulement eux', (file, coverage) => {
    const importers = [...(IMPORTERS.get(file) ?? [])].sort();
    expect(importers).toEqual([...coverage.coveredBy].sort());
    // La chaîne remonte jusqu'à un `self`, sans cycle.
    const reachesSelf = (f: string, seen: Set<string>): boolean => {
      if (seen.has(f)) return false;
      const c = INVENTORY[f];
      if (c === undefined) return false;
      if (c === 'self') return true;
      return c.coveredBy.every((p) => reachesSelf(p, new Set([...seen, f])));
    };
    expect(reachesSelf(file, new Set())).toBe(true);
  });

  it.each(Object.entries(WRAPPERS))('G2 — l’enveloppe %s pose la règle', (_name, file) => {
    expect(rendersRule(file)).toBe(true);
  });

  it('G3 — un fichier qui rend une `Modal` et un champ pose un conteneur `kind="sheet"`', () => {
    const offenders = SOURCES.filter(
      (f) => isFieldFile(f) && rendersModal(f) && !rendersSheetContainer(f),
    );
    expect(offenders).toEqual([]);
  });

  it('D8 — dans un fichier couvert, tout défilement vertical porte `keyboardShouldPersistTaps`', () => {
    const offenders: string[] = [];
    for (const file of Object.keys(INVENTORY)) {
      const facts = FACTS.get(file);
      if (!facts) continue;
      facts.elements.forEach((e, i) => {
        const scroller = ['ScrollView', 'FlatList', 'SectionList'].some((n) =>
          isFromRN(file, e.tag, n),
        );
        // `horizontal` seul, ou avec une expression, vaut horizontal ; `horizontal={false}`, vertical.
        const horizontal = e.attrs.has('horizontal') && e.attrs.get('horizontal') !== 'false';
        if (!scroller || horizontal) return;
        if (!e.attrs.has('keyboardShouldPersistTaps'))
          offenders.push(`${file} — <${e.tag}> n°${i}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
