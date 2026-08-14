export interface DriftInput {
  speedMps: number;
  longitudinalSpeed: number;
  lateralSpeed: number;
  yawRate: number;
  handbrake: boolean;
  now: number;
  dt: number;
  multiplier: number;
}

export interface DriftState {
  active: boolean;
  startedAt: number;
  duration: number;
  angleDeg: number;
  radiusM: number;
  points: number;
  pendingPoints: number;
  direction: 'LEFT' | 'RIGHT';
}

export interface DriftUpdate {
  state: DriftState;
  scoreDelta: number;
  completedPoints: number;
  started: boolean;
}

export function bankDriftScore(currentScore: number, completedPoints: number): { total: number; added: number } {
  const added = Math.max(0, Math.round(completedPoints));
  return { total: currentScore + added, added };
}

export function createDriftState(): DriftState {
  return { active: false, startedAt: 0, duration: 0, angleDeg: 0, radiusM: Number.POSITIVE_INFINITY, points: 0, pendingPoints: 0, direction: 'LEFT' };
}

export function updateDrift(previous: DriftState, input: DriftInput): DriftUpdate {
  const angleDeg = Math.atan2(Math.abs(input.lateralSpeed), Math.max(2, Math.abs(input.longitudinalSpeed))) * 180 / Math.PI;
  const radiusM = Math.abs(input.yawRate) > .025 ? input.speedMps / Math.abs(input.yawRate) : Number.POSITIVE_INFINITY;
  const initiating = input.handbrake
    && input.speedMps >= 16
    && angleDeg >= 3.5
    && angleDeg <= 52
    && Math.abs(input.yawRate) >= .075
    && radiusM >= 4
    && radiusM <= 380;
  const sustaining = previous.active
    && input.handbrake
    && input.speedMps >= 14
    && angleDeg >= 2
    && angleDeg <= 58
    && Math.abs(input.yawRate) >= .04
    && radiusM >= 3.5
    && radiusM <= 450;
  const valid = initiating || sustaining;

  if (!valid) {
    const completedPoints = previous.active && previous.duration >= .5 && previous.points >= 90
      ? Math.round(previous.points * .4 / 5) * 5
      : 0;
    return { state: createDriftState(), scoreDelta: 0, completedPoints, started: false };
  }

  const started = !previous.active;
  const state = previous.active ? { ...previous } : { ...createDriftState(), active: true, startedAt: input.now };
  state.active = true;
  state.duration += input.dt;
  state.angleDeg = angleDeg;
  state.radiusM = radiusM;
  state.direction = input.lateralSpeed >= 0 ? 'LEFT' : 'RIGHT';

  // A brief initiation delay rejects accidental taps while allowing a
  // deliberate Space press to begin paying out almost immediately. Once established, angle and
  // speed both matter; a broad, slow handbrake turn is worth very little.
  if (state.duration >= .055) {
    const angleFactor = Math.min(2.1, Math.max(.08, (angleDeg - 2.5) / 18));
    const speedFactor = Math.min(1.75, Math.max(.55, input.speedMps / 42));
    state.pendingPoints += (42 + 115 * angleFactor) * speedFactor * Math.max(1, input.multiplier * .5) * input.dt;
  }
  const scoreDelta = Math.floor(state.pendingPoints);
  if (scoreDelta > 0) {
    state.pendingPoints -= scoreDelta;
    state.points += scoreDelta;
  }
  return { state, scoreDelta, completedPoints: 0, started };
}
