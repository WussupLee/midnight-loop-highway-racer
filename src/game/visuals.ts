import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { VehicleState } from './vehicle';
import { roadCenterY } from './world';
import { createLoftGeometry, createSoftGlowTexture, createTailLightGlowTexture } from './vehicleMeshes';

export interface PlayerCarVisual {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  frontPivots: THREE.Group[];
  brakeLights: THREE.Mesh[];
  underglow: THREE.Mesh;
  headlights: THREE.SpotLight[];
  headlightTargets: THREE.Object3D[];
  update(state: VehicleState, braking: boolean, dt: number): void;
}

const paintMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x343a40,
  emissive: 0x0b0d10,
  emissiveIntensity: 0.22,
  metalness: 0.72,
  roughness: 0.24,
  clearcoat: 0.92,
  clearcoatRoughness: 0.16,
  envMapIntensity: 1.72,
});

function box(width: number, height: number, length: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const radius = Math.min(.1, width * .08, height * .22, length * .08);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, length, 3, radius), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createRoundedHoodGeometry(widthSegments = 10, lengthSegments = 12): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let zIndex = 0; zIndex <= lengthSegments; zIndex += 1) {
    const progress = zIndex / lengthSegments;
    const z = .64 + progress * 1.66;
    const halfWidth = .9 + (.67 - .9) * progress;
    const baseY = .825 + (.585 - .825) * progress;
    for (let xIndex = 0; xIndex <= widthSegments; xIndex += 1) {
      const normalizedX = xIndex / widthSegments * 2 - 1;
      const crown = (1 - normalizedX * normalizedX) * (.052 + (1 - progress) * .018);
      vertices.push(normalizedX * halfWidth, baseY + crown, z);
    }
  }
  const stride = widthSegments + 1;
  for (let zIndex = 0; zIndex < lengthSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex < widthSegments; xIndex += 1) {
      const a = zIndex * stride + xIndex;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createPlayerCar(scene: THREE.Scene): PlayerCarVisual {
  const group = new THREE.Group();
  group.name = 'Asterion VX-R player coupe';
  // A low, planted tuner footprint: just wider than the common traffic sedan,
  // but with a substantially lower coupe roof and tucked wheels.
  group.scale.set(.93, .88, .98);
  const dark = new THREE.MeshStandardMaterial({ color: 0x02070a, metalness: .62, roughness: .16 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x080b0d, metalness: .75, roughness: .28 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x111820, metalness: .28, roughness: .16, transmission: .08, opacity: .92, transparent: true, envMapIntensity: 1.45 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xaaa9a1, metalness: 1, roughness: .16 });

  group.add(box(1.94, .16, 4.56, carbon, 0, .25, -.03));
  const mainBody = new THREE.Mesh(createLoftGeometry([
    { z: -2.4, bottomHalfWidth: .82, topHalfWidth: .86, bottomY: .24, topY: .61 },
    { z: -2.12, bottomHalfWidth: 1.04, topHalfWidth: 1.0, bottomY: .22, topY: .76 },
    { z: -1.18, bottomHalfWidth: 1.08, topHalfWidth: 1.02, bottomY: .22, topY: .84 },
    { z: .72, bottomHalfWidth: 1.06, topHalfWidth: .96, bottomY: .23, topY: .82 },
    { z: 1.9, bottomHalfWidth: 1.0, topHalfWidth: .89, bottomY: .25, topY: .68 },
    { z: 2.35, bottomHalfWidth: .76, topHalfWidth: .69, bottomY: .3, topY: .56 },
  ]), paintMaterial);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  group.add(mainBody);
  const roundedHood = new THREE.Mesh(createRoundedHoodGeometry(), paintMaterial);
  roundedHood.name = 'rounded-player-hood';
  roundedHood.castShadow = true;
  roundedHood.receiveShadow = true;
  group.add(roundedHood);

  const cabin = new THREE.Mesh(createLoftGeometry([
    { z: -1.2, bottomHalfWidth: .83, topHalfWidth: .61, bottomY: .79, topY: 1.14 },
    { z: -.69, bottomHalfWidth: .85, topHalfWidth: .68, bottomY: .82, topY: 1.4 },
    { z: .28, bottomHalfWidth: .81, topHalfWidth: .65, bottomY: .82, topY: 1.42 },
    { z: .9, bottomHalfWidth: .7, topHalfWidth: .43, bottomY: .78, topY: .98 },
  ]), glass);
  cabin.castShadow = true;
  group.add(cabin);
  const roof = box(1.34, .05, .72, paintMaterial, 0, 1.405, -.16);
  group.add(roof);
  group.add(box(2.02, .07, .45, carbon, 0, .2, 2.08));
  group.add(box(1.92, .07, .36, carbon, 0, .19, -2.17));
  for (const x of [-1.01, 1.01]) group.add(box(.11, .14, 3.35, paintMaterial, x, .3, -.02));
  // Faceted side skirts and rear-quarter shoulders visually tuck the wheels
  // into the shell instead of leaving them beneath a rectangular body.
  for (const x of [-1.025, 1.025]) {
    group.add(box(.12, .14, 2.78, carbon, x, .2, .05));
    group.add(box(.19, .38, 1.02, paintMaterial, x * .97, .5, -1.25));
  }
  for (const x of [-.43, 0, .43]) group.add(box(.24, .025, .43, carbon, x, .875, 1.22));

  for (const x of [-.74, .74]) {
    const housing = box(.52, .2, .075, dark, x, .65, 2.29);
    housing.rotation.z = x < 0 ? -.07 : .07;
    group.add(housing);
  }

  const trunkDeck = box(1.94, .08, .72, paintMaterial, 0, .84, -1.72);
  const trunkLip = box(1.88, .065, .16, paintMaterial, 0, .86, -2.08);
  group.add(trunkDeck, trunkLip);
  // A short tapered bumper wraps into the rear quarters rather than reading as
  // a single vertical box. The lower edge narrows into a period-correct cutout.
  const rearBumper = new THREE.Mesh(createLoftGeometry([
    { z: -2.43, bottomHalfWidth: .82, topHalfWidth: .94, bottomY: .18, topY: .61 },
    { z: -2.24, bottomHalfWidth: 1.0, topHalfWidth: 1.04, bottomY: .17, topY: .69 },
    { z: -1.96, bottomHalfWidth: 1.04, topHalfWidth: 1.02, bottomY: .22, topY: .74 },
  ]), paintMaterial);
  rearBumper.castShadow = true;
  rearBumper.receiveShadow = true;
  group.add(rearBumper);
  const brakeLights: THREE.Mesh[] = [];
  const brakeGlows: THREE.Sprite[] = [];
  const tailGlowTexture = createTailLightGlowTexture('#ff1238');
  const lampLayout = [
    { x: -.66, radius: .145 }, { x: -.34, radius: .108 },
    { x: .34, radius: .108 }, { x: .66, radius: .145 },
  ];
  for (const { x, radius } of lampLayout) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(radius + .045, radius + .045, .07, 12), dark);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(x, .66, -2.405);
    group.add(housing);
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0x8d0b23,
      emissive: 0xff1238,
      emissiveIntensity: 1.45,
      metalness: .12,
      roughness: .28,
      toneMapped: true,
    });
    const lamp = new THREE.Mesh(new THREE.TorusGeometry(radius * .66, radius * .25, 6, 16), lensMaterial);
    lamp.position.set(x, .66, -2.455);
    lamp.renderOrder = 3;
    brakeLights.push(lamp);
    group.add(lamp);
    const center = new THREE.Mesh(
      new THREE.CircleGeometry(radius * .52, 12),
      new THREE.MeshStandardMaterial({ color: 0x26040b, emissive: 0x3b020b, emissiveIntensity: .42, roughness: .34 }),
    );
    center.position.set(x, .66, -2.459);
    center.rotation.y = Math.PI;
    group.add(center);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tailGlowTexture,
      color: 0xff173f,
      transparent: true,
      opacity: .34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    glow.position.set(x, .66, -2.485);
    const glowSize = radius * 2.8;
    glow.scale.set(glowSize, glowSize, 1);
    glow.userData.baseSize = glowSize;
    glow.renderOrder = 4;
    brakeGlows.push(glow);
    group.add(glow);
  }
  const plateSurround = box(.5, .21, .035, dark, 0, .4, -2.44);
  const plate = box(.32, .12, .028, new THREE.MeshStandardMaterial({ color: 0x363b3e, roughness: .82, metalness: 0 }), 0, .4, -2.465);
  group.add(plateSurround);
  group.add(plate);
  const lowerOpening = box(1.12, .15, .045, dark, 0, .2, -2.455);
  const diffuser = box(1.54, .07, .28, carbon, 0, .12, -2.29);
  group.add(lowerOpening, diffuser);

  const groundGlow = new THREE.PointLight(0x777cff, 1.2, 5.7, 2);
  groundGlow.position.set(0, .18, -.08);
  group.add(groundGlow);

  const wingDeck = box(1.92, .05, .23, carbon, 0, 1.245, -1.77);
  wingDeck.rotation.x = -.045;
  group.add(wingDeck);
  for (const x of [-.35, .35]) {
    const mount = box(.075, .35, .1, carbon, x, 1.065, -1.72);
    mount.rotation.x = .08;
    group.add(mount);
    group.add(box(.15, .05, .15, carbon, x, .89, -1.69));
  }
  for (const x of [-.98, .98]) {
    const endPlate = box(.04, .15, .265, carbon, x, 1.25, -1.77);
    endPlate.rotation.x = -.045;
    group.add(endPlate);
  }

  const boostFlames: THREE.Mesh[] = [];
  const boostFlameTrails: THREE.Mesh[] = [];
  const boostFlameGlows: THREE.Sprite[] = [];
  const boostFlameTexture = createSoftGlowTexture('#62ff9d');
  for (const x of [-.59, .59]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(.07, .095, .24, 12), chrome);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(x, .17, -2.47);
    group.add(exhaust);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(.13, .92, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xc0ffe2,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(x, .17, -2.88);
    flame.visible = false;
    group.add(flame);
    boostFlames.push(flame);
    const flameTrail = new THREE.Mesh(
      new THREE.PlaneGeometry(.3, 1.8),
      new THREE.MeshBasicMaterial({
        map: boostFlameTexture,
        color: 0x49ff8e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    flameTrail.rotation.x = -Math.PI / 2;
    flameTrail.position.set(x, .18, -3.21);
    flameTrail.visible = false;
    group.add(flameTrail);
    boostFlameTrails.push(flameTrail);
    const flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: boostFlameTexture,
      color: 0x8dffbc,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    flameGlow.position.set(x, .17, -2.58);
    flameGlow.scale.set(.5, .5, 1);
    flameGlow.visible = false;
    group.add(flameGlow);
    boostFlameGlows.push(flameGlow);
  }

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x020304, roughness: .5, metalness: .25 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x252b30, metalness: .9, roughness: .23, envMapIntensity: 1.35 });
  const tireGeometry = new THREE.CylinderGeometry(.39, .39, .205, 16);
  const rimGeometry = new THREE.CylinderGeometry(.265, .265, .125, 10);
  const wheels: THREE.Mesh[] = [];
  const frontPivots: THREE.Group[] = [];
  for (const z of [-1.48, 1.45]) {
    const track = z < 0 ? .92 : .88;
    for (const x of [-track, track]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, .39, z);
      const wheel = new THREE.Mesh(tireGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      wheel.add(rim);
      pivot.add(wheel);
      group.add(pivot);
      wheels.push(wheel);
      if (z > 0) frontPivots.push(pivot);
    }
  }

  const glowMaterial = new THREE.MeshBasicMaterial({ map: createSoftGlowTexture('#747bff'), color: 0xa19dff, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const underglow = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 5.8), glowMaterial);
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = .075;
  group.add(underglow);

  const headlights: THREE.SpotLight[] = [];
  const headlightTargets: THREE.Object3D[] = [];
  // The true spotlight is the only player headlight projection. Removing the
  // former additive road plane keeps its rectangular mesh from becoming
  // visible during the aerial intro and large handbrake yaw angles.
  const headlightTarget = new THREE.Object3D();
  headlightTarget.position.set(0, -1.7, 30);
  const headlight = new THREE.SpotLight(0xffedc8, 520, 68, .66, .995, 1.7);
  headlight.position.set(0, .66, 2.28);
  headlight.target = headlightTarget;
  headlight.castShadow = false;
  group.add(headlightTarget, headlight);
  headlights.push(headlight);
  headlightTargets.push(headlightTarget);

  scene.add(group);
  let visualRoll = 0;
  let visualPitch = 0;
  let boostFlamePhase = 0;
  return {
    group, wheels, frontPivots, brakeLights, underglow, headlights, headlightTargets,
    update(state, braking, dt) {
      const roadY = roadCenterY(state.z);
      group.position.set(state.x, roadY + .015, state.z);
      group.rotation.y = state.yaw;
      const targetRoll = -state.lateralSpeed * .013 - state.yawRate * .06;
      const targetPitch = clampVisual(-state.lastLongAccel * .009, -.045, .055);
      visualRoll += (targetRoll - visualRoll) * Math.min(1, dt * 6.5);
      visualPitch += (targetPitch - visualPitch) * Math.min(1, dt * 7.5);
      group.rotation.z = clampVisual(visualRoll, -.095, .095);
      group.rotation.x = visualPitch;
      for (const wheel of wheels) wheel.rotation.x -= state.longitudinalSpeed * dt / .39;
      for (const pivot of frontPivots) pivot.rotation.y = state.steerAngle;
      for (const light of brakeLights) {
        const material = light.material as THREE.MeshStandardMaterial;
        material.color.setHex(braking ? 0xff2747 : 0x8d0b23);
        material.emissiveIntensity = braking ? 5.6 : 1.8;
      }
      for (const glow of brakeGlows) {
        (glow.material as THREE.SpriteMaterial).opacity = braking ? .72 : .34;
        const baseSize = Number(glow.userData.baseSize ?? .38);
        const glowSize = baseSize * (braking ? 1.42 : 1);
        glow.scale.set(glowSize, glowSize, 1);
      }
      (underglow.material as THREE.MeshBasicMaterial).opacity = state.boostActive ? .64 : .5;
      boostFlamePhase += dt * (31 + state.rpm * .002);
      const flamePulse = .86 + Math.sin(boostFlamePhase) * .1 + Math.sin(boostFlamePhase * 1.73) * .04;
      for (let index = 0; index < boostFlames.length; index += 1) {
        const flame = boostFlames[index];
        const trail = boostFlameTrails[index];
        const glow = boostFlameGlows[index];
        flame.visible = state.boostActive;
        trail.visible = state.boostActive;
        glow.visible = state.boostActive;
        flame.scale.set(.82 + flamePulse * .18, .72 + flamePulse * .72, .82 + flamePulse * .18);
        trail.scale.set(.86 + flamePulse * .14, .74 + flamePulse * .42, 1);
        (flame.material as THREE.MeshBasicMaterial).opacity = state.boostActive ? .72 : 0;
        (trail.material as THREE.MeshBasicMaterial).opacity = state.boostActive ? .62 : 0;
        (glow.material as THREE.SpriteMaterial).opacity = state.boostActive ? .74 + flamePulse * .16 : 0;
      }
      for (const headlight of headlights) {
        headlight.visible = true;
        headlight.intensity = state.boostActive ? 600 : 520;
      }
    },
  };
}

function clampVisual(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type CameraMode = 'chase' | 'hood';
export const CHASE_FOV_BASE = 62;
export const CHASE_FOV_SPEED_GAIN = 18;
export interface CameraPose {
  position: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

function cubicPoint(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  t: number,
  target: THREE.Vector3,
): THREE.Vector3 {
  const inverse = 1 - t;
  return target.set(0, 0, 0)
    .addScaledVector(a, inverse * inverse * inverse)
    .addScaledVector(b, 3 * inverse * inverse * t)
    .addScaledVector(c, 3 * inverse * t * t)
    .addScaledVector(d, t * t * t);
}

export function cinematicEase(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return t * t * (3 - 2 * t);
}

export class RunIntroCamera {
  private readonly duration = 4.35;
  private elapsed = 0;
  private active = false;
  private readonly cameraPosition = new THREE.Vector3();
  private readonly cameraLook = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {}

  start(state: VehicleState, chasePose?: CameraPose): void {
    this.elapsed = 0;
    this.active = true;
    this.update(state, 0, chasePose);
  }

  cancel(): void {
    this.active = false;
  }

  getProgress(): number {
    return this.active ? Math.min(1, this.elapsed / this.duration) : 1;
  }

  update(state: VehicleState, dt: number, chasePose?: CameraPose): boolean {
    if (!this.active) return true;
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));
    const progress = this.elapsed / this.duration;
    const t = cinematicEase(progress);
    const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    const roadY = roadCenterY(state.z);
    const car = new THREE.Vector3(state.x, roadY, state.z);
    const point = (forwardDistance: number, rightDistance: number, height: number): THREE.Vector3 => car.clone()
      .addScaledVector(forward, forwardDistance)
      .addScaledVector(right, rightDistance)
      .add(new THREE.Vector3(0, height, 0));

    // The complete aerial path stays over the highway centerline. Earlier
    // lateral control points could intersect a randomly generated building.
    const start = point(-67, 0, 70);
    const sweep = point(-39, 0, 44);
    const descend = point(-12, 2.2, 12);
    const chase = chasePose?.position ?? point(-4.35, 0, 2.32);
    cubicPoint(start, sweep, descend, chase, t, this.cameraPosition);

    const skylineLook = point(170, 0, 34);
    const highwayLook = point(82, 0, 12);
    const carLook = point(27, 0, 3.2);
    const chaseLook = chasePose?.look ?? point(12.5, 0, .76);
    cubicPoint(skylineLook, highwayLook, carLook, chaseLook, t, this.cameraLook);

    const chaseFov = chasePose?.fov ?? this.camera.fov;
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraLook);
    this.camera.fov = 54 + (chaseFov - 54) * cinematicEase(Math.max(0, (progress - .28) / .72));
    this.camera.updateProjectionMatrix();
    if (progress >= 1) this.active = false;
    return !this.active;
  }
}

export class ChaseCamera {
  private position = new THREE.Vector3();
  private look = new THREE.Vector3();
  private initialized = false;
  private shake = 0;
  private phase = 0;
  private mode: CameraMode = 'chase';
  private speedShake = 0;
  private followDistance = 0;
  private portraitLayout = false;

  constructor(private camera: THREE.PerspectiveCamera) {}

  getMode(): CameraMode { return this.mode; }
  setPortraitLayout(enabled: boolean): void { this.portraitLayout = enabled; }
  getPose(): CameraPose {
    return { position: this.position.clone(), look: this.look.clone(), fov: this.camera.fov };
  }
  getTelemetry(): { fov: number; speedShake: number; followDistance: number } {
    return { fov: this.camera.fov, speedShake: this.speedShake, followDistance: this.followDistance };
  }

  toggle(state: VehicleState): CameraMode {
    this.mode = this.mode === 'chase' ? 'hood' : 'chase';
    this.reset(state);
    return this.mode;
  }

  reset(state: VehicleState): void {
    const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    if (this.mode === 'hood') {
      this.position.set(state.x, roadCenterY(state.z) + 1.12, state.z).addScaledVector(forward, 1.1);
      this.look.set(state.x, roadCenterY(state.z) + .97, state.z).addScaledVector(forward, 29);
    } else {
      const distance = this.portraitLayout ? -4.45 : -4.35;
      const height = this.portraitLayout ? 2.43 : 2.34;
      this.position.set(state.x, roadCenterY(state.z) + height, state.z).addScaledVector(forward, distance);
      this.look.set(state.x, roadCenterY(state.z) + .78, state.z).addScaledVector(forward, 12);
    }
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.look);
    this.followDistance = Math.hypot(this.position.x - state.x, this.position.z - state.z);
    this.initialized = true;
    this.shake = 0;
  }

  hit(amount: number): void {
    this.shake = Math.max(this.shake, Math.min(1.7, amount));
  }

  update(state: VehicleState, dt: number): void {
    if (!this.initialized) this.reset(state);
    const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    const speedMph = state.speedMph;
    const highSpeed = Math.min(1, Math.max(0, (speedMph - 92) / 88));
    const fovSpeed = Math.pow(Math.min(1, Math.max(0, (speedMph - 82) / 98)), 1.7);
    const accelerationPullback = Math.min(.55, Math.max(-.24, state.lastLongAccel * .055));
    const desired = this.mode === 'hood'
      ? new THREE.Vector3(state.x, roadCenterY(state.z) + 1.12, state.z).addScaledVector(forward, 1.1)
      : new THREE.Vector3(state.x, roadCenterY(state.z) + (this.portraitLayout ? 2.41 : 2.32) + highSpeed * .14, state.z)
        .addScaledVector(forward, (this.portraitLayout ? -4.45 : -4.35) - accelerationPullback * .4)
        .addScaledVector(right, -state.steering * .055);
    const lookDesired = new THREE.Vector3(state.x, roadCenterY(state.z) + (this.mode === 'hood' ? .97 : .76), state.z)
      .addScaledVector(forward, this.mode === 'hood' ? 29 : 12.5 + highSpeed * 3.4)
      .addScaledVector(right, state.steering * (this.mode === 'hood' ? .58 : .62 + highSpeed * .28));
    const positionDamp = 1 - Math.exp(-dt * 8.2);
    const lookDamp = 1 - Math.exp(-dt * (this.mode === 'hood' ? 18 : 6.2));
    // A spring-smoothed hood mount falls several metres behind a 170 mph car
    // and exposes the car's own light geometry. Keep the physical mount locked
    // to the hood; only the look target and subtle vibration remain smoothed.
    if (this.mode === 'hood') this.position.copy(desired);
    else this.position.lerp(desired, positionDamp);
    this.look.lerp(lookDesired, lookDamp);
    this.phase += dt * (11 + state.speedMps * .13);
    const highSpeedVibration = highSpeed * highSpeed * (this.mode === 'hood' ? .066 : .068);
    this.speedShake = highSpeedVibration;
    this.shake = Math.max(0, this.shake - dt * 2.8);
    const impact = this.shake * this.shake * .22;
    this.camera.position.copy(this.position);
    this.camera.position.x += Math.sin(this.phase * 1.7) * (highSpeedVibration + impact);
    this.camera.position.y += Math.sin(this.phase * 2.31) * (highSpeedVibration * .55 + impact * .6);
    this.camera.position.z += Math.cos(this.phase * 1.3) * impact * .35;
    this.camera.lookAt(this.look);
    const targetFov = (this.portraitLayout ? 68 : CHASE_FOV_BASE)
      + fovSpeed * (this.portraitLayout ? 12 : CHASE_FOV_SPEED_GAIN)
      + (state.boostActive ? 1.2 : 0) - Math.min(1.6, state.brake * 1.6);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 2.25);
    this.camera.updateProjectionMatrix();
  }
}

export class SpeedStreaks {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private random = 7182;

  constructor(scene: THREE.Scene, count = 150) {
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) this.resetPoint(i, true);
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xded8c6, size: .038, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  private rand(): number {
    this.random = this.random * 16807 % 2147483647;
    return (this.random - 1) / 2147483646;
  }

  private resetPoint(index: number, initial = false): void {
    this.positions[index * 3] = (this.rand() - .5) * 18;
    this.positions[index * 3 + 1] = .4 + this.rand() * 7;
    this.positions[index * 3 + 2] = initial ? (this.rand() - .25) * 80 : 44 + this.rand() * 22;
  }

  update(state: VehicleState, dt: number): void {
    this.points.position.set(state.x, roadCenterY(state.z), state.z);
    this.points.rotation.y = state.yaw;
    const intensity = Math.max(0, (state.speedMps - 48) / 28) + (state.boostActive ? .75 : 0);
    (this.points.material as THREE.PointsMaterial).opacity = Math.min(.28, intensity * .14);
    for (let i = 0; i < this.positions.length / 3; i += 1) {
      this.positions[i * 3 + 2] -= state.speedMps * dt * (1.2 + this.rand() * .2);
      if (this.positions[i * 3 + 2] < -15) this.resetPoint(i);
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
