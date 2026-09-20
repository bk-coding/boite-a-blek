import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsModal } from './SettingsModal';
import { DEFAULT_SETTINGS } from '../hooks/useSettings';

// NOTE: importing DEFAULT_SETTINGS pulls in useSettings.ts, which imports the
// native AsyncStorage module. This test never touches AsyncStorage directly,
// but the module needs to resolve, so it's mocked the same way
// useSettings.test.tsx does it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/slider', () => {
  const ReactActual = require('react');
  return (props: any) => ReactActual.createElement('Slider', props);
});

// NOTE: @testing-library/react-native@14 makes `render` async (it returns a
// Promise so effects are flushed on the RN test renderer). Every call below
// is awaited for that reason; the rest of the brief's test code is unchanged.
describe('SettingsModal', () => {
  test('sélectionne un son pour le retour en position haute', async () => {
    const onChangeSettings = jest.fn();
    const { getByTestId } = await render(
      <SettingsModal
        visible
        settings={DEFAULT_SETTINGS}
        onChangeSettings={onChangeSettings}
        onClose={() => {}}
      />
    );

    fireEvent.press(getByTestId('sound-option-10-minutes'));

    expect(onChangeSettings).toHaveBeenCalledWith({ basVersHautSoundKey: '10-minutes' });
  });

  test('« Aucun » repasse le réglage à null', async () => {
    const onChangeSettings = jest.fn();
    const { getByTestId } = await render(
      <SettingsModal
        visible
        settings={{ ...DEFAULT_SETTINGS, basVersHautSoundKey: '10-minutes' }}
        onChangeSettings={onChangeSettings}
        onClose={() => {}}
      />
    );

    fireEvent.press(getByTestId('sound-option-none'));

    expect(onChangeSettings).toHaveBeenCalledWith({ basVersHautSoundKey: null });
  });

  test('coche l’option actuellement sélectionnée, et une seule', async () => {
    const { getByTestId, queryByTestId } = await render(
      <SettingsModal
        visible
        settings={{ ...DEFAULT_SETTINGS, basVersHautSoundKey: '10-minutes' }}
        onChangeSettings={() => {}}
        onClose={() => {}}
      />
    );

    expect(getByTestId('sound-option-10-minutes-check')).toBeTruthy();
    expect(queryByTestId('sound-option-none-check')).toBeNull();
  });

  test('bascule la vibration', async () => {
    const onChangeSettings = jest.fn();
    const { getByTestId } = await render(
      <SettingsModal
        visible
        settings={DEFAULT_SETTINGS}
        onChangeSettings={onChangeSettings}
        onClose={() => {}}
      />
    );

    fireEvent(getByTestId('switch-vibration'), 'valueChange', false);

    expect(onChangeSettings).toHaveBeenCalledWith({ vibrationActive: false });
  });

  test('change le volume via le curseur', async () => {
    const onChangeSettings = jest.fn();
    const { getByTestId } = await render(
      <SettingsModal
        visible
        settings={DEFAULT_SETTINGS}
        onChangeSettings={onChangeSettings}
        onClose={() => {}}
      />
    );

    fireEvent(getByTestId('slider-volume'), 'slidingComplete', 0.3);

    expect(onChangeSettings).toHaveBeenCalledWith({ volume: 0.3 });
  });

  test('ferme la modale', async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <SettingsModal
        visible
        settings={DEFAULT_SETTINGS}
        onChangeSettings={() => {}}
        onClose={onClose}
      />
    );

    fireEvent.press(getByTestId('close-button'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
