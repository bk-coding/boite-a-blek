import React from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/slider', () => {
  const ReactActual = require('react');
  return (props: any) => ReactActual.createElement('Slider', props);
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

// `expo-audio` (SDK 57) remplace `expo-av` : un `AudioPlayer` par source,
// durée exprimée en secondes (0,6 s = 600 ms de cooldown/animation).
jest.mock('expo-audio', () => {
  const mockPlayer = {
    isLoaded: true,
    duration: 0.6,
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

jest.mock('expo-sensors', () => {
  let listener: ((data: { x: number; y: number; z: number }) => void) | null = null;
  return {
    Accelerometer: {
      setUpdateInterval: jest.fn(),
      addListener: jest.fn((cb: (data: { x: number; y: number; z: number }) => void) => {
        listener = cb;
        return { remove: jest.fn() };
      }),
      __emit: (data: { x: number; y: number; z: number }) => {
        if (listener) listener(data);
      },
    },
  };
});

import { Accelerometer } from 'expo-sensors';
import * as ExpoAudio from 'expo-audio';
import * as Haptics from 'expo-haptics';
import App from './App';

const emit = (Accelerometer as unknown as { __emit: (d: { x: number; y: number; z: number }) => void }).__emit;
const createAudioPlayer = ExpoAudio.createAudioPlayer as unknown as jest.Mock;
const mockPlayer = (ExpoAudio as unknown as { __mockPlayer: any }).__mockPlayer;

const HAUT_SAMPLE = { x: 0, y: 1, z: 0 };
const BAS_SAMPLE = { x: 0, y: -1, z: 0 };

describe('App', () => {
  let now = 0;

  beforeEach(async () => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await AsyncStorage.clear();
    jest.clearAllMocks();
    createAudioPlayer.mockImplementation(() => mockPlayer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('joue le son et vibre sur un flip haut-vers-bas', async () => {
    await render(<App />);
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalledTimes(2));

    await act(async () => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });

    await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  test('ne joue pas de son bas-vers-haut si « Aucun » est sélectionné, mais vibre quand même et garde le cooldown réel', async () => {
    await AsyncStorage.setItem(
      '@boite-a-blek/settings',
      JSON.stringify({ basVersHautSoundKey: null, volume: 1, vibrationActive: true })
    );

    await render(<App />);
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalledTimes(2));

    // haut-vers-bas d'abord (toujours actif)
    await act(async () => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });
    await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1));

    // puis bas-vers-haut (« Aucun ») — confirmé à t=930, cooldown jusqu'à 1530
    await act(async () => {
      now = 800;
      emit(HAUT_SAMPLE);
      now = 930;
      emit(HAUT_SAMPLE);
    });

    await waitFor(() => expect(Haptics.impactAsync).toHaveBeenCalledTimes(2));
    expect(mockPlayer.play).toHaveBeenCalledTimes(1); // pas de second appel

    // Le son n'a pas été joué, mais le cooldown doit malgré tout avoir été
    // armé sur la durée RÉELLE du média (600 ms) : une transition confirmée
    // à t=1130, soit avant 930+600, doit encore être supprimée.
    await act(async () => {
      now = 1000;
      emit(BAS_SAMPLE);
      now = 1130;
      emit(BAS_SAMPLE);
    });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);

    // Une fois les 600 ms écoulées, les déclenchements repartent.
    await act(async () => {
      now = 1600;
      emit(HAUT_SAMPLE);
      now = 1730;
      emit(HAUT_SAMPLE); // bas-vers-haut accepté (1730 >= 1530), toujours « Aucun »
    });
    await waitFor(() => expect(Haptics.impactAsync).toHaveBeenCalledTimes(3));

    await act(async () => {
      now = 2400;
      emit(BAS_SAMPLE);
      now = 2530;
      emit(BAS_SAMPLE); // haut-vers-bas accepté (2530 >= 1730+600)
    });
    await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(2));
  });

  test('joue le son bas-vers-haut sélectionné dans les paramètres', async () => {
    await AsyncStorage.setItem(
      '@boite-a-blek/settings',
      JSON.stringify({ basVersHautSoundKey: '10-minutes', volume: 1, vibrationActive: true })
    );

    await render(<App />);
    // 2 lecteurs : hautVersBas (blek.m4a) + le son du manifeste bas-vers-haut
    // (10-minutes.m4a, seul disponible ici).
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalledTimes(2));

    await act(async () => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });
    await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1));

    await act(async () => {
      now = 800;
      emit(HAUT_SAMPLE);
      now = 930;
      emit(HAUT_SAMPLE);
    });
    await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(2));
  });

  test('applique le thème choisi dans les paramètres, et son changement en direct', async () => {
    await AsyncStorage.setItem('@boite-a-blek/settings', JSON.stringify({ themeKey: 'Orange' }));

    const { getByTestId, queryByTestId } = await render(<App />);
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalledTimes(2));

    expect(getByTestId('theme-background')).toBeTruthy();

    // Changement en direct depuis les paramètres, sans redémarrer l'app.
    fireEvent.press(getByTestId('settings-button'));
    await waitFor(() => expect(queryByTestId('theme-option-none')).not.toBeNull());
    fireEvent.press(getByTestId('theme-option-none'));

    await waitFor(() => expect(queryByTestId('theme-background')).toBeNull());
  });

  test('reste utilisable si le chargement des sons échoue', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    createAudioPlayer.mockImplementation(() => {
      throw new Error('moteur audio indisponible');
    });

    const { getByTestId, queryByTestId } = await render(<App />);

    await waitFor(() => expect(warnSpy).toHaveBeenCalled());

    // L'écran principal s'affiche malgré l'absence de son.
    expect(getByTestId('main-screen')).toBeTruthy();

    // La modale de paramètres reste ouvrable.
    expect(queryByTestId('switch-vibration')).toBeNull();
    fireEvent.press(getByTestId('settings-button'));
    await waitFor(() => expect(queryByTestId('switch-vibration')).not.toBeNull());

    // La vibration fonctionne toujours sur un retournement.
    await act(async () => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });
    await waitFor(() => expect(Haptics.impactAsync).toHaveBeenCalledTimes(1));
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });
});
