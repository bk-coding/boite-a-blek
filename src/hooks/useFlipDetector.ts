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

/**
 * Lissage exponentiel (EMA) : réduit le tremblement dû au bruit de
 * l'accéléromètre sur l'angle affiché, sans affecter la détection du geste
 * (qui continue d'utiliser l'angle brut, déjà protégé par le délai de
 * stabilisation et le filtre de verticalité).
 */
const ROTATION_SMOOTHING_FACTOR = 0.2;

/**
 * Écart le plus court (en degrés, dans (-180, 180]) entre deux angles
 * « enroulés ». Sert à faire avancer un angle continu (non ramené dans
 * [-180, 180]) sans le saut brutal qui se produirait au passage de la
 * frontière ±180°.
 */
export function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  let delta = (toDeg - fromDeg) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

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
   * Angle de roulis continu (degrés) destiné à l'affichage : lissé (EMA) pour
   * ne pas trembler avec le bruit du capteur, et « déroulé » (non ramené dans
   * [-180, 180]) pour ne jamais sauter en passant par ±180°, même en cas de
   * rotations multiples. La détection du geste, elle, utilise l'angle brut en
   * interne et n'est pas affectée par ce lissage.
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
  const smoothedXRef = useRef(0);
  const smoothedYRef = useRef(1);
  const previousWrappedAngleRef = useRef(0);
  const unwrappedAngleRef = useRef(0);

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

      smoothedXRef.current += ROTATION_SMOOTHING_FACTOR * (x - smoothedXRef.current);
      smoothedYRef.current += ROTATION_SMOOTHING_FACTOR * (y - smoothedYRef.current);
      const smoothedWrappedAngleDeg =
        (Math.atan2(smoothedXRef.current, smoothedYRef.current) * 180) / Math.PI;
      unwrappedAngleRef.current += shortestAngleDelta(
        previousWrappedAngleRef.current,
        smoothedWrappedAngleDeg
      );
      previousWrappedAngleRef.current = smoothedWrappedAngleDeg;
      setAngleDeg(unwrappedAngleRef.current);

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
