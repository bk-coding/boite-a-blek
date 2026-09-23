const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

/**
 * À partir d'une liste de noms de fichiers (ex: le contenu de
 * assets/images/themes/), retourne les entrées de manifeste pour le
 * sélecteur de thème : tous les fichiers image du dossier.
 */
function buildThemeManifestEntries(filenames) {
  return filenames
    .filter((filename) => IMAGE_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext)))
    .slice()
    .sort()
    .map((filename) => {
      const key = filename.replace(/\.[^.]+$/, '');
      return { key, label: key, filename };
    });
}

module.exports = { buildThemeManifestEntries, IMAGE_EXTENSIONS };
