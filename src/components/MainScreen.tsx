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
import { FlipZone } from '../logic/flipStateMachine';

export interface FlipAnimationTrigger {
  id: number;
  toZone: 'HAUT' | 'BAS';
  durationMs: number;
}

export interface MainScreenProps {
  illustrationSource: ImageSourcePropType;
  initialZone: FlipZone;
  flipTrigger: FlipAnimationTrigger | null;
  onOpenSettings: () => void;
}

function zoneToTranslateY(zone: 'HAUT' | 'BAS'): number {
  return zone === 'HAUT' ? 0 : ILLUSTRATION_TRAVEL_DISTANCE;
}

export function MainScreen({
  illustrationSource,
  initialZone,
  flipTrigger,
  onOpenSettings,
}: MainScreenProps) {
  const translateY = useRef(
    new Animated.Value(zoneToTranslateY(initialZone === 'BAS' ? 'BAS' : 'HAUT'))
  ).current;
  const lastTriggerId = useRef<number | null>(null);

  useEffect(() => {
    if (!flipTrigger || flipTrigger.id === lastTriggerId.current) {
      return;
    }
    lastTriggerId.current = flipTrigger.id;
    Animated.timing(translateY, {
      toValue: zoneToTranslateY(flipTrigger.toZone),
      duration: flipTrigger.durationMs,
      useNativeDriver: true,
    }).start();
  }, [flipTrigger, translateY]);

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
