const { buildThemeManifestEntries } = require('./themeManifest');

describe('buildThemeManifestEntries', () => {
  test('ne garde que les fichiers image', () => {
    const entries = buildThemeManifestEntries(['clair.png', '.DS_Store', 'notes.txt']);
    expect(entries).toEqual([{ key: 'clair', label: 'clair', filename: 'clair.png' }]);
  });

  test('trie les entrées par ordre alphabétique', () => {
    const entries = buildThemeManifestEntries(['sombre.png', 'clair.png', 'orange.jpg']);
    expect(entries.map((e) => e.key)).toEqual(['clair', 'orange', 'sombre']);
  });

  test('accepte plusieurs extensions image', () => {
    const entries = buildThemeManifestEntries(['a.png', 'b.jpg', 'c.jpeg']);
    expect(entries.map((e) => e.key).sort()).toEqual(['a', 'b', 'c']);
  });

  test('retourne un tableau vide si aucune image', () => {
    expect(buildThemeManifestEntries(['.DS_Store'])).toEqual([]);
  });

  test('dérive la clé et le libellé du nom de fichier sans extension', () => {
    const [entry] = buildThemeManifestEntries(['foret-nuit.png']);
    expect(entry.key).toBe('foret-nuit');
    expect(entry.label).toBe('foret-nuit');
  });
});
