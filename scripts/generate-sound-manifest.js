const fs = require('fs');
const path = require('path');
const { buildSoundManifestEntries } = require('./soundManifest');

const SOUNDS_DIR = path.join(__dirname, '..', 'assets', 'sounds');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'audio', 'soundManifest.ts');

const filenames = fs.readdirSync(SOUNDS_DIR);
const entries = buildSoundManifestEntries(filenames);

const lines = [
  '// Fichier généré automatiquement par scripts/generate-sound-manifest.js.',
  '// Ne pas modifier à la main : après avoir ajouté ou retiré un fichier dans',
  '// assets/sounds/ (autre que blek.m4a, réservé au son haut-vers-bas),',
  '// relancer `node scripts/generate-sound-manifest.js`.',
  '',
  'export interface SoundManifestEntry {',
  '  key: string;',
  '  label: string;',
  '  source: number;',
  '}',
  '',
  'export const BAS_VERS_HAUT_SOUNDS: SoundManifestEntry[] = [',
  ...entries.map(
    (entry) =>
      `  { key: ${JSON.stringify(entry.key)}, label: ${JSON.stringify(entry.label)}, source: require('../../assets/sounds/${entry.filename}') },`
  ),
  '];',
  '',
];

fs.writeFileSync(OUTPUT_FILE, lines.join('\n'));
console.log(`Écrit : ${path.relative(process.cwd(), OUTPUT_FILE)} (${entries.length} son(s) : ${entries.map((e) => e.filename).join(', ') || 'aucun'})`);
