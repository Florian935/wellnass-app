// Contrôle visuel du vrai écran RN via React Native Web, avec données locales fictives.
// N'exécute aucune écriture ; les gestes et performances Android relèvent de la recette device.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const RN = require('react-native-web');
const i18next = require('i18next');
const root = path.resolve(__dirname, '../..');
const largeText = process.argv.includes('--large-text');
let scenario;
const cache = new Map();
const svg = { __esModule: true };
for (const tag of ['Svg', 'Defs', 'G', 'LinearGradient', 'RadialGradient', 'Stop', 'Path', 'ClipPath']) {
  svg[tag] = ({ children, testID, accessible, onPress, ...props }) => {
    if (tag === 'RadialGradient') { props.r = props.rx; delete props.rx; delete props.ry; }
    return React.createElement(tag[0].toLowerCase() + tag.slice(1), props, children);
  };
}
svg.default = svg.Svg;
const translator = i18next.createInstance();
translator.init({ lng: 'fr', fallbackLng: 'fr', initImmediate: false, resources: {
  fr: { translation: require(root + '/apps/mobile/src/i18n/locales/fr.json') },
  en: { translation: require(root + '/apps/mobile/src/i18n/locales/en.json') },
} });
const inertWrite = () => { throw new Error('Aucune écriture dans la planche QA'); };
function load(file) {
  file = path.resolve(file);
  if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts';
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return require(file);
  const source = fs.readFileSync(file, 'utf8');
  const code = babel.transformSync(source, { filename: file, configFile: false, babelrc: false,
    presets: ['@babel/preset-typescript'], plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }], '@babel/plugin-transform-modules-commonjs'] }).code;
  const module = { exports: {} };
  const localRequire = id => {
    if (id === 'react-native') return { ...RN,
      Text: props => {
        const style = RN.StyleSheet.flatten(props.style) || {};
        const scale = scenario.fontScale || 1;
        return React.createElement(RN.Text, { ...props, style: [props.style, {
          fontSize: (style.fontSize || 14) * scale,
          ...(style.lineHeight ? { lineHeight: style.lineHeight * scale } : {}),
        }] });
      },
      useWindowDimensions: () => ({ width: scenario.width, height: 900, scale: 1, fontScale: scenario.fontScale || 1 }),
    };
    if (id === 'react-native-svg') return svg;
    if (id === 'expo-router') return { useRouter: () => ({}), useNavigation: () => ({}) };
    if (id === 'expo-router/react-navigation') return { usePreventRemove: () => {} };
    if (id === '@expo/vector-icons') return { Ionicons: ({ name, size, color }) => React.createElement('span', { style: { fontSize: size, color } }, { 'arrow-back': '←', 'arrow-forward': '→', checkmark: '✓', 'chevron-forward': '›' }[name] ?? '•') };
    if (id === '@/theme/useTheme') return { useTheme: () => ({ scheme: scenario.theme, colors: load(root + '/apps/mobile/src/theme/colors.ts').palettes[scenario.theme] }) };
    if (id === '@/theme/fonts') return { fontFamily: { body: 'Hanken', bodyBold: 'Hanken', bodyMedium: 'Hanken', bodySemi: 'Hanken', displayBold: 'Bricolage' } };
    if (id === '@/hooks/useUnits') return { useUnits: () => ({ formatAxisNumber: value => new Intl.NumberFormat(scenario.lang, { maximumFractionDigits: 1 }).format(value) }) };
    if (id === 'react-i18next') return { useTranslation: () => ({ i18n: { language: scenario.lang }, t: translator.getFixedT(scenario.lang) }) };
    if (id === '@/components/Screen') return { Screen: ({ children }) => React.createElement(RN.View, { style: { flex: 1 } }, children) };
    if (id === '@/stores/auth-store') return { useAuthStore: selector => selector({ session: { user: { id: 'qa-user' } } }) };
    if (id === '@/data/repositories/body-visual-repository') return { useBodyVisual: () => scenario.visual, saveBodyVisual: inertWrite };
    if (id === '@/data/repositories/body-training-repository') return { useBodyTraining: () => scenario.training, saveBodyTraining: inertWrite };
    if (id === '@/data/repositories/body-training-program-repository') return { useBodyTrainingProgram: () => ({ program: scenario.program, isLoading: false, error: null }) };
    if (id === '@wellness/shared') return { ...load(root + '/packages/shared/src/body-visual.ts'), ...load(root + '/packages/shared/src/body-training.ts'), ...load(root + '/packages/shared/src/exercise.ts') };
    if (id.startsWith('@/')) return load(root + '/apps/mobile/src/' + id.slice(2));
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id));
    return require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const { default: Screen } = load(root + '/apps/mobile/src/app/body-training.tsx');
const visualHelpers = load(root + '/packages/shared/src/body-visual.ts');
const { createBodyTrainingDocument } = load(root + '/packages/shared/src/body-training.ts');
const state = document => ({ document, raw: document ? JSON.stringify(document) : null, status: document ? 'ready' : 'empty', isLoading: false, error: null });
const programme = {
  id: 'qa-program', name: 'Full body', sessions: [{ id: 'a', name: 'Séance A', plans: [
    { id: 'p1', exerciseId: 'e1', exerciseName: 'Élévations latérales', setType: 'normal', targetSets: 3, musclePrimary: 'shoulders', musclesFine: ['shoulders'], musclesSecondary: [] },
    { id: 'p2', exerciseId: 'e2', exerciseName: 'Curl alterné', setType: 'normal', targetSets: 3, musclePrimary: 'arms', musclesFine: ['biceps'], musclesSecondary: [] },
  ] }, { id: 'b', name: 'Séance B', plans: [
    { id: 'p3', exerciseId: 'e3', exerciseName: 'Développé épaules', setType: 'normal', targetSets: 3, musclePrimary: 'shoulders', musclesFine: ['shoulders'], musclesSecondary: [] },
    { id: 'p4', exerciseId: 'e4', exerciseName: 'Extension des bras', setType: 'normal', targetSets: null, musclePrimary: 'arms', musclesFine: [], musclesSecondary: [] },
  ] }],
};
const panels = [];
for (const item of (largeText ? [
  { name: 'FR · 320 px · texte ×1,6 (approximation RN Web)', confirmed: false, theme: 'light', lang: 'fr', width: 320, fontScale: 1.6 },
] : [
  { name: 'Suggestion · FR', confirmed: false, theme: 'light', lang: 'fr', width: 390 },
  { name: 'Confirmé · programme', confirmed: true, theme: 'light', lang: 'fr', width: 390 },
  { name: 'Objectif modifié · sombre', confirmed: true, stale: true, theme: 'dark', lang: 'fr', width: 390 },
  { name: 'English · 320 px', confirmed: true, theme: 'light', lang: 'en', width: 320 },
])) {
  const document = visualHelpers.createBodyVisualDocument();
  document.goal = visualHelpers.createBodyVisualGoal(document);
  document.goal.savedAt = '2026-09-13T12:00:00Z';
  document.goal.emphasis.shoulders = 3;
  document.goal.emphasis.arms = 2;
  const training = item.confirmed ? createBodyTrainingDocument(['shoulders', 'arms'], document.goal, '2026-09-13T12:01:00Z') : null;
  if (item.stale) document.goal.emphasis.back = 3;
  scenario = { ...item, visual: state(document), training: state(training), program: item.stale ? null : programme };
  const markup = renderToStaticMarkup(React.createElement(Screen), { identifierPrefix: `training-${panels.length}-` });
  const colors = load(root + '/apps/mobile/src/theme/colors.ts').palettes[item.theme];
  panels.push(`<section><h2>${item.name}</h2><div class="device" style="width:${item.width}px;background:${colors.background}">${markup}</div></section>`);
}
const sheet = RN.StyleSheet.getSheet();
const css = `@font-face{font-family:Hanken;src:url('../../node_modules/@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf')}@font-face{font-family:Bricolage;src:url('../../node_modules/@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf')}*{box-sizing:border-box}body{margin:0;padding:20px;display:flex;align-items:flex-start;gap:20px;background:#e2dacd;font-family:system-ui}.device{display:flex;flex-direction:column;min-height:900px;padding:20px;border-radius:28px}.device>div{min-height:0}h2{font-size:14px}`;
fs.writeFileSync(path.join(__dirname, largeText ? 'training-qa-large-text.html' : 'training-qa.html'), `<!doctype html><html lang="fr"><meta charset="utf-8"><title>CORPS-03 — vrai JSX via RN Web, données fictives</title><style>${sheet.textContent}</style><style>${css}</style>${panels.join('')}</html>`);
console.log(`CORPS-03 : ${panels.length} scénario(s) issu(s) du JSX, avec données fictives.`);
