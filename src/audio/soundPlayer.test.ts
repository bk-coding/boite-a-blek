jest.mock('expo-av', () => {
  const mockSound = {
    setVolumeAsync: jest.fn(() => Promise.resolve()),
    setPositionAsync: jest.fn(() => Promise.resolve()),
    playAsync: jest.fn(() => Promise.resolve()),
    unloadAsync: jest.fn(() => Promise.resolve()),
  };
  return {
    Audio: {
      setAudioModeAsync: jest.fn(() => Promise.resolve()),
      Sound: {
        createAsync: jest.fn(() =>
          Promise.resolve({
            sound: mockSound,
            status: { isLoaded: true, durationMillis: 650 },
          })
        ),
      },
      __mockSound: mockSound,
    },
  };
});

import { Audio } from 'expo-av';
import { createSoundPlayer } from './soundPlayer';

describe('soundPlayer', () => {
  test('loadAll configure le mode audio et charge les deux sons', async () => {
    const player = createSoundPlayer();
    await player.loadAll();

    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentModeIOS: true });
    expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(2);
    expect(player.getDurationMs('hautVersBas')).toBe(650);
    expect(player.getDurationMs('basVersHaut')).toBe(650);
  });

  test('play règle le volume et lance la lecture depuis le début', async () => {
    const player = createSoundPlayer();
    await player.loadAll();
    const mockSound = (Audio as unknown as { __mockSound: any }).__mockSound;

    await player.play('hautVersBas', 0.75);

    expect(mockSound.setVolumeAsync).toHaveBeenCalledWith(0.75);
    expect(mockSound.setPositionAsync).toHaveBeenCalledWith(0);
    expect(mockSound.playAsync).toHaveBeenCalledTimes(1);
  });

  test('play rejette si le son demandé n’a pas été chargé', async () => {
    const player = createSoundPlayer();
    await expect(player.play('hautVersBas', 1)).rejects.toThrow('Son non chargé');
  });
});
