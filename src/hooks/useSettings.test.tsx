import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSettings, DEFAULT_SETTINGS } from './useSettings';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// NOTE: @testing-library/react-native@14 makes `renderHook`/`act` async
// (they return Promises so effects are flushed on the RN test renderer).
// Every call below is awaited for that reason; the timing values, samples
// and assertions are otherwise identical to the brief.
describe('useSettings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('retourne les valeurs par défaut puis isLoaded passe à true', async () => {
    const { result } = await renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
  });

  test('persiste les modifications et les recharge au prochain montage', async () => {
    const { result, unmount } = await renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(() => {
      result.current.updateSettings({ basVersHautSoundKey: '10-minutes', volume: 0.4 });
    });

    await waitFor(() =>
      expect(result.current.settings).toEqual({
        ...DEFAULT_SETTINGS,
        basVersHautSoundKey: '10-minutes',
        volume: 0.4,
      })
    );

    await act(() => {
      unmount();
    });

    const { result: secondResult } = await renderHook(() => useSettings());
    await waitFor(() => expect(secondResult.current.isLoaded).toBe(true));
    expect(secondResult.current.settings).toEqual({
      ...DEFAULT_SETTINGS,
      basVersHautSoundKey: '10-minutes',
      volume: 0.4,
    });
  });

  test('ignore l’ancien réglage booléen (sonBasVersHautActif) et retombe sur « Aucun »', async () => {
    // Migration depuis l'ancien schéma (interrupteur on/off) : un testeur
    // ayant déjà l'app installée avec `sonBasVersHautActif: true` en
    // stockage doit démarrer avec le nouveau sélecteur sur « Aucun »
    // (basVersHautSoundKey: null), pas avec un son présélectionné.
    await AsyncStorage.setItem(
      '@boite-a-blek/settings',
      JSON.stringify({ sonBasVersHautActif: true, volume: 1, vibrationActive: true })
    );

    const { result } = await renderHook(() => useSettings());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.settings.basVersHautSoundKey).toBeNull();
  });

  test('passe isLoaded à true avec les valeurs par défaut si le chargement échoue', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('lecture impossible'));

    const { result } = await renderHook(() => useSettings());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
