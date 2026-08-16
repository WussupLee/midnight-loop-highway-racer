import { digitalSteer, type DriverInput } from './vehicle';

export type MobileControlAction = 'left' | 'right' | 'throttle' | 'brake' | 'handbrake' | 'boost';

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

export function mobileDriverInput(state: MobileInputState): DriverInput {
  return {
    throttle: state.active.has('throttle') ? 1 : 0,
    brake: state.active.has('brake') ? 1 : 0,
    steer: digitalSteer(state.active.has('left'), state.active.has('right')),
    handbrake: state.active.has('handbrake'),
    boost: state.active.has('boost'),
  };
}
