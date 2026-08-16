import { digitalSteer, type DriverInput } from './vehicle';

export type MobileControlAction = 'left' | 'right' | 'throttle' | 'brake' | 'handbrake' | 'boost';
export type MobileControlMode = 'buttons' | 'tilt';

export interface MobileInputState {
  active: Set<MobileControlAction>;
}

export function createMobileInputState(): MobileInputState {
  return { active: new Set<MobileControlAction>() };
}

export function setMobileControl(state: MobileInputState, action: MobileControlAction, pressed: boolean): void {
  if (pressed) state.active.add(action);
  else state.active.delete(action);
}

export function resetMobileControls(state: MobileInputState): void {
  state.active.clear();
}

export function isBoostSwipe(startY: number, currentY: number, minimumTravel = 42): boolean {
  return startY - currentY >= minimumTravel;
}

export function steeringActionForPointerX(pointerX: number, regionLeft: number, regionWidth: number): 'left' | 'right' {
  return pointerX < regionLeft + regionWidth * .5 ? 'left' : 'right';
}

export function tiltGammaToDriverSteer(gamma: number, neutralGamma: number, deadZone = 2.5, fullTilt = 19): number {
  const delta = gamma - neutralGamma;
  const magnitude = Math.abs(delta);
  if (magnitude <= deadZone) return 0;
  const normalized = Math.min(1, (magnitude - deadZone) / Math.max(1, fullTilt - deadZone));
  // DeviceOrientation gamma is positive when the phone tilts right, while the
  // vehicle model uses negative steering for the visible right-hand direction.
  return -Math.sign(delta) * normalized;
}

export function mobileDriverInput(state: MobileInputState): DriverInput {
  return {
    throttle: state.active.has('throttle') ? 1 : 0,
    brake: state.active.has('brake') ? 1 : 0,
    steer: digitalSteer(state.active.has('left'), state.active.has('right')),
    handbrake: state.active.has('handbrake'),
    boost: state.active.has('boost'),
  };
}
