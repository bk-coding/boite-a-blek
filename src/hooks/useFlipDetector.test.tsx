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

const HAUT_SAMPLE = { x: 0, y: 1, z: 0 };
const BAS_SAMPLE = { x: 0, y: -1, z: 0 };

describe('useFlipDetector', () => {
  let now = 0;

  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // NOTE: @testing-library/react-native@14 makes `renderHook`/`act` async
  // (they return Promises so effects are flushed on the RN test renderer).
  // Every call below is awaited for that reason; the timing values, samples
  // and assertions are otherwise identical to the brief.
  test('déclenche haut-vers-bas après stabilisation', async () => {
    const onFlip = jest.fn();
    await renderHook(() => useFlipDetector(onFlip));

    await act(() => {
      now = 0;
      emit(BAS_SAMPLE);
    });
    expect(onFlip).not.toHaveBeenCalled();

    await act(() => {
      now = 130;
      emit(BAS_SAMPLE);
    });
    expect(onFlip).toHaveBeenCalledWith('haut-vers-bas');
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  test('ignore les transitions détectées pendant le cooldown de lecture', async () => {
    const onFlip = jest.fn();
    const { result } = await renderHook(() => useFlipDetector(onFlip));

    await act(() => {
      now = 0;
      emit(BAS_SAMPLE);
      now = 130;
      emit(BAS_SAMPLE);
    });
    expect(onFlip).toHaveBeenCalledTimes(1);

    await act(() => {
      result.current.notifyPlaybackStarted(600); // busy jusqu'à now=730
    });

    await act(() => {
      now = 200;
      emit(HAUT_SAMPLE);
      now = 330;
      emit(HAUT_SAMPLE); // stabilisé, mais encore dans le cooldown (330 < 730)
    });
    expect(onFlip).toHaveBeenCalledTimes(1); // toujours 1, l'évènement a été ignoré

    await act(() => {
      now = 800;
      emit(BAS_SAMPLE);
      now = 930;
      emit(BAS_SAMPLE); // cooldown terminé, nouvelle transition acceptée
    });
    expect(onFlip).toHaveBeenCalledTimes(2);
    expect(onFlip).toHaveBeenLastCalledWith('haut-vers-bas');
  });
});
