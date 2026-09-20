const { buildSoundManifestEntries } = require('./soundManifest');

describe('buildSoundManifestEntries', () => {
  test('exclut blek.m4a et les fichiers non audio', () => {
    const entries = buildSoundManifestEntries(['blek.m4a', '10-minutes.m4a', '.DS_Store']);
    expect(entries).toEqual([{ key: '10-minutes', label: '10-minutes', filename: '10-minutes.m4a' }]);
  });

  test('trie les entrées par ordre alphabétique', () => {
    const entries = buildSoundManifestEntries(['zebra.mp3', 'alpha.wav']);
    expect(entries.map((e) => e.key)).toEqual(['alpha', 'zebra']);
  });

  test('retourne un tableau vide si seul blek.m4a est présent', () => {
    expect(buildSoundManifestEntries(['blek.m4a'])).toEqual([]);
  });

  test('accepte plusieurs extensions audio', () => {
    const entries = buildSoundManifestEntries(['cloche.wav', 'rire.mp3', 'gong.m4a']);
    expect(entries.map((e) => e.key).sort()).toEqual(['cloche', 'gong', 'rire']);
  });

  test('dérive la clé et le libellé du nom de fichier sans extension', () => {
    const [entry] = buildSoundManifestEntries(['10-minutes.m4a']);
    expect(entry.key).toBe('10-minutes');
    expect(entry.label).toBe('10-minutes');
  });
});
