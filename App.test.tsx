import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
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
          Promise.resolve({ sound: mockSound, status: { isLoaded: true, durationMillis: 600 } })
        ),
      },
      __mockSound: mockSound,
    },
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
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import App from './App';

const emit = (Accelerometer as unknown as { __emit: (d: { x: number; y: number; z: number }) => void }).__emit;
const HAUT_SAMPLE = { x: 0, y: 1, z: 0 };
const BAS_SAMPLE = { x: 0, y: -1, z: 0 };

describe('App', () => {
  let now = 0;

  beforeEach(async () => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('joue le son et vibre sur un flip haut-vers-bas', async () => {
    await render(<App />);
    await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(2));

    const mockSound = (Audio as unknown as { __mockSound: any }).__mockSound;

    await act(async () => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });

    await waitFor(() => expect(mockSound.playAsync).toHaveBeenCalledTimes(1));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  test('ne joue pas le son bas-vers-haut si désactivé, mais vibre quand même', async () => {
    await AsyncStorage.setItem(
      '@boite-a-blek/settings',
      JSON.stringify({ sonBasVersHautActif: false, volume: 1, vibrationActive: true })
    );

    await render(<App />);
    await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(2));

    const mockSound = (Audio as unknown as { __mockSound: any }).__mockSound;

    // haut-vers-bas d'abord (toujours actif)
    await act(async () => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });
    await waitFor(() => expect(mockSound.playAsync).toHaveBeenCalledTimes(1));

    // puis bas-vers-haut (désactivé)
    await act(async () => {
      now = 800;
      emit(HAUT_SAMPLE);
      now = 930;
      emit(HAUT_SAMPLE);
    });

    await waitFor(() => expect(Haptics.impactAsync).toHaveBeenCalledTimes(2));
    expect(mockSound.playAsync).toHaveBeenCalledTimes(1); // pas de second appel
  });
});
