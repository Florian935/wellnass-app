// Planche issue du vrai JSX, via React Native Web. Ce n'est pas une recette Android.
// Seuls les ports natifs et l'état initial du scénario sont remplacés pour le rendu statique.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const RN = require('react-native-web');
const root = path.resolve(__dirname, '../..');
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
const gesture = new Proxy({}, { get: () => () => gesture });
function load(file) {
  file = path.resolve(file);
  if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts';
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return require(file);
  let source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('BodyShapeEditor.tsx')) source = source.replace("useState<Mode>('baseline')", 'useState<Mode>(globalThis.corpsQAMode)').replace("useState<'front' | 'back'>('front')", 'useState<\'front\' | \'back\'>(globalThis.corpsQASide)');
  const code = babel.transformSync(source, { filename: file, configFile: false, babelrc: false,
    presets: ['@babel/preset-typescript'], plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }], '@babel/plugin-transform-modules-commonjs'] }).code;
  const module = { exports: {} };
  const localRequire = id => {
    if (id === 'react-native') return { ...RN, useWindowDimensions: () => ({ width: scenario.width, height: 820, scale: 1, fontScale: 1 }) };
    if (id === 'react-native-svg') return svg;
    if (id === 'react-native-gesture-handler') return { Gesture: gesture, GestureDetector: ({ children }) => children };
    if (id === 'expo-router') return { useRouter: () => ({}), useNavigation: () => ({}) };
    if (id === 'expo-router/react-navigation') return { usePreventRemove: () => {} };
    if (id === '@expo/vector-icons') return { Ionicons: ({ name, size, color }) => React.createElement('span', { style: { fontSize: size, color } }, { 'arrow-back': '←', add: '+', remove: '−' }[name]) };
    if (id === '@/theme/useTheme') return { useTheme: () => ({ scheme: scenario.theme, colors: load(root + '/apps/mobile/src/theme/colors.ts').palettes[scenario.theme] }) };
    if (id === '@/theme/fonts') return { fontFamily: { body: 'Hanken', bodyBold: 'Hanken', bodyMedium: 'Hanken', bodySemi: 'Hanken', displayBold: 'Bricolage' } };
    if (id === 'react-i18next') return { useTranslation: () => ({ i18n: { language: scenario.lang }, t: (key, values) => {
      const result = key.split('.').reduce((p, k) => p?.[k], require(root + `/apps/mobile/src/i18n/locales/${scenario.lang}.json`));
      return typeof result === 'string' ? result.replace(/{{(\w+)}}/g, (_, key) => String(values?.[key] ?? '')) : key;
    } }) };
    if (id === '@/data/repositories/body-visual-repository') return { saveBodyVisual: () => {} };
    if (id === '@/data/repositories/body-measurement-repository') return { useLatestMeasurements: () => ({ latest: {}, isLoading: false, error: null }) };
    if (id === '@wellness/shared') return { ...load(root + '/packages/shared/src/body-visual.ts'), MEASUREMENT_KINDS: ['waist', 'chest', 'hips', 'arm', 'thigh', 'calf'] };
    if (id.startsWith('@/')) return load(root + '/apps/mobile/src/' + id.slice(2));
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id));
    return require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
  cache.set(file, module.exports); return module.exports;
}
const { BodyShapeEditor } = load(root + '/apps/mobile/src/components/body/BodyShapeEditor.tsx');
const { createBodyVisualDocument, createBodyVisualGoal } = load(root + '/packages/shared/src/body-visual.ts');
const panels = [];
for (const item of [
  { mode: 'baseline', side: 'front', theme: 'light', lang: 'fr', width: 360 },
  { mode: 'goal', side: 'front', theme: 'light', lang: 'fr', width: 390 },
  { mode: 'compare', side: 'back', theme: 'dark', lang: 'fr', width: 390 },
  { mode: 'baseline', side: 'front', theme: 'light', lang: 'en', width: 320 },
]) {
  scenario = item; globalThis.corpsQAMode = item.mode; globalThis.corpsQASide = item.side;
  const document = createBodyVisualDocument();
  if (item.mode !== 'baseline') { document.goal = createBodyVisualGoal(document); document.goal.emphasis.shoulders = 2; document.goal.emphasis.glutes = 3; }
  const source = { document, raw: JSON.stringify(document), status: 'ready', isLoading: false, error: null };
  const markup = renderToStaticMarkup(React.createElement(BodyShapeEditor, { source }), { identifierPrefix: `editor-${panels.length}` });
  const colors = load(root + '/apps/mobile/src/theme/colors.ts').palettes[item.theme];
  panels.push(`<section><h2>${item.mode} · ${item.lang} · ${item.width}px</h2><div class="device" style="width:${item.width}px;background:${colors.background}">${markup}</div></section>`);
}
const sheet = RN.StyleSheet.getSheet();
const css = `@font-face{font-family:Hanken;src:url('../../node_modules/@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf')}@font-face{font-family:Bricolage;src:url('../../node_modules/@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf')}body{margin:0;padding:20px;display:flex;align-items:flex-start;gap:20px;background:#e2dacd;font-family:system-ui}.device{display:flex;flex-direction:column;height:820px;padding:20px;box-sizing:border-box;border-radius:28px;overflow:hidden}h2{font-size:14px}.device>div{min-height:0}*{box-sizing:border-box}`;
fs.writeFileSync(path.join(__dirname, 'morphology-editor-qa.html'), `<!DOCTYPE html><meta charset="utf-8"><title>CORPS-02 — éditeur réel via RN Web</title><style>${sheet.textContent}</style><style>${css}</style>${panels.join('')}`);
console.log('Planche éditeur JSX : départ, objectif, comparaison, petit écran EN.');
