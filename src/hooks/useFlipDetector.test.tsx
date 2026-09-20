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
// Téléphone posé à plat sur une table : la gravité est presque entièrement
// sur z. La composante x/y résiduelle donne pourtant atan2(0, -0.2) = 180°,
// soit la zone BAS si l'on ignorait z — exactement le son fantôme à éviter.
const A_PLAT_SAMPLE = { x: 0, y: -0.2, z: 0.98 };

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
    // …mais la machine à états, elle, a bien avancé : l'orientation physique
    // réelle est de nouveau HAUT. C'est cette valeur qui permet à l'écran de
    // se resynchroniser malgré l'évènement supprimé.
    expect(result.current.confirmedZone).toBe('HAUT');

    await act(() => {
      now = 800;
      emit(BAS_SAMPLE);
      now = 930;
      emit(BAS_SAMPLE); // cooldown terminé, nouvelle transition acceptée
    });
    expect(onFlip).toHaveBeenCalledTimes(2);
    expect(onFlip).toHaveBeenLastCalledWith('haut-vers-bas');
    expect(result.current.confirmedZone).toBe('BAS');
  });

  test('ignore les échantillons où le téléphone n’est pas raisonnablement vertical', async () => {
    const onFlip = jest.fn();
    const { result } = await renderHook(() => useFlipDetector(onFlip));

    await act(() => {
      now = 0;
      emit(A_PLAT_SAMPLE);
      now = 130;
      emit(A_PLAT_SAMPLE);
      now = 400; // bien au-delà de la fenêtre de stabilisation
      emit(A_PLAT_SAMPLE);
    });

    expect(onFlip).not.toHaveBeenCalled();
    expect(result.current.confirmedZone).toBe('HAUT');

    // Contrôle : les mêmes x/y, mais téléphone vertical, déclenchent bien.
    await act(() => {
      now = 500;
      emit(BAS_SAMPLE);
      now = 630;
      emit(BAS_SAMPLE);
    });
    expect(onFlip).toHaveBeenCalledWith('haut-vers-bas');
  });

  test('expose l’angle brut en continu pour suivre l’orientation en temps réel', async () => {
    const onFlip = jest.fn();
    const { result } = await renderHook(() => useFlipDetector(onFlip));

    expect(result.current.angleDeg).toBe(0);

    await act(() => {
      now = 0;
      emit({ x: 1, y: 0, z: 0 }); // atan2(1, 0) = 90°
    });
    expect(result.current.angleDeg).toBeCloseTo(90);

    await act(() => {
      now = 10;
      emit(A_PLAT_SAMPLE); // filtré (téléphone à plat) : angle inchangé
    });
    expect(result.current.angleDeg).toBeCloseTo(90);
  });
});
