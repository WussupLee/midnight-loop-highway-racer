import { describe, expect, it } from 'vitest';
import { createMobileInputState, mobileDriverInput, resetMobileControls, setMobileControl } from '../src/game/mobileControls';

describe('mobile driving controls', () => {
  it('supports simultaneous steering, throttle, and boost', () => {
    const state = createMobileInputState();
    setMobileControl(state, 'left', true);
    setMobileControl(state, 'throttle', true);
    setMobileControl(state, 'boost', true);
    expect(mobileDriverInput(state)).toEqual({ throttle: 1, brake: 0, steer: 1, handbrake: false, boost: true });
  });

  it('keeps service brake and drift handbrake separate', () => {
    const state = createMobileInputState();
    setMobileControl(state, 'brake', true);
    expect(mobileDriverInput(state).brake).toBe(1);
    expect(mobileDriverInput(state).handbrake).toBe(false);
    setMobileControl(state, 'handbrake', true);
    expect(mobileDriverInput(state).handbrake).toBe(true);
  });

  it('cancels opposing steering and clears every held control', () => {
    const state = createMobileInputState();
    setMobileControl(state, 'left', true);
    setMobileControl(state, 'right', true);
    setMobileControl(state, 'throttle', true);
    expect(mobileDriverInput(state).steer).toBe(0);
    resetMobileControls(state);
    expect(mobileDriverInput(state)).toEqual({ throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false });
  });
});
