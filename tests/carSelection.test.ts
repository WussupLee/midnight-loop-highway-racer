import { describe, expect, it } from 'vitest';
import { CAR_DEFINITIONS, adjacentCar, carDefinition, isCarId } from '../src/game/carSelection';

describe('car selection catalog', () => {
  it('contains two unique selectable cars', () => {
    expect(CAR_DEFINITIONS).toHaveLength(2);
    expect(new Set(CAR_DEFINITIONS.map((car) => car.id)).size).toBe(2);
  });

  it('wraps selection in either direction', () => {
    expect(adjacentCar('asterion-vxr', 1)).toBe('kitsune-r-spec');
    expect(adjacentCar('kitsune-r-spec', 1)).toBe('asterion-vxr');
    expect(adjacentCar('asterion-vxr', -1)).toBe('kitsune-r-spec');
  });

  it('validates stored ids and resolves their display data', () => {
    expect(isCarId('kitsune-r-spec')).toBe(true);
    expect(isCarId('unknown')).toBe(false);
    expect(carDefinition('kitsune-r-spec').name).toBe('KITSUNE R-SPEC');
  });
});
