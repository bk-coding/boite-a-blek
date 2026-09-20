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
  zone: FlipZone;
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

  useEffect(() => {
    Accelerometer.setUpdateInterval(ACCELEROMETER_UPDATE_INTERVAL_MS);
    const subscription = Accelerometer.addListener(({ x, y }) => {
      const angleDeg = (Math.atan2(x, y) * 180) / Math.PI;
      const timestampMs = Date.now();
      const { state: nextState, event } = stepFlipStateMachine(
        machineStateRef.current,
        angleDeg,
        timestampMs,
        FLIP_CONFIG
      );
      machineStateRef.current = nextState;
      setZone(nextState.zone);

      if (event && timestampMs >= busyUntilMsRef.current) {
        onFlipRef.current(event);
      }
    });

    return () => subscription.remove();
  }, []);

  const notifyPlaybackStarted = useCallback((durationMs: number) => {
    busyUntilMsRef.current = Date.now() + durationMs;
  }, []);

  return { zone, notifyPlaybackStarted };
}
