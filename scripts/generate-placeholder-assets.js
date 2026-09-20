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

writeFile('assets/images/illustration.png', makeSolidPng(400, 400, BLEK_ORANGE));
writeFile('assets/icon.png', makeSolidPng(1024, 1024, BLEK_ORANGE));
writeFile('assets/splash.png', makeSolidPng(1284, 2778, BLEK_ORANGE));
writeFile('assets/sounds/haut-vers-bas.wav', makeToneWav(0.6, 440));
writeFile('assets/sounds/bas-vers-haut.wav', makeToneWav(0.6, 660));
