export const PASS_CONFIG = {
  dangerClearance: 2.7,
  perfectClearance: 0.58,
  minimumSpeed: 31,
  minimumRelativeSpeed: 6.5,
  comboWindow: 4.25,
} as const;

export interface PassSample {
  id: number;
  now: number;
  playerX: number;
  playerZ: number;
  playerHalfWidth: number;
  playerHalfLength: number;
  playerSpeed: number;
  trafficX: number;
  trafficZ: number;
  trafficHalfWidth: number;
  trafficHalfLength: number;
  trafficSpeed: number;
  collided: boolean;
}

interface Candidate {
  id: number;
  enteredAt: number;
  overlapped: boolean;
  collided: boolean;
  minClearance: number;
  peakPlayerSpeed: number;
  peakRelativeSpeed: number;
  side: 'left' | 'right';
  overlapAt: number;
}

export interface NearMissEvent {
  id: number;
  time: number;
  clearance: number;
  playerSpeed: number;
  relativeSpeed: number;
  side: 'left' | 'right';
  overlapAt: number;
  perfect: boolean;
  points: number;
}

export function isThreadNeedlePair(first: NearMissEvent, second: NearMissEvent): boolean {
  return first.id !== second.id
    && first.side !== second.side
    && Math.abs(first.overlapAt - second.overlapAt) <= .65;
}

export interface ComboState {
  chain: number;
  multiplier: number;
  expiresAt: number;
  bestMultiplier: number;
}

export function comboForChain(chain: number): number {
  const curve = [1, 1.25, 1.5, 2, 2.5, 3.25, 4.25, 5.5, 6.75, 8];
  return curve[Math.min(Math.max(0, chain), curve.length - 1)];
}

export function calculateNearMissScore(
  clearance: number,
  playerSpeed: number,
  relativeSpeed: number,
  multiplier = 1,
): number {
  const proximity01 = 1 - Math.min(PASS_CONFIG.dangerClearance, Math.max(0, clearance)) / PASS_CONFIG.dangerClearance;
  const proximityFactor = 0.45 + 3.55 * proximity01 * proximity01;
  const speedFactor = Math.min(2.25, Math.max(0.8, playerSpeed / 45));
  const relativeFactor = Math.min(2, Math.max(0.75, relativeSpeed / 15));
  return Math.round(225 * proximityFactor * speedFactor * relativeFactor * multiplier / 5) * 5;
}

export function speedRiskMultiplier(speedMph: number): number {
  if (speedMph < 100) return 1;
  if (speedMph < 120) return 1.15;
  if (speedMph < 140) return 1.35;
  if (speedMph < 160) return 1.65;
  return 2;
}

export function calculateHighSpeedScore(speedMph: number, dt: number, multiplier = 1): number {
  if (speedMph < 100 || dt <= 0) return 0;
  const intensity = Math.min(3.5, 1 + (speedMph - 100) / 30);
  return 18 * intensity * Math.max(1, multiplier) * dt;
}

export function createCombo(): ComboState {
  return { chain: 0, multiplier: 1, expiresAt: 0, bestMultiplier: 1 };
}

export function addToCombo(state: ComboState, now: number, amount = 1): ComboState {
  const continued = now <= state.expiresAt;
  const chain = (continued ? state.chain : 0) + amount;
  const multiplier = comboForChain(chain);
  return {
    chain,
    multiplier,
    expiresAt: now + PASS_CONFIG.comboWindow,
    bestMultiplier: Math.max(state.bestMultiplier, multiplier),
  };
}

export function tickCombo(state: ComboState, now: number): ComboState {
  if (state.chain > 0 && now > state.expiresAt) {
    return { ...state, chain: 0, multiplier: 1, expiresAt: 0 };
  }
  return state;
}

export function breakCombo(state: ComboState, scrape = false): ComboState {
  if (scrape && state.chain > 1) {
    const chain = Math.max(1, Math.floor(state.chain * 0.4));
    return { ...state, chain, multiplier: comboForChain(chain) };
  }
  return { ...state, chain: 0, multiplier: 1, expiresAt: 0 };
}

export class NearMissTracker {
  private readonly candidates = new Map<number, Candidate>();
  private readonly awarded = new Set<number>();

  reset(): void {
    this.candidates.clear();
    this.awarded.clear();
  }

  forget(id: number): void {
    this.candidates.delete(id);
    this.awarded.delete(id);
  }

  markCollision(id: number): void {
    const candidate = this.candidates.get(id);
    if (candidate) candidate.collided = true;
  }

  sample(sample: PassSample, multiplier = 1): NearMissEvent | null {
    if (this.awarded.has(sample.id)) return null;

    const dz = sample.trafficZ - sample.playerZ;
    const combinedLength = sample.playerHalfLength + sample.trafficHalfLength;
    const clearance = Math.abs(sample.playerX - sample.trafficX) - sample.playerHalfWidth - sample.trafficHalfWidth;
    const relativeSpeed = sample.playerSpeed - sample.trafficSpeed;
    let candidate = this.candidates.get(sample.id);

    const approachingEnvelope = dz < 26 && dz > -combinedLength && clearance < PASS_CONFIG.dangerClearance;
    if (!candidate && approachingEnvelope && relativeSpeed >= PASS_CONFIG.minimumRelativeSpeed) {
      candidate = {
        id: sample.id,
        enteredAt: sample.now,
        overlapped: false,
        collided: false,
        minClearance: Number.POSITIVE_INFINITY,
        peakPlayerSpeed: sample.playerSpeed,
        peakRelativeSpeed: relativeSpeed,
        side: sample.playerX < sample.trafficX ? 'left' : 'right',
        overlapAt: Number.POSITIVE_INFINITY,
      };
      this.candidates.set(sample.id, candidate);
    }

    if (!candidate) return null;
    candidate.collided ||= sample.collided || clearance < -0.04;
    candidate.peakPlayerSpeed = Math.max(candidate.peakPlayerSpeed, sample.playerSpeed);
    candidate.peakRelativeSpeed = Math.max(candidate.peakRelativeSpeed, relativeSpeed);
    candidate.side = sample.playerX < sample.trafficX ? 'left' : 'right';

    if (Math.abs(dz) <= combinedLength + 0.25) {
      candidate.overlapped = true;
      candidate.overlapAt = Math.min(candidate.overlapAt, sample.now);
      if (clearance >= 0) candidate.minClearance = Math.min(candidate.minClearance, clearance);
    }

    const cleared = dz < -combinedLength - 1.1;
    if (cleared) {
      this.candidates.delete(sample.id);
      this.awarded.add(sample.id);
      const valid = candidate.overlapped
        && !candidate.collided
        && candidate.minClearance >= 0.06
        && candidate.minClearance <= PASS_CONFIG.dangerClearance
        && candidate.peakPlayerSpeed >= PASS_CONFIG.minimumSpeed
        && candidate.peakRelativeSpeed >= PASS_CONFIG.minimumRelativeSpeed
        && sample.now - candidate.enteredAt < 4;
      if (!valid) return null;
      return {
        id: sample.id,
        time: sample.now,
        clearance: candidate.minClearance,
        playerSpeed: candidate.peakPlayerSpeed,
        relativeSpeed: candidate.peakRelativeSpeed,
        side: candidate.side,
        overlapAt: candidate.overlapAt,
        perfect: candidate.minClearance <= PASS_CONFIG.perfectClearance && candidate.peakRelativeSpeed > 12,
        points: calculateNearMissScore(candidate.minClearance, candidate.peakPlayerSpeed, candidate.peakRelativeSpeed, multiplier),
      };
    }

    if (dz < -35 || sample.now - candidate.enteredAt > 4.5) this.candidates.delete(sample.id);
    return null;
  }
}
