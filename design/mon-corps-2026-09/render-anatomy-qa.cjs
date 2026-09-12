// QA hors application : rend le vrai JSX AnatomyFigure, seules les primitives natives
// sont remplacées par leurs équivalents SVG DOM. Exécuter depuis la racine du dépôt.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');
let scheme = 'light';
const cache = new Map();
const svg = {};
for (const tag of ['Svg', 'Defs', 'G', 'LinearGradient', 'RadialGradient', 'Stop', 'Path', 'Circle']) {
  svg[tag] = ({ children, testID, accessible, accessibilityLabel, onPress, ...props }) => {
    if (tag === 'RadialGradient') { props.r = props.rx; delete props.rx; delete props.ry; }
    return React.createElement(tag[0].toLowerCase() + tag.slice(1), props, children);
  };
}
svg.__esModule = true;
svg.default = svg.Svg;
function load(file) {
  file = path.resolve(file);
  if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts';
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return require(file);
  const code = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file, configFile: false, babelrc: false,
    presets: [['@babel/preset-typescript']],
    plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }], '@babel/plugin-transform-modules-commonjs'],
  }).code;
  const module = { exports: {} };
  cache.set(file, module.exports);
  const localRequire = (id) => {
    if (id === 'react-native-svg') return svg;
    if (id === '@/theme/useTheme') return { useTheme: () => ({ scheme, colors: load(root + '/apps/mobile/src/theme/colors.ts').palettes[scheme] }) };
    if (id === '@wellness/shared') return load(root + '/packages/shared/src/exercise.ts');
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id));
    return require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const { AnatomyFigure } = load(root + '/apps/mobile/src/components/body/AnatomyFigure.tsx');
const { ANATOMY_JOINTS } = load(root + '/apps/mobile/src/components/body/anatomy-geometry.ts');
const figures = [];
for (const theme of ['light', 'dark']) {
  scheme = theme;
  for (const side of ['front', 'back']) {
    const markup = renderToStaticMarkup(React.createElement(AnatomyFigure, {
      side, height: 670, full: ['chest', 'shoulders', 'back'], reduced: ['biceps', 'glutes'], selected: 'shoulders',
    }), { identifierPrefix: `${theme}-${side}` });
    fs.writeFileSync(path.join(__dirname, `anatomy-${theme}-${side}.svg`), markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    figures.push(`<section class="${theme}"><h2>${theme} · ${side}</h2>${markup}</section>`);
  }
}
scheme = 'light';
for (const side of ['front', 'back']) {
  const circles = Object.entries(ANATOMY_JOINTS).filter(([, dot]) => dot.sides.includes(side)).flatMap(([name, dot]) =>
    (dot.bilateral ? [dot.x, 724 - dot.x] : [dot.x]).map(x => React.createElement(svg.Circle, {
      key: `${name}-${x}`, cx: x, cy: dot.y, r: 32, fill: '#b14f2b', stroke: '#33291f', strokeWidth: 2,
    })));
  figures.push(`<section class="light"><h2>Articulations · ${side}</h2>${renderToStaticMarkup(React.createElement(AnatomyFigure, { side, height: 670 }, circles), { identifierPrefix: `joints-${side}` })}</section>`);
}
fs.writeFileSync(path.join(__dirname, 'anatomy-qa.html'), `<!DOCTYPE html><meta charset="utf-8"><title>CORPS-01 — rendu SVG réel</title><style>body{margin:0;display:grid;grid-template-columns:repeat(3,1fr);font:16px system-ui}section{text-align:center;padding:16px}.light{background:#fffaf2;color:#33291f}.dark{background:#30271e;color:#f4ecdd}h2{font-size:18px;margin:0 0 12px}</style>${figures.join('')}`);
const contextCases = [
  { label: 'Sélection réduite en contexte', full: ['biceps'], reduced: ['chest'], selected: 'chest' },
  { label: 'Sélection neutre en contexte', full: ['biceps'], reduced: ['chest'], selected: 'quadriceps' },
  { label: 'Sélection sans contexte', full: [], reduced: [], selected: 'chest' },
];
const contextFigures = contextCases.map(({ label, ...props }, i) => `<section><h2>${label}</h2>${renderToStaticMarkup(
  React.createElement(AnatomyFigure, { side: 'front', height: 510, ...props }), { identifierPrefix: `context-${i}` }
)}</section>`);
fs.writeFileSync(path.join(__dirname, 'anatomy-context-qa.html'), `<!DOCTYPE html><meta charset="utf-8"><title>CORPS-01 — sélection et contexte</title><style>body{margin:0;display:grid;grid-template-columns:repeat(3,1fr);font:14px system-ui;background:#fffaf2;color:#33291f}section{text-align:center;padding:14px}h2{font-size:15px;margin:0 0 14px}</style>${contextFigures.join('')}`);
console.log('QA SVG et HTML générés dans', __dirname);
