const fs = require('fs');
const path = require('path');
const { buildThemeManifestEntries } = require('./themeManifest');

const THEMES_DIR = path.join(__dirname, '..', 'assets', 'images', 'themes');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'theme', 'themeManifest.ts');

const filenames = fs.readdirSync(THEMES_DIR);
const entries = buildThemeManifestEntries(filenames);

const lines = [
  '// Fichier généré automatiquement par scripts/generate-theme-manifest.js.',
  '// Ne pas modifier à la main : après avoir ajouté ou retiré une image dans',
  '// assets/images/themes/, relancer `npm run generate:themes`.',
  '',
  'export interface ThemeManifestEntry {',
  '  key: string;',
  '  label: string;',
  '  source: number;',
  '}',
  '',
  'export const THEMES: ThemeManifestEntry[] = [',
  ...entries.map(
    (entry) =>
      `  { key: ${JSON.stringify(entry.key)}, label: ${JSON.stringify(entry.label)}, source: require('../../assets/images/themes/${entry.filename}') },`
  ),
  '];',
  '',
];

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, lines.join('\n'));
console.log(`Écrit : ${path.relative(process.cwd(), OUTPUT_FILE)} (${entries.length} thème(s) : ${entries.map((e) => e.filename).join(', ') || 'aucun'})`);
