import { Audio } from 'expo-av';

export type SoundKey = 'hautVersBas' | 'basVersHaut';

const SOUND_SOURCES: Record<SoundKey, number> = {
  hautVersBas: require('../../assets/sounds/haut-vers-bas.wav'),
  basVersHaut: require('../../assets/sounds/bas-vers-haut.wav'),
};

export interface SoundPlayer {
  loadAll(): Promise<void>;
  getDurationMs(key: SoundKey): number;
  play(key: SoundKey, volume: number): Promise<void>;
  unloadAll(): Promise<void>;
}

export function createSoundPlayer(): SoundPlayer {
  const sounds: Partial<Record<SoundKey, Audio.Sound>> = {};
  const durations: Partial<Record<SoundKey, number>> = {};

  async function loadAll(): Promise<void> {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    for (const key of Object.keys(SOUND_SOURCES) as SoundKey[]) {
      const { sound, status } = await Audio.Sound.createAsync(SOUND_SOURCES[key]);
      sounds[key] = sound;
      durations[key] =
        status.isLoaded && status.durationMillis ? status.durationMillis : 0;
    }
  }

  function getDurationMs(key: SoundKey): number {
    return durations[key] ?? 0;
  }

  async function play(key: SoundKey, volume: number): Promise<void> {
    const sound = sounds[key];
    if (!sound) {
      throw new Error(`Son non chargé : ${key}`);
    }
    await sound.setVolumeAsync(volume);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  }

  async function unloadAll(): Promise<void> {
    for (const key of Object.keys(sounds) as SoundKey[]) {
      await sounds[key]?.unloadAsync();
      delete sounds[key];
    }
  }

  return { loadAll, getDurationMs, play, unloadAll };
}
