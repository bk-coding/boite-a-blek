const RESERVED_FILENAME = 'blek.m4a';
const AUDIO_EXTENSIONS = ['.m4a', '.mp3', '.wav'];

/**
 * À partir d'une liste de noms de fichiers (ex: le contenu de
 * assets/sounds/), retourne les entrées de manifeste pour le sélecteur de
 * son « bas vers haut » : tous les fichiers audio sauf le son fixe
 * `blek.m4a` (réservé au son « haut vers bas », toujours actif).
 */
function buildSoundManifestEntries(filenames) {
  return filenames
    .filter((filename) => filename !== RESERVED_FILENAME)
    .filter((filename) => AUDIO_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext)))
    .slice()
    .sort()
    .map((filename) => {
      const key = filename.replace(/\.[^.]+$/, '');
      return { key, label: key, filename };
    });
}

module.exports = { buildSoundManifestEntries, RESERVED_FILENAME, AUDIO_EXTENSIONS };
