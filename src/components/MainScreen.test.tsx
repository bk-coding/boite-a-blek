import React from 'react';
import { Animated } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { MainScreen } from './MainScreen';
import { ILLUSTRATION_TRAVEL_DISTANCE } from '../constants/config';

const dummySource = { uri: 'test' };

const translateYOf = (element: any): number => element.props.style.transform[0].translateY;

describe('MainScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('appelle onOpenSettings au clic sur la roue dentée', async () => {
    const onOpenSettings = jest.fn();
    const { getByTestId } = await render(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
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
        restZone="HAUT"
        flipTrigger={null}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();

    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 500 }}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();

    // Rejouer le même id ne doit pas provoquer d'erreur (pas de re-déclenchement).
    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 500 }}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();
  });

  test('recale la position de repos sur restZone quand aucune animation n’est en cours', async () => {
    const { getByTestId, rerender } = await render(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={null}
        onOpenSettings={() => {}}
      />
    );
    expect(translateYOf(getByTestId('illustration'))).toBe(0);

    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="BAS"
        flipTrigger={null}
        onOpenSettings={() => {}}
      />
    );

    expect(translateYOf(getByTestId('illustration'))).toBe(ILLUSTRATION_TRAVEL_DISTANCE);
  });

  test('diffère le recalage jusqu’à la fin de l’animation en cours', async () => {
    // `Animated.timing` est simulé : la valeur atteint sa cible immédiatement,
    // mais le callback de fin n'est déclenché qu'à la demande, ce qui permet
    // d'observer précisément la fenêtre « animation en vol ».
    const completions: (() => void)[] = [];
    jest
      .spyOn(Animated, 'timing')
      .mockImplementation((value: any, config: any) => {
        return {
          start: (callback?: (result: { finished: boolean }) => void) => {
            value.setValue(config.toValue);
            completions.push(() => callback?.({ finished: true }));
          },
          stop: () => {},
          reset: () => {},
        } as unknown as Animated.CompositeAnimation;
      });

    const { getByTestId, rerender } = await render(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={null}
        onOpenSettings={() => {}}
      />
    );

    // Retournement vers le bas : l'animation démarre.
    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="BAS"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 600 }}
        onOpenSettings={() => {}}
      />
    );
    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(translateYOf(getByTestId('illustration'))).toBe(ILLUSTRATION_TRAVEL_DISTANCE);

    // Retour en haut pendant le cooldown : aucun flipTrigger (évènement
    // supprimé), seule restZone change. L'animation en cours n'est pas coupée.
    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 600 }}
        onOpenSettings={() => {}}
      />
    );
    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(translateYOf(getByTestId('illustration'))).toBe(ILLUSTRATION_TRAVEL_DISTANCE);

    // Fin de l'animation : l'illustration rattrape l'orientation physique.
    await act(async () => {
      completions.forEach((done) => done());
    });
    expect(translateYOf(getByTestId('illustration'))).toBe(0);
  });
});
