import { Platform } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';

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
import { useFlipDetector } from './useFlipDetector';

const emit = (Accelerometer as unknown as { __emit: (d: { x: number; y: number; z: number }) => void }).__emit;

describe('useFlipDetector — correction de signe Android', () => {
  let now = 0;
  let originalOS: typeof Platform.OS;

  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    originalOS = Platform.OS;
    (Platform as { OS: typeof Platform.OS }).OS = 'android';
  });

  afterEach(() => {
    (Platform as { OS: typeof Platform.OS }).OS = originalOS;
    jest.restoreAllMocks();
  });

  test('un échantillon brut « inversé » (convention Android) est classé HAUT, pas BAS', async () => {
    // Sur iOS, {x:0, y:1, z:0} est classé HAUT (atan2(0,1)=0°). L'hypothèse
    // vérifiée ici : le même échantillon brut, mesuré par l'accéléromètre
    // Android pour la MÊME orientation physique, est {x:0, y:-1, z:0} (signe
    // inversé) — sans la correction plateforme, il serait mal classé BAS.
    const onFlip = jest.fn();
    const { result } = await renderHook(() => useFlipDetector(onFlip));

    await act(() => {
      now = 0;
      emit({ x: 0, y: -1, z: 0 });
      now = 130;
      emit({ x: 0, y: -1, z: 0 });
    });

    // Toujours HAUT : aucune transition n'a dû être détectée depuis l'état
    // initial (HAUT), et aucun son ne s'est déclenché.
    expect(result.current.confirmedZone).toBe('HAUT');
    expect(onFlip).not.toHaveBeenCalled();
  });

  test('déclenche haut-vers-bas au bon moment malgré la convention de signe inversée', async () => {
    const onFlip = jest.fn();
    await renderHook(() => useFlipDetector(onFlip));

    // Équivalent Android du BAS_SAMPLE iOS ({x:0, y:-1, z:0}).
    await act(() => {
      now = 0;
      emit({ x: 0, y: 1, z: 0 });
      now = 130;
      emit({ x: 0, y: 1, z: 0 });
    });

    expect(onFlip).toHaveBeenCalledWith('haut-vers-bas');
  });
});
