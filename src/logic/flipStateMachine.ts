export type FlipZone = 'HAUT' | 'BAS' | 'TRANSITION';
export type FlipEvent = 'haut-vers-bas' | 'bas-vers-haut' | null;

export interface FlipStateMachineConfig {
  hautMinDeg: number;
  hautMaxDeg: number;
  basThresholdDeg: number;
  stabilizationMs: number;
}

export interface FlipStateMachineState {
  zone: FlipZone;
  candidateZone: 'HAUT' | 'BAS' | null;
  candidateSinceMs: number | null;
  confirmedZone: 'HAUT' | 'BAS';
}

export function createInitialFlipState(
  initialZone: 'HAUT' | 'BAS' = 'HAUT'
): FlipStateMachineState {
  return {
    zone: initialZone,
    candidateZone: null,
    candidateSinceMs: null,
    confirmedZone: initialZone,
  };
}

function normalizeAngle(angleDeg: number): number {
  let a = angleDeg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

export function classifyAngle(angleDeg: number, config: FlipStateMachineConfig): FlipZone {
  const a = normalizeAngle(angleDeg);
  if (a >= config.hautMinDeg && a <= config.hautMaxDeg) {
    return 'HAUT';
  }
  if (Math.abs(a) >= config.basThresholdDeg) {
    return 'BAS';
  }
  return 'TRANSITION';
}

export function stepFlipStateMachine(
  state: FlipStateMachineState,
  angleDeg: number,
  timestampMs: number,
  config: FlipStateMachineConfig
): { state: FlipStateMachineState; event: FlipEvent } {
  const instantZone = classifyAngle(angleDeg, config);
  let { candidateZone, candidateSinceMs, confirmedZone } = state;
  let event: FlipEvent = null;

  const isOppositeZone =
    (instantZone === 'HAUT' || instantZone === 'BAS') && instantZone !== confirmedZone;

  if (isOppositeZone) {
    if (candidateZone !== instantZone) {
      candidateZone = instantZone;
      candidateSinceMs = timestampMs;
    } else if (
      candidateSinceMs !== null &&
      timestampMs - candidateSinceMs >= config.stabilizationMs
    ) {
      event = confirmedZone === 'HAUT' ? 'haut-vers-bas' : 'bas-vers-haut';
      confirmedZone = instantZone;
      candidateZone = null;
      candidateSinceMs = null;
    }
  } else {
    candidateZone = null;
    candidateSinceMs = null;
  }

  return {
    state: { zone: instantZone, candidateZone, candidateSinceMs, confirmedZone },
    event,
  };
}
