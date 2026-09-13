// QA hors application : rend le vrai JSX BodyShapeFigure, seules les primitives natives
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
for (const tag of ['Svg', 'Defs', 'G', 'LinearGradient', 'RadialGradient', 'Stop', 'Path', 'Circle', 'ClipPath']) {
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
const { BodyShapeFigure } = load(root + '/apps/mobile/src/components/body/BodyShapeFigure.tsx');
const proportions = { shoulders: 0, chest: 0, waist: 0, hips: 0, arms: 0, thighs: 0, calves: 0 };
const emphasis = { shoulders: 4, chest: 4, back: 4, arms: 4, glutes: 4, thighs: 4, calves: 4 };
const figures = [];
let identifier = 0;
function render(props) {
  return renderToStaticMarkup(React.createElement(BodyShapeFigure, { height: 570, ...props }), { identifierPrefix: `morphology-${identifier++}` });
}
function add(label, props, ghost = false) {
  const markup = render(props);
  const overlay = ghost ? `<div class="ghost">${render({ ...props, emphasis: undefined, selected: null, outlineOnly: true })}</div>` : '';
  figures.push(`<section class="${scheme}"><h2>${label}</h2><div class="figure">${markup}${overlay}</div></section>`);
}
for (const theme of ['light', 'dark']) {
  scheme = theme;
  for (const base of ['balanced', 'broad_shoulders', 'broad_hips']) {
    for (const side of ['front', 'back']) {
      const props = { shape: { base, proportions }, side };
      const markup = render(props);
      fs.writeFileSync(path.join(__dirname, `morphology-${theme}-${base}-${side}.svg`), markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
      add(`${theme} · ${base} · ${side}`, props);
    }
  }
}
scheme = 'light';
for (const value of [-2, 2]) {
  for (const side of ['front', 'back']) add(`Tous les réglages ${value} · ${side}`, {
    shape: { base: 'balanced', proportions: Object.fromEntries(Object.keys(proportions).map(z => [z, value])) }, side,
  });
}
for (const side of ['front', 'back']) add(`Comparaison · ${side}`, {
  shape: { base: 'balanced', proportions }, emphasis, side, mode: 'goal', selected: side === 'front' ? 'shoulders' : 'glutes',
}, true);
for (const side of ['front', 'back']) add(`Extrêmes + intentions maximales · ${side}`, {
  shape: { base: 'broad_hips', proportions: Object.fromEntries(Object.keys(proportions).map(z => [z, 2])) }, emphasis, side, mode: 'goal',
});
const style = `body{margin:0;display:grid;grid-template-columns:repeat(4,1fr);font:14px system-ui}section{text-align:center;padding:16px 5px}.light{background:#fffaf2;color:#33291f}.dark{background:#30271e;color:#f4ecdd}h2{font-size:14px;margin:0 0 12px}.figure{position:relative;display:inline-flex}.ghost{position:absolute;inset:0;pointer-events:none}`;
fs.writeFileSync(path.join(__dirname, 'morphology-qa.html'), `<!DOCTYPE html><meta charset="utf-8"><title>CORPS-02 — vrai renderer paramétrique</title><style>${style}</style>${figures.join('')}`);
fs.writeFileSync(path.join(__dirname, 'morphology-detail.html'), `<!DOCTYPE html><meta charset="utf-8"><title>CORPS-02 — détail</title><style>${style}body{grid-template-columns:repeat(4,1fr)}</style>${[figures[0], figures[1], figures[16], figures[17]].join('')}`);
console.log('QA du vrai JSX : 3 bases × 2 vues × 2 thèmes, extrêmes et comparaison.');
