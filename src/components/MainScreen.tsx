import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ILLUSTRATION_TRAVEL_DISTANCE } from '../constants/config';

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
  onOpenSettings: () => void;
}

function zoneToTranslateY(zone: 'HAUT' | 'BAS'): number {
  return zone === 'HAUT' ? 0 : ILLUSTRATION_TRAVEL_DISTANCE;
}

export function MainScreen({
  illustrationSource,
  restZone,
  flipTrigger,
  onOpenSettings,
}: MainScreenProps) {
  const translateY = useRef(new Animated.Value(zoneToTranslateY(restZone))).current;
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
  }, [flipTrigger, translateY]);

  useEffect(() => {
    restZoneRef.current = restZone;
    if (animationInFlightRef.current) {
      // Resynchronisation différée à la fin de l'animation en cours.
      return;
    }
    translateY.setValue(zoneToTranslateY(restZone));
  }, [restZone, translateY]);

  return (
    <View style={styles.container} testID="main-screen">
      <Animated.Image
        testID="illustration"
        source={illustrationSource}
        style={[styles.illustration, { transform: [{ translateY }] }]}
        resizeMode="contain"
      />
      <Pressable
        testID="settings-button"
        onPress={onOpenSettings}
        style={styles.settingsButton}
      >
        <Ionicons name="settings-outline" size={32} color="#333" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  illustration: { width: 200, height: 200 },
  settingsButton: { position: 'absolute', top: 48, right: 24 },
});
