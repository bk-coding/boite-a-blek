import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MainScreen } from './MainScreen';

const dummySource = { uri: 'test' };

describe('MainScreen', () => {
  test('appelle onOpenSettings au clic sur la roue dentée', async () => {
    const onOpenSettings = jest.fn();
    const { getByTestId } = await render(
      <MainScreen
        illustrationSource={dummySource}
        initialZone="HAUT"
        flipTrigger={null}
        onOpenSettings={onOpenSettings}
      />
    );

    fireEvent.press(getByTestId('settings-button'));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  test('affiche l’illustration sans planter au changement de flipTrigger', async () => {
    const { getByTestId, rerender } = await render(
      <MainScreen
        illustrationSource={dummySource}
        initialZone="HAUT"
        flipTrigger={null}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();

    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        initialZone="HAUT"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 500 }}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();

    // Rejouer le même id ne doit pas provoquer d'erreur (pas de re-déclenchement).
    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        initialZone="HAUT"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 500 }}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();
  });
});
