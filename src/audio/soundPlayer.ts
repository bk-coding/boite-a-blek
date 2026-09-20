import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SoundKey = 'hautVersBas' | 'basVersHaut';

const SOUND_SOURCES: Record<SoundKey, number> = {
  hautVersBas: require('../../assets/sounds/blek.m4a'),
  basVersHaut: require('../../assets/sounds/10-minutes.m4a'),
};

/**
 * Garde-fou : si un lecteur ne signale jamais `isLoaded`, `loadAll()` rejette
 * au lieu de rester bloqué indéfiniment (l'app dégrade alors silencieusement,
 * cf. spec §7).
 */
const LOAD_TIMEOUT_MS = 10000;

export interface SoundPlayer {
  loadAll(): Promise<void>;
  getDurationMs(key: SoundKey): number;
  play(key: SoundKey, volume: number): Promise<void>;
  unloadAll(): Promise<void>;
}

/**
 * `expo-audio` charge la source de façon asynchrone : `player.duration` vaut 0
 * tant que le média n'est pas prêt. On attend donc l'état chargé (propriété
 * `isLoaded` déjà vraie, ou évènement `playbackStatusUpdate`) avant de lire la
 * durée, pour que `getDurationMs()` puisse rester synchrone ensuite.
 *
 * @returns la durée du média en secondes (unité de `expo-audio`).
 */
function waitUntilLoaded(player: AudioPlayer): Promise<number> {
  if (player.isLoaded) {
    return Promise.resolve(player.duration);
  }

  return new Promise<number>((resolve, reject) => {
    let settled = false;
    let subscription: { remove(): void } | null = null;

    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      subscription?.remove();
      action();
    };

    const timeoutId = setTimeout(() => {
      settle(() => reject(new Error('Délai de chargement du son dépassé')));
    }, LOAD_TIMEOUT_MS);

    subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded) {
        settle(() => resolve(status.duration));
      } else if (status.error) {
        const message = status.error;
        settle(() => reject(new Error(message)));
      }
    });

    if (settled) {
      // L'évènement est arrivé avant même l'affectation de `subscription`.
      subscription.remove();
      return;
    }

    // Le média a pu finir de charger entre le test initial et l'abonnement.
    if (player.isLoaded) {
      settle(() => resolve(player.duration));
    }
  });
}

export function createSoundPlayer(): SoundPlayer {
  const players: Partial<Record<SoundKey, AudioPlayer>> = {};
  const durations: Partial<Record<SoundKey, number>> = {};

  async function loadAll(): Promise<void> {
    // `playsInSilentMode` remplace `playsInSilentModeIOS` d'expo-av : le son
    // doit jouer même si l'interrupteur silencieux iOS est activé (spec §6).
    await setAudioModeAsync({ playsInSilentMode: true });

    const keys = Object.keys(SOUND_SOURCES) as SoundKey[];
    // Les lecteurs sont créés d'abord : même si l'attente de la durée échoue,
    // la lecture reste possible (dégradation partielle plutôt que muette).
    for (const key of keys) {
      players[key] = createAudioPlayer(SOUND_SOURCES[key]);
    }

    await Promise.all(
      keys.map(async (key) => {
        const durationSeconds = await waitUntilLoaded(players[key]!);
        durations[key] = Math.round(durationSeconds * 1000);
      })
    );
  }

  function getDurationMs(key: SoundKey): number {
    return durations[key] ?? 0;
  }

  async function play(key: SoundKey, volume: number): Promise<void> {
    const player = players[key];
    if (!player) {
      throw new Error(`Son non chargé : ${key}`);
    }
    player.volume = volume;
    await player.seekTo(0);
    player.play();
  }

  async function unloadAll(): Promise<void> {
    for (const key of Object.keys(players) as SoundKey[]) {
      players[key]?.remove();
      delete players[key];
      delete durations[key];
    }
  }

  return { loadAll, getDurationMs, play, unloadAll };
}
