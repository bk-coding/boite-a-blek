import React from 'react';
import { Animated } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { MainScreen } from './MainScreen';
import {
  ILLUSTRATION_BOTTOM_MARGIN,
  ILLUSTRATION_SIZE,
  ILLUSTRATION_TOP_MARGIN,
} from '../constants/config';

const dummySource = { uri: 'test' };

// Dimensions par défaut de l'environnement de test RN (Dimensions.get('window')).
const TEST_WINDOW_HEIGHT = 1334;
const TOP_Y = ILLUSTRATION_TOP_MARGIN;
const BOTTOM_Y = TEST_WINDOW_HEIGHT - ILLUSTRATION_SIZE - ILLUSTRATION_BOTTOM_MARGIN;

const translateYOf = (element: any): number => element.props.style.transform[0].translateY;
const rotateOf = (element: any): string => element.props.style.transform[1].rotate;

/**
 * `Animated.timing` réel utilise `requestAnimationFrame` : même avec
 * `duration: 0`, la valeur ne se met pas à jour de façon synchrone dans
 * l'environnement de test. On simule une résolution immédiate pour pouvoir
 * lire `translateY`/`rotate` juste après un rendu, sans dépendre du minutage
 * réel de l'animation.
 */
function mockInstantAnimatedTiming() {
  jest.spyOn(Animated, 'timing').mockImplementation((value: any, config: any) => {
    return {
      start: (callback?: (result: { finished: boolean }) => void) => {
        value.setValue(config.toValue);
        callback?.({ finished: true });
      },
      stop: () => {},
      reset: () => {},
    } as unknown as Animated.CompositeAnimation;
  });
}

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
        angleDeg={0}
        onOpenSettings={onOpenSettings}
      />
    );

    fireEvent.press(getByTestId('settings-button'));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  test('affiche le titre à gauche de la roue dentée', async () => {
    const { getByText } = await render(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={null}
        angleDeg={0}
        onOpenSettings={() => {}}
      />
    );

    expect(getByText('La Boîte à Blek')).toBeTruthy();
  });

  test('affiche l’illustration sans planter au changement de flipTrigger', async () => {
    const { getByTestId, rerender } = await render(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={null}
        angleDeg={0}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();

    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 500 }}
        angleDeg={0}
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
        angleDeg={0}
        onOpenSettings={() => {}}
      />
    );
    expect(getByTestId('illustration')).toBeTruthy();
  });

  test('recale la position de repos sur restZone quand aucune animation n’est en cours', async () => {
    mockInstantAnimatedTiming();
    const { getByTestId, rerender } = await render(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={null}
        angleDeg={0}
        onOpenSettings={() => {}}
      />
    );
    expect(translateYOf(getByTestId('illustration'))).toBe(TOP_Y);

    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="BAS"
        flipTrigger={null}
        angleDeg={0}
        onOpenSettings={() => {}}
      />
    );

    expect(translateYOf(getByTestId('illustration'))).toBe(BOTTOM_Y);
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
        angleDeg={0}
        onOpenSettings={() => {}}
      />
    );

    // Retournement vers le bas : l'animation démarre. (`Animated.timing` a
    // déjà été appelé deux fois au montage : resynchronisation initiale de
    // `translateY` et lancement de la rotation.)
    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="BAS"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 600 }}
        angleDeg={0}
        onOpenSettings={() => {}}
      />
    );
    expect(Animated.timing).toHaveBeenCalledTimes(3);
    expect(translateYOf(getByTestId('illustration'))).toBe(BOTTOM_Y);

    // Retour en haut pendant le cooldown : aucun flipTrigger (évènement
    // supprimé), seule restZone change. L'animation en cours n'est pas coupée.
    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={{ id: 1, toZone: 'BAS', durationMs: 600 }}
        angleDeg={0}
        onOpenSettings={() => {}}
      />
    );
    expect(Animated.timing).toHaveBeenCalledTimes(3);
    expect(translateYOf(getByTestId('illustration'))).toBe(BOTTOM_Y);

    // Fin de l'animation : l'illustration rattrape l'orientation physique.
    await act(async () => {
      completions.forEach((done) => done());
    });
    expect(translateYOf(getByTestId('illustration'))).toBe(TOP_Y);
  });

  test('fait tourner l’illustration en temps réel selon angleDeg', async () => {
    // `Animated.timing` est simulé pour que la rotation atteigne sa cible
    // immédiatement, indépendamment de la durée réelle de l'animation.
    jest.spyOn(Animated, 'timing').mockImplementation((value: any, config: any) => {
      return {
        start: (callback?: (result: { finished: boolean }) => void) => {
          value.setValue(config.toValue);
          callback?.({ finished: true });
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
        angleDeg={0}
        onOpenSettings={() => {}}
      />
    );
    expect(rotateOf(getByTestId('illustration'))).toBe('0deg');

    await rerender(
      <MainScreen
        illustrationSource={dummySource}
        restZone="HAUT"
        flipTrigger={null}
        angleDeg={90}
        onOpenSettings={() => {}}
      />
    );

    // Vérifié empiriquement sur device réel : l'illustration doit tourner
    // dans le même sens que l'angle mesuré (pas de compensation de signe).
    expect(rotateOf(getByTestId('illustration'))).toBe('90deg');
  });
});
