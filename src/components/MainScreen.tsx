import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ILLUSTRATION_BOTTOM_MARGIN,
  ILLUSTRATION_SIZE,
  ILLUSTRATION_TOP_MARGIN,
} from '../constants/config';

export interface FlipAnimationTrigger {
  id: number;
  toZone: 'HAUT' | 'BAS';
  durationMs: number;
}

export interface MainScreenProps {
  illustrationSource: ImageSourcePropType;
  /**
   * Position de repos réelle du téléphone. L'illustration s'y resynchronise
   * dès qu'aucune animation n'est en cours — indispensable après une
   * transition dont l'évènement a été supprimé par le cooldown de lecture
   * (l'orientation physique a changé sans qu'aucun `flipTrigger` ne l'ait
   * accompagnée).
   */
  restZone: 'HAUT' | 'BAS';
  flipTrigger: FlipAnimationTrigger | null;
  /**
   * Angle de roulis brut et continu (degrés). Fait tourner l'illustration en
   * temps réel pour qu'elle reste toujours dans le bon sens pour la personne
   * qui regarde, quelle que soit la façon dont le téléphone est orienté.
   */
  angleDeg: number;
  onOpenSettings: () => void;
}

export function MainScreen({
  illustrationSource,
  restZone,
  flipTrigger,
  angleDeg,
  onOpenSettings,
}: MainScreenProps) {
  const { height: windowHeight } = useWindowDimensions();
  const topY = ILLUSTRATION_TOP_MARGIN;
  const bottomY = windowHeight - ILLUSTRATION_SIZE - ILLUSTRATION_BOTTOM_MARGIN;

  const zoneToTranslateY = (zone: 'HAUT' | 'BAS'): number =>
    zone === 'HAUT' ? topY : bottomY;

  const translateY = useRef(new Animated.Value(zoneToTranslateY(restZone))).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const lastTriggerId = useRef<number | null>(null);
  const animationInFlightRef = useRef(false);
  const restZoneRef = useRef<'HAUT' | 'BAS'>(restZone);

  useEffect(() => {
    if (!flipTrigger || flipTrigger.id === lastTriggerId.current) {
      return;
    }
    lastTriggerId.current = flipTrigger.id;
    const targetZone = flipTrigger.toZone;
    animationInFlightRef.current = true;
    Animated.timing(translateY, {
      toValue: zoneToTranslateY(targetZone),
      duration: flipTrigger.durationMs,
      useNativeDriver: true,
    }).start(() => {
      animationInFlightRef.current = false;
      // La position de repos a pu changer pendant l'animation (transition
      // ignorée par le cooldown) : on rattrape l'état physique réel.
      if (restZoneRef.current !== targetZone) {
        translateY.setValue(zoneToTranslateY(restZoneRef.current));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipTrigger, translateY, topY, bottomY]);

  useEffect(() => {
    restZoneRef.current = restZone;
    if (animationInFlightRef.current) {
      // Resynchronisation différée à la fin de l'animation en cours.
      return;
    }
    translateY.setValue(zoneToTranslateY(restZone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restZone, translateY, topY, bottomY]);

  useEffect(() => {
    // Suivi en temps réel, sans animation : la rotation doit être aussi
    // réactive que le geste physique lui-même.
    rotate.setValue(-angleDeg);
  }, [angleDeg, rotate]);

  const rotateInterpolated = rotate.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  return (
    <View style={styles.container} testID="main-screen">
      <Animated.Image
        testID="illustration"
        source={illustrationSource}
        style={[
          styles.illustration,
          { transform: [{ translateY }, { rotate: rotateInterpolated }] },
        ]}
        resizeMode="contain"
      />
      <View style={styles.header}>
        <Text style={styles.title}>La Boîte à Blek</Text>
        <Pressable testID="settings-button" onPress={onOpenSettings}>
          <Ionicons name="settings-outline" size={32} color="#333" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center' },
  header: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: { fontSize: 20, fontWeight: '600', color: '#333' },
  illustration: {
    position: 'absolute',
    top: 0,
    width: ILLUSTRATION_SIZE,
    height: ILLUSTRATION_SIZE,
  },
});
