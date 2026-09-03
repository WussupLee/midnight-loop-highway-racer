export const CAR_IDS = ['asterion-vxr', 'kitsune-r-spec'] as const;

export type CarId = typeof CAR_IDS[number];

export interface CarDefinition {
  id: CarId;
  name: string;
  classLabel: string;
  description: string;
}

export const CAR_DEFINITIONS: readonly CarDefinition[] = [
  {
    id: 'asterion-vxr',
    name: 'ASTERION VX-R',
    classLabel: 'ORIGINAL // STREET SPEC',
    description: 'Balanced aero · quad lamps · twin boost exhaust',
  },
  {
    id: 'kitsune-r-spec',
    name: 'KITSUNE R-SPEC',
    classLabel: 'IMPORT // NIGHT SPEC',
    description: 'Low coupe · wide stance · independent wheel rig',
  },
] as const;

export function isCarId(value: unknown): value is CarId {
  return typeof value === 'string' && (CAR_IDS as readonly string[]).includes(value);
}

export function carDefinition(id: CarId): CarDefinition {
  return CAR_DEFINITIONS.find((definition) => definition.id === id) ?? CAR_DEFINITIONS[0];
}

export function adjacentCar(id: CarId, direction: -1 | 1): CarId {
  const index = CAR_IDS.indexOf(id);
  return CAR_IDS[(index + direction + CAR_IDS.length) % CAR_IDS.length];
}
