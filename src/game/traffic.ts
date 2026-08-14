import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { LANE_COUNT, LANE_OFFSETS, clamp, laneX, roadCenterY, roadHeading, seeded } from './world';
import { createLoftGeometry, createRoundLamp, createTailLightGlowTexture } from './vehicleMeshes';

type RapierModule = typeof RAPIER;

export type TrafficArchetype = 'compact' | 'coupe' | 'suv' | 'van' | 'pickup' | 'truck';

export interface TrafficVehicle {
  id: number;
  generation: number;
  group: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  archetype: TrafficArchetype;
  lane: number;
  targetLane: number;
  lanePosition: number;
  pendingLane: number;
  signalDirection: -1 | 0 | 1;
  signalTime: number;
  laneChangeActive: boolean;
  laneChangeFrom: number;
  laneChangeProgress: number;
  laneChangeDuration: number;
  z: number;
  speed: number;
  desiredSpeed: number;
  halfWidth: number;
  halfLength: number;
  collisionHalfWidth: number;
  collisionHalfLength: number;
  reaction: number;
  collisionCooldown: number;
  lastPlayerDz: number;
  passedPlayer: boolean;
  wheelMeshes: THREE.Mesh[];
  brakeLights: THREE.Mesh[];
  brakeGlows: THREE.Sprite[];
  headlightReflectionGlows: THREE.Sprite[];
  indicatorLights: THREE.Mesh[];
  indicatorGlows: THREE.Sprite[];
}

export interface TrafficCollision {
  vehicle: TrafficVehicle;
  severity: number;
  normalX: number;
  normalZ: number;
  scrape: boolean;
  correctionX?: number;
  correctionZ?: number;
}

export interface TrafficImpactSample {
  overlapX: number;
  overlapZ: number;
  relativeForwardSpeed: number;
  relativeLateralSpeed: number;
}

export function classifyTrafficImpact(sample: TrafficImpactSample): { scrape: boolean; severity: number } {
  const penetrationX = Math.max(0, sample.overlapX);
  const penetrationZ = Math.max(0, sample.overlapZ);
  const scrape = penetrationX <= penetrationZ;
  if (scrape) {
    return {
      scrape: true,
      severity: 3.5
        + Math.abs(sample.relativeLateralSpeed) * 2.2
        + Math.abs(sample.relativeForwardSpeed) * .105
        + penetrationX * 6,
    };
  }
  return {
    scrape: false,
    severity: 6
      + Math.abs(sample.relativeForwardSpeed) * 1.4
      + penetrationZ * 10,
  };
}

export function projectedCollisionFootprint(halfWidth: number, halfLength: number, yawDelta: number): { halfWidth: number; halfLength: number } {
  const cosine = Math.abs(Math.cos(yawDelta));
  const sine = Math.abs(Math.sin(yawDelta));
  return {
    halfWidth: cosine * halfWidth + sine * halfLength,
    halfLength: cosine * halfLength + sine * halfWidth,
  };
}

interface TrafficHeadlightRig {
  light: THREE.SpotLight;
  target: THREE.Object3D;
}

const ARCHETYPES: Record<TrafficArchetype, { width: number; length: number; height: number }> = {
  compact: { width: 1.72, length: 4.05, height: 1.42 },
  coupe: { width: 1.86, length: 4.42, height: 1.28 },
  suv: { width: 2.02, length: 4.86, height: 1.82 },
  van: { width: 2.04, length: 5.15, height: 2.18 },
  pickup: { width: 2.0, length: 5.34, height: 1.72 },
  truck: { width: 2.48, length: 8.8, height: 3.4 },
};

const COLORS = [0x27313a, 0x752431, 0x8a8d89, 0x171819, 0x31483d, 0x66562f, 0x3d3545, 0xc4c0b5];
// Keep ordinary traffic to the two low-roof bodies. The SUV and pickup shared
// the tall bonnet/cabin profile that read as a malformed sedan from the chase
// camera, so their slots now use the compact/coupe proportions instead.
export const TRAFFIC_SPAWN_ARCHETYPES = ['compact', 'compact', 'compact', 'compact', 'coupe', 'coupe'] as const;
export const TRAFFIC_HEADLIGHT_POOL_WIDTH = 25.2;
export const TRAFFIC_HEADLIGHT_POOL_LENGTH = 38;
export const TRAFFIC_SIGNAL_LEAD_TIME = 1.25;
export const PLAYER_HEADLIGHT_REFLECTION_START = 90;

export function playerHeadlightReflectionStrength(forwardGap: number, lateralOffset: number): number {
  if (forwardGap <= 0 || forwardGap >= PLAYER_HEADLIGHT_REFLECTION_START) return 0;
  const distance = 1 - clamp((forwardGap - 8) / (PLAYER_HEADLIGHT_REFLECTION_START - 8), 0, 1);
  const alignment = 1 - clamp((Math.abs(lateralOffset) - .55) / 2.35, 0, 1);
  return clamp(Math.pow(distance, .72) * alignment, 0, 1);
}

export function smoothLaneChange(progress: number): number {
  const t = clamp(progress, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function smoothLaneChangeRate(progress: number): number {
  const t = clamp(progress, 0, 1);
  return 30 * t * t * (t - 1) * (t - 1);
}

function createHeadlightPoolMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float forward = 1.0 - vUv.y;
        // The geometry is three times wider at full reach, while the reduced
        // near half-width preserves the original footprint at the headlights.
        float halfWidth = mix(0.0533, 0.50, smoothstep(0.0, 0.92, forward));
        float lateral = 1.0 - smoothstep(halfWidth * 0.22, halfWidth, abs(vUv.x - 0.5));
        float startFade = smoothstep(0.0, 0.10, forward);
        float distanceFade = 1.0 - smoothstep(0.46, 0.91, forward);
        float edgeFade = smoothstep(0.0, 0.085, vUv.x)
          * smoothstep(0.0, 0.085, 1.0 - vUv.x)
          * smoothstep(0.0, 0.075, vUv.y)
          * smoothstep(0.0, 0.075, 1.0 - vUv.y);
        float center = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
        float strength = lateral * startFade * distanceFade * edgeFade * (0.34 + center * 0.66);
        gl_FragColor = vec4(1.0, 0.91, 0.74, strength * 0.245);
      }
    `,
  });
}

export function initialTrafficPlacement(index: number, openingBuffer = 0): { lane: number; z: number } {
  if (openingBuffer > 0 && index < 4) {
    // Establishing-shot traffic: two staggered pairs frame the player from
    // the far outside lanes without occupying the three-lane driving corridor.
    const outerLaneTableau = [
      { lane: 0, z: 58 },
      { lane: LANE_COUNT - 1, z: 70 },
      { lane: 0, z: 118 },
      { lane: LANE_COUNT - 1, z: 132 },
    ];
    return outerLaneTableau[index];
  }
  const wave = Math.floor(index / 3);
  const slot = index % 3;
  return index < 45
    ? { lane: (wave * 2 + slot * 2) % LANE_COUNT, z: 74 + openingBuffer + wave * 46 + slot * 6.5 }
    : { lane: index % LANE_COUNT, z: 780 + openingBuffer + (index - 45) * 46 };
}

export function maximumOccupiedLanesInBand(
  placements: Array<{ lanePosition: number; z: number }>,
  band = 24,
): number {
  let maximum = 0;
  for (const anchor of placements) {
    const lanes = new Set(placements
      .filter((item) => Math.abs(item.z - anchor.z) < band)
      .map((item) => Math.round(item.lanePosition)));
    maximum = Math.max(maximum, lanes.size);
  }
  return maximum;
}

function createTrafficModel(
  archetype: TrafficArchetype,
  color: number,
  tailGlowTexture: THREE.Texture,
  indicatorGlowTexture: THREE.Texture,
  headlightReflectionTexture: THREE.Texture,
): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  brakeLights: THREE.Mesh[];
  brakeGlows: THREE.Sprite[];
  headlightReflectionGlows: THREE.Sprite[];
  indicatorLights: THREE.Mesh[];
  indicatorGlows: THREE.Sprite[];
} {
  const dims = ARCHETYPES[archetype];
  const group = new THREE.Group();
  group.name = `traffic-${archetype}`;
  const emissivePaint = new THREE.Color(color).multiplyScalar(.13);
  const paint = new THREE.MeshStandardMaterial({ color, emissive: emissivePaint, emissiveIntensity: .16, metalness: 0.58, roughness: 0.32, envMapIntensity: 1.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111314, emissive: 0x050505, emissiveIntensity: .18, metalness: 0.42, roughness: 0.22 });
  const halfWidth = dims.width / 2;
  const halfLength = dims.length / 2;

  if (archetype !== 'truck') {
    const lowerTop = archetype === 'van' || archetype === 'suv' ? .86 : archetype === 'pickup' ? .78 : .68;
    const body = new THREE.Mesh(createLoftGeometry([
      { z: -halfLength, bottomHalfWidth: halfWidth * .72, topHalfWidth: halfWidth * .79, bottomY: .29, topY: lowerTop * .82 },
      { z: -halfLength * .78, bottomHalfWidth: halfWidth, topHalfWidth: halfWidth * .95, bottomY: .26, topY: lowerTop },
      { z: halfLength * .68, bottomHalfWidth: halfWidth, topHalfWidth: halfWidth * .92, bottomY: .26, topY: lowerTop * .94 },
      { z: halfLength, bottomHalfWidth: halfWidth * .72, topHalfWidth: halfWidth * .69, bottomY: .31, topY: lowerTop * .73 },
    ]), paint);
    group.add(body);
  }

  if (archetype === 'pickup') {
    const cab = new THREE.Mesh(createLoftGeometry([
      { z: -.05, bottomHalfWidth: halfWidth * .83, topHalfWidth: halfWidth * .62, bottomY: .74, topY: 1.52 },
      { z: .54, bottomHalfWidth: halfWidth * .88, topHalfWidth: halfWidth * .68, bottomY: .75, topY: 1.62 },
      { z: 1.4, bottomHalfWidth: halfWidth * .78, topHalfWidth: halfWidth * .58, bottomY: .72, topY: 1.52 },
    ]), dark);
    group.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(dims.width * .82, .14, dims.length * .32), dark);
    bed.position.set(0, .75, -dims.length * .28);
    group.add(bed);
  } else if (archetype === 'truck') {
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(dims.width * .96, 2.55, dims.length * .68, 1, 1, 2), new THREE.MeshStandardMaterial({ color: 0x28323a, roughness: .58, metalness: .36 }));
    trailer.position.set(0, 1.72, -dims.length * .12);
    group.add(trailer);
    const cab = new THREE.Mesh(createLoftGeometry([
      { z: dims.length * .19, bottomHalfWidth: halfWidth, topHalfWidth: halfWidth, bottomY: .25, topY: 2.65 },
      { z: dims.length * .43, bottomHalfWidth: halfWidth, topHalfWidth: halfWidth * .9, bottomY: .25, topY: 2.45 },
      { z: dims.length * .5, bottomHalfWidth: halfWidth * .82, topHalfWidth: halfWidth * .78, bottomY: .34, topY: 1.82 },
    ]), paint);
    group.add(cab);
  } else {
    const tall = archetype === 'van' || archetype === 'suv';
    const coupe = archetype === 'coupe';
    const rearZ = -halfLength * (archetype === 'van' ? .72 : .48);
    const frontZ = halfLength * (archetype === 'van' ? .66 : .42);
    const roofY = dims.height * (tall ? .92 : coupe ? .9 : .94);
    const cabin = new THREE.Mesh(createLoftGeometry([
      { z: rearZ, bottomHalfWidth: halfWidth * .82, topHalfWidth: halfWidth * .65, bottomY: .68, topY: roofY * .82 },
      { z: rearZ + dims.length * .13, bottomHalfWidth: halfWidth * .86, topHalfWidth: halfWidth * .69, bottomY: .7, topY: roofY },
      { z: frontZ - dims.length * .13, bottomHalfWidth: halfWidth * .82, topHalfWidth: halfWidth * .66, bottomY: .68, topY: roofY * .98 },
      { z: frontZ, bottomHalfWidth: halfWidth * .68, topHalfWidth: halfWidth * .45, bottomY: .66, topY: tall ? roofY * .8 : .9 },
    ]), dark);
    group.add(cabin);
  }

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x050709, roughness: .62, metalness: .25 });
  const wheelRadius = archetype === 'truck' ? .46 : archetype === 'suv' || archetype === 'van' || archetype === 'pickup' ? .35 : .31;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, .18, 12);
  const rimGeometry = new THREE.CylinderGeometry(wheelRadius * .55, wheelRadius * .55, .105, 8);
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x657078, metalness: .85, roughness: .25 });
  const wheels: THREE.Mesh[] = [];
  const axleZ = dims.length * (archetype === 'truck' ? .3 : .31);
  for (const x of [-dims.width * .43, dims.width * .43]) {
    for (const z of [-axleZ, axleZ]) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, wheelRadius, z);
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      wheel.add(rim);
      wheels.push(wheel);
      group.add(wheel);
    }
  }
  const red = new THREE.MeshBasicMaterial({ color: 0xff3048, toneMapped: false });
  const brakeLights: THREE.Mesh[] = [];
  const brakeGlows: THREE.Sprite[] = [];
  for (const x of [-dims.width * .31, dims.width * .31]) {
    const light = archetype === 'coupe'
      ? createRoundLamp(.115, .065, red.clone())
      : new THREE.Mesh(new THREE.BoxGeometry(.34, .17, .065), red.clone());
    light.position.set(x, .63, -dims.length / 2 - .035);
    brakeLights.push(light);
    group.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tailGlowTexture,
      color: 0xff1838,
      transparent: true,
      opacity: .48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    glow.position.set(x, .63, -dims.length / 2 - .09);
    glow.scale.set(.62, .62, 1);
    glow.renderOrder = 4;
    brakeGlows.push(glow);
    group.add(glow);
  }
  const indicatorLights: THREE.Mesh[] = [];
  const indicatorGlows: THREE.Sprite[] = [];
  for (const x of [-dims.width * .43, dims.width * .43]) {
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(.13, .095, .07),
      new THREE.MeshBasicMaterial({ color: 0x241505, toneMapped: false }),
    );
    indicator.position.set(x, .61, -dims.length / 2 - .045);
    indicatorLights.push(indicator);
    group.add(indicator);
    const indicatorGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: indicatorGlowTexture,
      color: 0xffa528,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    indicatorGlow.position.set(x, .61, -dims.length / 2 - .1);
    indicatorGlow.scale.set(.42, .42, 1);
    indicatorGlow.renderOrder = 5;
    indicatorGlows.push(indicatorGlow);
    group.add(indicatorGlow);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.46, .19, .045), new THREE.MeshStandardMaterial({ color: 0x626966, roughness: .84, metalness: 0 }));
  plate.position.set(0, .48, -dims.length / 2 - .042);
  group.add(plate);
  const headlightReflectionGlows: THREE.Sprite[] = [];
  for (const x of [-dims.width * .24, dims.width * .24]) {
    const reflection = new THREE.Sprite(new THREE.SpriteMaterial({
      map: headlightReflectionTexture,
      color: 0xffe8c5,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    reflection.position.set(x, archetype === 'truck' ? 1.35 : .88, -dims.length / 2 - .065);
    const reflectionWidth = archetype === 'truck' ? 1.28 : .92;
    const reflectionHeight = archetype === 'truck' ? .84 : .58;
    reflection.scale.set(reflectionWidth, reflectionHeight, 1);
    reflection.userData.baseWidth = reflectionWidth;
    reflection.userData.baseHeight = reflectionHeight;
    reflection.renderOrder = 3;
    headlightReflectionGlows.push(reflection);
    group.add(reflection);
  }
  const headlamp = new THREE.MeshBasicMaterial({ color: 0xeee6d2, toneMapped: false });
  for (const x of [-dims.width * .3, dims.width * .3]) {
    const light = new THREE.Mesh(new THREE.PlaneGeometry(archetype === 'truck' ? .42 : .32, .13), headlamp);
    // Zero depth eliminates visible side faces while keeping the lens exactly
    // on the front fascia instead of suspended beyond the hood.
    light.position.set(x, archetype === 'truck' ? 1.05 : .59, dims.length / 2 + .002);
    group.add(light);
  }
  return { group, wheels, brakeLights, brakeGlows, headlightReflectionGlows, indicatorLights, indicatorGlows };
}

export class TrafficManager {
  readonly vehicles: TrafficVehicle[] = [];
  private spawnSerial = 0;
  private random = seeded(90317);
  private elapsed = 0;
  private readonly headlightRigs: TrafficHeadlightRig[] = [];
  private readonly headlightPools: THREE.InstancedMesh;
  density = 1;

  constructor(private scene: THREE.Scene, private physics: RAPIER.World, private rapier: RapierModule, count = 28) {
    const tailGlowTexture = createTailLightGlowTexture('#ff1739');
    const indicatorGlowTexture = createTailLightGlowTexture('#ffad2f');
    const headlightReflectionTexture = createTailLightGlowTexture('#ffe7bd');
    for (let i = 0; i < count; i += 1) {
      const roll = this.random();
      const archetype: TrafficArchetype = roll > .96
        ? 'truck'
        : TRAFFIC_SPAWN_ARCHETYPES[Math.floor(this.random() * TRAFFIC_SPAWN_ARCHETYPES.length)];
      const dims = ARCHETYPES[archetype];
      const collisionHalfWidth = dims.width * .45;
      const collisionHalfLength = dims.length * .46;
      const model = createTrafficModel(archetype, COLORS[Math.floor(this.random() * COLORS.length)], tailGlowTexture, indicatorGlowTexture, headlightReflectionTexture);
      model.group.visible = false;
      scene.add(model.group);
      const body = physics.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -20, -100));
      const collider = physics.createCollider(
        rapier.ColliderDesc.cuboid(collisionHalfWidth, dims.height * .46, collisionHalfLength)
          .setActiveCollisionTypes(rapier.ActiveCollisionTypes.KINEMATIC_KINEMATIC),
        body,
      );
      this.vehicles.push({
        id: i, generation: 0, group: model.group, body, collider, archetype,
        lane: i % LANE_COUNT, targetLane: i % LANE_COUNT, lanePosition: i % LANE_COUNT,
        pendingLane: i % LANE_COUNT, signalDirection: 0, signalTime: 0,
        laneChangeActive: false, laneChangeFrom: i % LANE_COUNT, laneChangeProgress: 0, laneChangeDuration: 2.3,
        z: -1000, speed: 0, desiredSpeed: 0,
        halfWidth: dims.width / 2, halfLength: dims.length / 2, reaction: this.random() * 4,
        collisionHalfWidth, collisionHalfLength,
        headlightReflectionGlows: model.headlightReflectionGlows,
        collisionCooldown: 0, lastPlayerDz: Number.POSITIVE_INFINITY, passedPlayer: false,
        wheelMeshes: model.wheels, brakeLights: model.brakeLights, brakeGlows: model.brakeGlows,
        indicatorLights: model.indicatorLights, indicatorGlows: model.indicatorGlows,
      });
    }
    const poolGeometry = new THREE.PlaneGeometry(1, 1);
    poolGeometry.rotateX(-Math.PI / 2);
    poolGeometry.translate(0, 0, .5);
    this.headlightPools = new THREE.InstancedMesh(poolGeometry, createHeadlightPoolMaterial(), count);
    this.headlightPools.name = 'traffic-headlight-pools';
    this.headlightPools.frustumCulled = false;
    this.headlightPools.renderOrder = -1;
    this.headlightPools.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.headlightPools);

    for (let index = 0; index < 6; index += 1) {
      const target = new THREE.Object3D();
      const light = new THREE.SpotLight(0xffefd2, 58, 62, .35, .96, 1.45);
      light.visible = false;
      light.target = target;
      light.castShadow = false;
      scene.add(light, target);
      this.headlightRigs.push({ light, target });
    }
  }

  vehicleForCollider(handle: number): TrafficVehicle | undefined {
    return this.vehicles.find((vehicle) => vehicle.collider.handle === handle);
  }

  getLightingTelemetry(): { projected: number; dynamic: number } {
    return {
      projected: this.headlightPools.count,
      dynamic: this.headlightRigs.filter((rig) => rig.light.visible).length,
    };
  }

  reset(playerZ: number, openingBuffer = 0): void {
    this.elapsed = 0;
    this.random = seeded(90317);
    this.spawnSerial = 0;
    for (const vehicle of this.vehicles) vehicle.group.visible = false;
    for (let i = 0; i < this.vehicles.length; i += 1) {
      const placement = initialTrafficPlacement(i, openingBuffer);
      const lane = placement.lane;
      const stagger = placement.z;
      this.spawn(this.vehicles[i], playerZ + stagger + this.random() * 18, lane);
      // Keep the four cinematic framing cars in their outside lanes until
      // after the camera has handed control to the player.
      if (openingBuffer > 0 && i < 4) this.vehicles[i].reaction = 8;
      this.vehicles[i].group.visible = i < Math.min(this.vehicles.length, Math.floor(36 * this.density));
    }
    this.updateHeadlights(playerZ);
  }

  private spawn(vehicle: TrafficVehicle, z: number, lane = Math.floor(this.random() * LANE_COUNT)): void {
    z = this.findNavigableSpawnZ(vehicle, z, lane);
    vehicle.generation += 1;
    vehicle.id = vehicle.generation * 1000 + this.spawnSerial++;
    vehicle.lane = lane;
    vehicle.targetLane = lane;
    vehicle.lanePosition = lane;
    vehicle.pendingLane = lane;
    vehicle.signalDirection = 0;
    vehicle.signalTime = 0;
    vehicle.laneChangeActive = false;
    vehicle.laneChangeFrom = lane;
    vehicle.laneChangeProgress = 0;
    vehicle.laneChangeDuration = 2.15 + this.random() * .45;
    vehicle.z = z;
    const largePenalty = vehicle.archetype === 'truck' ? 5.5 : vehicle.archetype === 'van' ? 2 : 0;
    // Keep enough speed variation for overtakes without letting waves of
    // traffic collapse into five-abreast walls after a few minutes. A tighter
    // 55-71 mph band also makes the intended ~100 mph player pace feel busy.
    vehicle.desiredSpeed = 24.5 + this.random() * 7.2 - largePenalty;
    vehicle.speed = vehicle.desiredSpeed * (.92 + this.random() * .08);
    vehicle.reaction = 2.5 + this.random() * 5;
    vehicle.collisionCooldown = 0;
    vehicle.lastPlayerDz = Number.POSITIVE_INFINITY;
    vehicle.passedPlayer = false;
    for (let indicatorIndex = 0; indicatorIndex < vehicle.indicatorLights.length; indicatorIndex += 1) {
      (vehicle.indicatorLights[indicatorIndex].material as THREE.MeshBasicMaterial).color.setHex(0x241505);
      (vehicle.indicatorGlows[indicatorIndex].material as THREE.SpriteMaterial).opacity = 0;
    }
    for (const reflection of vehicle.headlightReflectionGlows) {
      (reflection.material as THREE.SpriteMaterial).opacity = 0;
    }
    vehicle.group.visible = true;
    this.syncTransform(vehicle);
  }

  private findNavigableSpawnZ(vehicle: TrafficVehicle, requestedZ: number, lane: number): number {
    let z = requestedZ;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const nearby = this.vehicles.filter((other) => other !== vehicle && other.group.visible && Math.abs(other.z - z) < 30);
      const occupiedLanes = new Set(nearby.map((other) => Math.round(other.lanePosition)));
      const sameLaneTooClose = this.vehicles.some((other) => (
        other !== vehicle && other.group.visible
        && Math.round(other.lanePosition) === lane
        && Math.abs(other.z - z) < 50
      ));
      // Never create a five-wide wall: at least two of the five lanes remain
      // open inside every 48 m longitudinal band.
      if (!sameLaneTooClose && occupiedLanes.size < 3) return z;
      z += 27 + this.random() * 19;
    }
    return z;
  }

  update(dt: number, playerX: number, playerZ: number, playerYaw: number, playerVx: number, playerVz: number, playerHalfWidth: number, playerHalfLength: number): TrafficCollision[] {
    this.elapsed += dt;
    const difficulty = clamp(this.elapsed / 150, 0, 1);
    const activeCount = Math.floor(clamp((36 + difficulty * 10) * this.density, 24, this.vehicles.length));
    const collisions: TrafficCollision[] = [];

    for (let index = 0; index < this.vehicles.length; index += 1) {
      const vehicle = this.vehicles[index];
      vehicle.passedPlayer = false;
      vehicle.group.visible = index < activeCount;
      if (!vehicle.group.visible) {
        vehicle.body.setNextKinematicTranslation({ x: 0, y: -20, z: playerZ + 1000 });
        for (const reflection of vehicle.headlightReflectionGlows) {
          (reflection.material as THREE.SpriteMaterial).opacity = 0;
        }
        continue;
      }
      if (vehicle.z < playerZ - 150) this.spawn(vehicle, playerZ + 390 + this.random() * 360, Math.floor(this.random() * LANE_COUNT));

      vehicle.collisionCooldown = Math.max(0, vehicle.collisionCooldown - dt);
      vehicle.reaction -= dt;
      const front = this.closestInLane(vehicle, vehicle.targetLane, true);
      const gap = front ? front.z - vehicle.z - vehicle.halfLength - front.halfLength : 1000;
      const pace = gap < 28 ? Math.min(vehicle.desiredSpeed, front!.speed - (28 - gap) * .18) : vehicle.desiredSpeed;
      const oldSpeed = vehicle.speed;
      vehicle.speed += (pace - vehicle.speed) * Math.min(1, dt * (gap < 18 ? 2.2 : .35));
      vehicle.speed = clamp(vehicle.speed, 15, 37 + difficulty * 2);

      if (vehicle.reaction <= 0 && vehicle.lane === vehicle.targetLane && vehicle.signalDirection === 0 && !vehicle.laneChangeActive) {
        vehicle.reaction = 3.5 + this.random() * 7;
        if (gap < 42 || this.random() < .28) {
          const directions = this.random() > .5 ? [-1, 1] : [1, -1];
          for (const direction of directions) {
            const target = vehicle.lane + direction;
            if (target >= 0 && target < LANE_COUNT && this.laneIsSafe(vehicle, target)) {
              vehicle.pendingLane = target;
              vehicle.signalDirection = direction as -1 | 1;
              vehicle.signalTime = TRAFFIC_SIGNAL_LEAD_TIME;
              break;
            }
          }
        }
      }

      if (vehicle.signalDirection !== 0 && !vehicle.laneChangeActive) {
        vehicle.signalTime -= dt;
        if (vehicle.signalTime <= 0) {
          if (this.laneIsSafe(vehicle, vehicle.pendingLane)) {
            vehicle.targetLane = vehicle.pendingLane;
            vehicle.laneChangeFrom = vehicle.lanePosition;
            vehicle.laneChangeProgress = 0;
            vehicle.laneChangeActive = true;
          } else {
            vehicle.pendingLane = vehicle.lane;
            vehicle.signalDirection = 0;
            vehicle.reaction = 1.4 + this.random() * 2.2;
          }
        }
      }
      if (vehicle.laneChangeActive) {
        vehicle.laneChangeProgress = Math.min(1, vehicle.laneChangeProgress + dt / vehicle.laneChangeDuration);
        const eased = smoothLaneChange(vehicle.laneChangeProgress);
        vehicle.lanePosition = vehicle.laneChangeFrom + (vehicle.targetLane - vehicle.laneChangeFrom) * eased;
      }
      if (vehicle.laneChangeActive && vehicle.laneChangeProgress >= 1) {
        vehicle.lanePosition = vehicle.targetLane;
        vehicle.lane = vehicle.targetLane;
        vehicle.pendingLane = vehicle.targetLane;
        vehicle.laneChangeActive = false;
        vehicle.signalDirection = 0;
        vehicle.signalTime = 0;
      }
      vehicle.z += vehicle.speed * dt;
      const braking = oldSpeed - vehicle.speed > .08;
      for (const light of vehicle.brakeLights) (light.material as THREE.MeshBasicMaterial).color.setHex(braking ? 0xff183c : 0x8f0716);
      for (const glow of vehicle.brakeGlows) {
        (glow.material as THREE.SpriteMaterial).opacity = braking ? .94 : .48;
        const glowSize = braking ? 1.02 : .62;
        glow.scale.set(glowSize, glowSize, 1);
      }
      const indicatorOn = vehicle.signalDirection !== 0 && Math.floor((this.elapsed + vehicle.id * .017) * 2.6) % 2 === 0;
      for (let indicatorIndex = 0; indicatorIndex < vehicle.indicatorLights.length; indicatorIndex += 1) {
        const direction = indicatorIndex === 0 ? -1 : 1;
        const active = indicatorOn && vehicle.signalDirection === direction;
        (vehicle.indicatorLights[indicatorIndex].material as THREE.MeshBasicMaterial).color.setHex(active ? 0xffa21f : 0x241505);
        (vehicle.indicatorGlows[indicatorIndex].material as THREE.SpriteMaterial).opacity = active ? .76 : 0;
      }
      for (const wheel of vehicle.wheelMeshes) wheel.rotation.x -= vehicle.speed * dt / .31;
      this.syncTransform(vehicle);
      const playerForwardX = Math.sin(playerYaw);
      const playerForwardZ = Math.cos(playerYaw);
      const playerRightX = Math.cos(playerYaw);
      const playerRightZ = -Math.sin(playerYaw);
      const reflectionDx = vehicle.group.position.x - playerX;
      const reflectionDz = vehicle.z - playerZ;
      const reflectionStrength = playerHeadlightReflectionStrength(
        reflectionDx * playerForwardX + reflectionDz * playerForwardZ,
        reflectionDx * playerRightX + reflectionDz * playerRightZ,
      );
      for (const reflection of vehicle.headlightReflectionGlows) {
        (reflection.material as THREE.SpriteMaterial).opacity = reflectionStrength * .58;
        const baseWidth = Number(reflection.userData.baseWidth ?? .92);
        const baseHeight = Number(reflection.userData.baseHeight ?? .58);
        reflection.scale.set(
          baseWidth * (1 + reflectionStrength * .32),
          baseHeight * (1 + reflectionStrength * .25),
          1,
        );
      }
      const playerDz = vehicle.z - playerZ;
      vehicle.passedPlayer = vehicle.lastPlayerDz > 0 && playerDz <= 0;
      vehicle.lastPlayerDz = playerDz;

      const contactYaw = roadHeading((playerZ + vehicle.z) * .5);
      const rightX = Math.cos(contactYaw);
      const rightZ = -Math.sin(contactYaw);
      const forwardX = Math.sin(contactYaw);
      const forwardZ = Math.cos(contactYaw);
      const worldDx = playerX - vehicle.group.position.x;
      const worldDz = playerZ - vehicle.z;
      const lateralDelta = worldDx * rightX + worldDz * rightZ;
      const longitudinalDelta = worldDx * forwardX + worldDz * forwardZ;
      const playerFootprint = projectedCollisionFootprint(playerHalfWidth, playerHalfLength, playerYaw - contactYaw);
      const trafficFootprint = projectedCollisionFootprint(
        vehicle.collisionHalfWidth,
        vehicle.collisionHalfLength,
        vehicle.group.rotation.y - contactYaw,
      );
      const overlapX = playerFootprint.halfWidth + trafficFootprint.halfWidth - Math.abs(lateralDelta);
      const overlapZ = playerFootprint.halfLength + trafficFootprint.halfLength - Math.abs(longitudinalDelta);
      if (overlapX > 0 && overlapZ > 0 && vehicle.collisionCooldown <= 0) {
        const relativeForward = Math.hypot(playerVx, playerVz) - vehicle.speed;
        const playerLateral = playerVx * Math.cos(roadHeading(playerZ)) - playerVz * Math.sin(roadHeading(playerZ));
        const laneRate = vehicle.laneChangeActive
          ? (vehicle.targetLane - vehicle.laneChangeFrom) * smoothLaneChangeRate(vehicle.laneChangeProgress) / vehicle.laneChangeDuration
          : 0;
        const trafficLateral = laneRate * (LANE_OFFSETS[1] - LANE_OFFSETS[0]);
        const impact = classifyTrafficImpact({
          overlapX,
          overlapZ,
          relativeForwardSpeed: relativeForward,
          relativeLateralSpeed: playerLateral - trafficLateral,
        });
        const lateralSide = Math.sign(lateralDelta || (this.random() - .5));
        const longitudinalSide = Math.sign(longitudinalDelta || 1);
        // `normal` points from the player into the contacted vehicle, matching
        // applyCollisionImpulse's subtraction convention. Correction moves in
        // the exact opposite direction to prevent visible clipping.
        const normalX = impact.scrape ? -rightX * lateralSide : -forwardX * longitudinalSide;
        const normalZ = impact.scrape ? -rightZ * lateralSide : -forwardZ * longitudinalSide;
        const penetration = (impact.scrape ? overlapX : overlapZ) + .035;
        vehicle.collisionCooldown = .7;
        collisions.push({
          vehicle, severity: impact.severity, normalX, normalZ, scrape: impact.scrape,
          correctionX: -normalX * penetration,
          correctionZ: -normalZ * penetration,
        });
      }
    }
    this.updateHeadlights(playerZ);
    return collisions;
  }

  private updateHeadlights(playerZ: number): void {
    const candidates = this.vehicles
      .filter((vehicle) => vehicle.group.visible && vehicle.z > playerZ - 12 && vehicle.z < playerZ + 210)
      .sort((a, b) => Math.abs(a.z - playerZ) - Math.abs(b.z - playerZ));
    for (let index = 0; index < this.headlightRigs.length; index += 1) {
      const rig = this.headlightRigs[index];
      const vehicle = candidates[index];
      if (!vehicle) {
        rig.light.visible = false;
        continue;
      }
      const heading = vehicle.group.rotation.y;
      const forwardX = Math.sin(heading);
      const forwardZ = Math.cos(heading);
      rig.light.visible = true;
      rig.light.position.set(
        vehicle.group.position.x + forwardX * vehicle.halfLength * .92,
        vehicle.group.position.y + .58,
        vehicle.z + forwardZ * vehicle.halfLength * .92,
      );
      rig.target.position.set(
        rig.light.position.x + forwardX * 32,
        roadCenterY(vehicle.z + 32) - .18,
        rig.light.position.z + forwardZ * 32,
      );
    }

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(TRAFFIC_HEADLIGHT_POOL_WIDTH, 1, TRAFFIC_HEADLIGHT_POOL_LENGTH);
    let poolIndex = 0;
    for (const vehicle of this.vehicles) {
      if (!vehicle.group.visible) continue;
      const heading = vehicle.group.rotation.y;
      const forwardX = Math.sin(heading);
      const forwardZ = Math.cos(heading);
      const frontZ = vehicle.z + forwardZ * vehicle.halfLength;
      const frontX = vehicle.group.position.x + forwardX * vehicle.halfLength;
      const roadY = roadCenterY(frontZ);
      const farZ = frontZ + forwardZ * TRAFFIC_HEADLIGHT_POOL_LENGTH;
      const poolPitch = -Math.atan2(roadCenterY(farZ) - roadY, TRAFFIC_HEADLIGHT_POOL_LENGTH);
      position.set(frontX, roadY + .016, frontZ);
      quaternion.setFromEuler(new THREE.Euler(poolPitch, heading, 0, 'YXZ'));
      matrix.compose(position, quaternion, scale);
      this.headlightPools.setMatrixAt(poolIndex++, matrix);
    }
    this.headlightPools.count = poolIndex;
    this.headlightPools.instanceMatrix.needsUpdate = true;
  }

  private syncTransform(vehicle: TrafficVehicle): void {
    const laneOffset = LANE_OFFSETS[0] + vehicle.lanePosition * (LANE_OFFSETS[1] - LANE_OFFSETS[0]);
    const h = roadHeading(vehicle.z);
    const x = laneX(vehicle.z, Math.round(vehicle.lanePosition)) + Math.cos(h) * (laneOffset - LANE_OFFSETS[Math.round(vehicle.lanePosition)]);
    const y = roadCenterY(vehicle.z) + .05;
    const laneRate = vehicle.laneChangeActive
      ? (vehicle.targetLane - vehicle.laneChangeFrom) * smoothLaneChangeRate(vehicle.laneChangeProgress) / vehicle.laneChangeDuration
      : 0;
    const lateralSpeed = laneRate * (LANE_OFFSETS[1] - LANE_OFFSETS[0]);
    const lateralMotion = Math.atan2(lateralSpeed, Math.max(1, vehicle.speed)) * .62;
    vehicle.group.position.set(x, y, vehicle.z);
    vehicle.group.rotation.y = h + lateralMotion;
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, h + lateralMotion, 0));
    vehicle.body.setNextKinematicTranslation({ x, y: y + .8, z: vehicle.z });
    vehicle.body.setNextKinematicRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
  }

  private closestInLane(subject: TrafficVehicle, lane: number, ahead: boolean): TrafficVehicle | null {
    let result: TrafficVehicle | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const other of this.vehicles) {
      if (other === subject || !other.group.visible || Math.abs(other.lanePosition - lane) > .38) continue;
      const distance = other.z - subject.z;
      if ((ahead && distance <= 0) || (!ahead && distance >= 0)) continue;
      if (Math.abs(distance) < best) { best = Math.abs(distance); result = other; }
    }
    return result;
  }

  private laneIsSafe(vehicle: TrafficVehicle, targetLane: number): boolean {
    const occupiedFormationLanes = new Set(this.vehicles
      .filter((other) => other !== vehicle && other.group.visible && Math.abs(other.z - vehicle.z) < 25)
      .map((other) => Math.round(other.lanePosition)));
    // A lane change may tighten a formation, but it may never close the final
    // passing corridor. Natural traffic remains dense without scripted walls.
    if (occupiedFormationLanes.size >= 4 && !occupiedFormationLanes.has(targetLane)) return false;
    for (const other of this.vehicles) {
      if (other === vehicle || !other.group.visible || Math.abs(other.lanePosition - targetLane) > .42) continue;
      const dz = other.z - vehicle.z;
      if (dz > -18 && dz < 36) return false;
      if (dz < 0 && other.speed > vehicle.speed && dz > -28) return false;
    }
    for (const other of this.vehicles) {
      if (other === vehicle || !other.group.visible || other.signalDirection === 0) continue;
      if (other.pendingLane !== targetLane) continue;
      const dz = other.z - vehicle.z;
      if (dz > -20 && dz < 38) return false;
    }
    return true;
  }

  dispose(): void {
    for (const vehicle of this.vehicles) {
      this.scene.remove(vehicle.group);
      this.physics.removeRigidBody(vehicle.body);
    }
    for (const rig of this.headlightRigs) {
      this.scene.remove(rig.light, rig.target);
    }
    this.scene.remove(this.headlightPools);
    this.headlightPools.geometry.dispose();
    (this.headlightPools.material as THREE.Material).dispose();
  }
}
