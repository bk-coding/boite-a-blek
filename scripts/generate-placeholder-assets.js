const fs = require('fs');
const path = require('path');
const { makeSolidPng, makeToneWav } = require('./assetGenerators');

const ROOT = path.join(__dirname, '..');

function writeFile(relativePath, buffer) {
  const fullPath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
  console.log(`Écrit : ${relativePath} (${buffer.length} octets)`);
}

const BLEK_ORANGE = [255, 176, 59];

// L'illustration (assets/images/illustration.png) et les sons
// (assets/sounds/*.m4a) sont désormais les fichiers définitifs fournis
// par l'utilisateur — ne plus les régénérer ici pour éviter de les
// écraser. Seuls l'icône et le splash restent des placeholders.
writeFile('assets/icon.png', makeSolidPng(1024, 1024, BLEK_ORANGE));
writeFile('assets/splash.png', makeSolidPng(1284, 2778, BLEK_ORANGE));
