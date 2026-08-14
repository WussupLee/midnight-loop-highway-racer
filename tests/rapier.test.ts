import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(async () => {
    await RAPIER.init();
});

describe('Rapier collision support', () => {
  it('reports a player/traffic contact pair and clears it after separation', () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const playerBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, .6, 0));
    const trafficBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, .8, 2.5));
    const player = world.createCollider(
      RAPIER.ColliderDesc.cuboid(.97, .56, 2.22)
        .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC),
      playerBody,
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(.92, .72, 2.25)
        .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC),
      trafficBody,
    );

    world.step();
    let contacts = 0;
    world.contactPairsWith(player, (other) => {
      let penetrating = false;
      world.contactPair(player, other, (manifold) => {
        for (let index = 0; index < manifold.numContacts(); index += 1) {
          if (manifold.contactDist(index) <= 0) penetrating = true;
        }
      });
      if (penetrating) contacts += 1;
    });
    expect(contacts).toBe(1);

    trafficBody.setTranslation({ x: 0, y: .8, z: 12 }, true);
    world.step();
    contacts = 0;
    world.contactPairsWith(player, (other) => {
      let penetrating = false;
      world.contactPair(player, other, (manifold) => {
        for (let index = 0; index < manifold.numContacts(); index += 1) {
          if (manifold.contactDist(index) <= 0) penetrating = true;
        }
      });
      if (penetrating) contacts += 1;
    });
    expect(contacts).toBe(0);
    world.free();
  });
});
