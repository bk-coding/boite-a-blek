import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCELEROMETER_UPDATE_INTERVAL_MS,
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
   * Angle de roulis continu (degrés, lissé et « déroulé » par
   * `useFlipDetector`). Fait tourner l'illustration en temps réel pour
   * qu'elle reste toujours dans le bon sens pour la personne qui regarde,
   * quelle que soit la façon dont le téléphone est orienté.
   */
  angleDeg: number;
  /**
   * Image de fond du thème choisi dans les paramètres, ou `null` pour le
   * fond blanc par défaut (réglage `themeKey` non défini).
   */
  themeSource: ImageSourcePropType | null;
  onOpenSettings: () => void;
}

export function MainScreen({
  illustrationSource,
  restZone,
  flipTrigger,
  angleDeg,
  themeSource,
  onOpenSettings,
}: MainScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const topY = ILLUSTRATION_TOP_MARGIN;
  const bottomY = windowHeight - ILLUSTRATION_SIZE - ILLUSTRATION_BOTTOM_MARGIN;

  const zoneToTranslateY = (zone: 'HAUT' | 'BAS'): number =>
    zone === 'HAUT' ? topY : bottomY;

  const translateY = useRef(new Animated.Value(zoneToTranslateY(restZone))).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const lastTriggerId = useRef<number | null>(null);
  const animationInFlightRef = useRef(false);
  const restZoneRef = useRef<'HAUT' | 'BAS'>(restZone);

  /**
   * Une fois qu'une animation `useNativeDriver: true` a tourné sur une
   * valeur, React Native « bascule » côté natif tout le nœud animé qui la
   * porte (ici la vue illustrée, puisque `translateY` et `rotate` partagent
   * le même `transform`) : un simple `.setValue()` sur l'une des deux
   * valeurs cesse alors de se refléter de façon fiable, voire fait planter
   * l'autre animation native. On passe donc systématiquement par une
   * animation native, y compris pour les ajustements « instantanés »
   * (durée nulle), plutôt que par `.setValue()`.
   */
  const setTranslateYNative = (toValue: number) => {
    Animated.timing(translateY, { toValue, duration: 0, useNativeDriver: true }).start();
  };

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
        setTranslateYNative(zoneToTranslateY(restZoneRef.current));
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
    setTranslateYNative(zoneToTranslateY(restZone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restZone, translateY, topY, bottomY]);

  useEffect(() => {
    // `useNativeDriver: true`, comme `translateY` : les deux valeurs
    // partagent le même nœud animé (le `transform` de cette vue), et React
    // Native exige qu'elles soient pilotées de façon cohérente — mélanger
    // JS et natif sur un même nœud produit un rendu saccadé, voire une
    // erreur d'exécution. Une durée courte, calée sur la cadence du
    // capteur, en linéaire, donne une rotation continue et fluide plutôt
    // qu'un saut brutal à chaque échantillon.
    Animated.timing(rotate, {
      // +180° : l'illustration est dessinée à l'envers par rapport à
      // l'angle 0 tel que calculé (constaté sur device réel, identique sur
      // iOS et Android une fois la correction plateforme du capteur faite
      // dans useFlipDetector). Un simple décalage constant, indépendant de
      // la plateforme.
      toValue: angleDeg + 180,
      duration: ACCELEROMETER_UPDATE_INTERVAL_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [angleDeg, rotate]);

  const rotateInterpolated = rotate.interpolate({
    // Pente de 1° par unité : l'extrapolation par défaut d'Animated reste
    // exacte au-delà de cet intervalle, donc `angleDeg` peut dépasser
    // ±180° (rotations multiples) sans que la conversion en degrés ne se
    // fausse.
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  return (
    <View style={styles.container} testID="main-screen">
      {themeSource ? (
        <Image
          testID="theme-background"
          source={themeSource}
          // Sur Android, resizeMode="cover" a besoin d'une largeur/hauteur
          // numériques explicites : avec un simple encadrement par
          // top/left/right/bottom, l'image est parfois affichée à sa taille
          // intrinsèque (donc énormément zoomée) au lieu d'être ajustée à
          // l'écran. Constaté sur device réel.
          style={[styles.themeBackground, { width: windowWidth, height: windowHeight }]}
          resizeMode="cover"
        />
      ) : null}
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
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 24,
    // Toujours sur fond blanc opaque : avec un thème sombre ou chargé,
    // le titre et la roue dentée deviendraient illisibles s'ils se
    // superposaient directement à l'image de fond.
    backgroundColor: '#fff',
  },
  title: { fontSize: 20, fontWeight: '600', color: '#333' },
  themeBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  illustration: {
    position: 'absolute',
    top: 0,
    width: ILLUSTRATION_SIZE,
    height: ILLUSTRATION_SIZE,
  },
});
