import { useCallback, useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import {
  createInitialFlipState,
  stepFlipStateMachine,
  FlipStateMachineState,
  FlipZone,
} from '../logic/flipStateMachine';
import { FLIP_CONFIG, ACCELEROMETER_UPDATE_INTERVAL_MS } from '../constants/config';

export type FlipEventType = 'haut-vers-bas' | 'bas-vers-haut';

export interface UseFlipDetectorResult {
  /** Zone instantanée de l'échantillon courant (peut valoir `TRANSITION`). */
  zone: FlipZone;
  /**
   * Zone de repos réellement confirmée par la machine à états. Contrairement
   * à `onFlip`, elle continue d'avancer pendant le cooldown de lecture : c'est
   * la seule source de vérité pour resynchroniser l'affichage après une
   * transition dont l'évènement a été supprimé.
   */
  confirmedZone: 'HAUT' | 'BAS';
  /**
   * Angle de roulis brut et continu (degrés, `atan2(x, y)`), mis à jour à
   * chaque échantillon valide. Sert à faire suivre l'orientation réelle du
   * téléphone à l'illustration (rotation en temps réel), indépendamment des
   * zones HAUT/BAS/TRANSITION utilisées pour la détection du geste.
   */
  angleDeg: number;
  notifyPlaybackStarted: (durationMs: number) => void;
}

export function useFlipDetector(
  onFlip: (event: FlipEventType) => void
): UseFlipDetectorResult {
  const machineStateRef = useRef<FlipStateMachineState>(createInitialFlipState('HAUT'));
  const busyUntilMsRef = useRef<number>(0);
  const onFlipRef = useRef(onFlip);
  onFlipRef.current = onFlip;
  const [zone, setZone] = useState<FlipZone>('HAUT');
  const [confirmedZone, setConfirmedZone] = useState<'HAUT' | 'BAS'>('HAUT');
  const [angleDeg, setAngleDeg] = useState<number>(0);

  useEffect(() => {
    Accelerometer.setUpdateInterval(ACCELEROMETER_UPDATE_INTERVAL_MS);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Filtre de verticalité (spec §3) : un téléphone posé à plat ou trop
      // penché produirait un angle x/y purement bruité, susceptible de se
      // « stabiliser » en BAS et de déclencher un son fantôme. On ignore
      // complètement ces échantillons (aucun pas de machine à états).
      if (
        Math.abs(z) > FLIP_CONFIG.maxAbsZ ||
        Math.hypot(x, y) < FLIP_CONFIG.minHorizontalMagnitude
      ) {
        return;
      }

      const currentAngleDeg = (Math.atan2(x, y) * 180) / Math.PI;
      const timestampMs = Date.now();
      const { state: nextState, event } = stepFlipStateMachine(
        machineStateRef.current,
        currentAngleDeg,
        timestampMs,
        FLIP_CONFIG
      );
      machineStateRef.current = nextState;
      setZone(nextState.zone);
      setConfirmedZone(nextState.confirmedZone);
      setAngleDeg(currentAngleDeg);

      if (event && timestampMs >= busyUntilMsRef.current) {
        onFlipRef.current(event);
      }
    });

    return () => subscription.remove();
  }, []);

  const notifyPlaybackStarted = useCallback((durationMs: number) => {
    busyUntilMsRef.current = Date.now() + durationMs;
  }, []);

  return { zone, confirmedZone, angleDeg, notifyPlaybackStarted };
}
