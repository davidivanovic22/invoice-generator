const plugin = require('tailwindcss/plugin');
const colors = require('tailwindcss/colors');

/**
 * Dark mode without touching every component: the palettes below read from CSS
 * variables. In `.dark` each scale is mirrored (50 ↔ 950, 100 ↔ 900, …) and
 * white becomes the darkest surface. Anything inside `.light-scope` (invoice,
 * resume and KPO documents, the signature pad) keeps the light values, since
 * those are printed on white paper.
 */
const PALETTES = ['slate', 'indigo', 'amber', 'red', 'emerald', 'rose', 'violet', 'sky', 'orange', 'cyan'];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const rgb = (hex) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)).join(' ');
};

const themed = Object.fromEntries(
  PALETTES.map((name) => [name, Object.fromEntries(SHADES.map((shade) => [shade, `rgb(var(--c-${name}-${shade}) / <alpha-value>)`]))])
);

const lightVars = () => {
  const vars = { '--c-white': '255 255 255', '--c-page': rgb(colors.slate[100]) };
  for (const name of PALETTES) for (const shade of SHADES) vars[`--c-${name}-${shade}`] = rgb(colors[name][shade]);
  return vars;
};

const darkVars = () => {
  // The page is the darkest layer; cards ("white") sit one step lighter.
  const vars = { '--c-white': rgb('#0f172a'), '--c-page': rgb('#060912') };
  for (const name of PALETTES) {
    SHADES.forEach((shade, index) => {
      vars[`--c-${name}-${shade}`] = rgb(colors[name][SHADES[SHADES.length - 1 - index]]);
    });
  }
  // Subtle panels inside cards: between the card and slate-100.
  vars['--c-slate-50'] = rgb('#151e31');
  return vars;
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { ...themed, white: 'rgb(var(--c-white) / <alpha-value>)' },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root, .light-scope': { ...lightVars(), colorScheme: 'light' },
        '.dark': { ...darkVars(), colorScheme: 'dark' },
        '.dark .light-scope': { ...lightVars(), colorScheme: 'light' },
        '.light-scope': { color: 'rgb(var(--c-slate-900))' }
      });
    })
  ]
};
