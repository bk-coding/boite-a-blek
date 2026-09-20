const { makeSolidPng, makeToneWav } = require('./assetGenerators');

describe('makeSolidPng', () => {
  test('produit un PNG valide avec les bonnes dimensions', () => {
    const buf = makeSolidPng(64, 32, [255, 0, 0]);
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(buf.subarray(0, 8)).toEqual(pngSignature);
    expect(buf.readUInt32BE(16)).toBe(64); // largeur (IHDR)
    expect(buf.readUInt32BE(20)).toBe(32); // hauteur (IHDR)
  });
});

describe('makeToneWav', () => {
  test('produit un WAV avec la bonne durée et le bon en-tête', () => {
    const buf = makeToneWav(0.5, 440);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
    const sampleRate = 44100;
    const expectedSamples = Math.floor(sampleRate * 0.5);
    expect(buf.length).toBe(44 + expectedSamples * 2);
  });
});
