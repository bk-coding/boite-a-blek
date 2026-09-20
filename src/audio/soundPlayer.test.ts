// Mock d'`expo-audio` (SDK 57) : `createAudioPlayer` renvoie un `AudioPlayer`
// dont la durée est exprimée en SECONDES, contrairement à `durationMillis`
// de feu `expo-av`.
jest.mock('expo-audio', () => {
  const mockPlayer = {
    isLoaded: true,
    duration: 0.65,
    volume: 1,
    play: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  };
  return {
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    createAudioPlayer: jest.fn(() => mockPlayer),
    __mockPlayer: mockPlayer,
  };
});

import * as ExpoAudio from 'expo-audio';
import { createSoundPlayer } from './soundPlayer';

const { setAudioModeAsync, createAudioPlayer } = ExpoAudio;
const mockPlayer = (ExpoAudio as unknown as { __mockPlayer: any }).__mockPlayer;

describe('soundPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer.isLoaded = true;
    mockPlayer.duration = 0.65;
    mockPlayer.volume = 1;
    mockPlayer.addListener.mockImplementation(() => ({ remove: jest.fn() }));
    (createAudioPlayer as jest.Mock).mockImplementation(() => mockPlayer);
  });

  test('loadAll configure le mode audio et charge les deux sons', async () => {
    const player = createSoundPlayer();
    await player.loadAll();

    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true });
    expect(createAudioPlayer).toHaveBeenCalledTimes(2);
    // 0,65 s → 650 ms : la conversion secondes → millisecondes est la
    // différence de contrat majeure entre expo-av et expo-audio.
    expect(player.getDurationMs('hautVersBas')).toBe(650);
    expect(player.getDurationMs('basVersHaut')).toBe(650);
  });

  test('loadAll attend le chargement asynchrone avant de mettre la durée en cache', async () => {
    const listeners: ((status: any) => void)[] = [];
    mockPlayer.isLoaded = false;
    mockPlayer.duration = 0;
    mockPlayer.addListener.mockImplementation((_event: string, cb: (status: any) => void) => {
      listeners.push(cb);
      return { remove: jest.fn() };
    });

    const player = createSoundPlayer();
    const loading = player.loadAll();

    // Tant que le lecteur n'a pas signalé `isLoaded`, rien n'est mis en cache.
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(player.getDurationMs('hautVersBas')).toBe(0);
    expect(listeners).toHaveLength(2);

    listeners.forEach((cb) => cb({ isLoaded: true, duration: 1.2, error: null }));
    await loading;

    expect(player.getDurationMs('hautVersBas')).toBe(1200);
    expect(player.getDurationMs('basVersHaut')).toBe(1200);
  });

  test('play règle le volume et lance la lecture depuis le début', async () => {
    const player = createSoundPlayer();
    await player.loadAll();

    await player.play('hautVersBas', 0.75);

    expect(mockPlayer.volume).toBe(0.75);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  test('play rejette si le son demandé n’a pas été chargé', async () => {
    const player = createSoundPlayer();
    await expect(player.play('hautVersBas', 1)).rejects.toThrow('Son non chargé');
  });

  test('unloadAll libère les lecteurs natifs', async () => {
    const player = createSoundPlayer();
    await player.loadAll();

    await player.unloadAll();

    expect(mockPlayer.remove).toHaveBeenCalledTimes(2);
    expect(player.getDurationMs('hautVersBas')).toBe(0);
    await expect(player.play('hautVersBas', 1)).rejects.toThrow('Son non chargé');
  });
});
