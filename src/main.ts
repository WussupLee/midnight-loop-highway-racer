import './style.css';
import { dialMarkup, dialAngle, dampNeedle, SPEED_DIAL, RPM_DIAL } from './game/instruments';
import { ScoreLedger, type ScoreSource } from './game/scoreLedger';
import { carContact } from './game/contact';
import { HANDLING } from './game/vehicle';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GameAudio, isEngineOption, type EngineOption } from './game/audio';
import { CAR_DEFINITIONS, adjacentCar, carDefinition, isCarId, type CarId } from './game/carSelection';
import { createMobileInputState, isBoostSwipe, mobileDriverInput, resetMobileControls, setMobileControl, steeringActionForPointerX, tiltGammaToDriverSteer, type MobileControlAction, type MobileControlMode } from './game/mobileControls';
import { createDriftState, updateDrift, type DriftState } from './game/drift';
import { PASS_CONFIG, NearMissTracker, addToCombo, breakCombo, calculateHighSpeedScore, createCombo, isThreadNeedlePair, speedRiskMultiplier, tickCombo, type ComboState, type NearMissEvent } from './game/scoring';
import { TrafficManager, projectedCollisionFootprint, maximumOccupiedLanesInBand, type TrafficCollision, type TrafficVehicle } from './game/traffic';
import { PLAYER_COLLISION_HALF_LENGTH, PLAYER_COLLISION_HALF_WIDTH, applyCollisionImpulse, createVehicleState, digitalSteer, recoverVehicle, stepVehicle, type DriverInput, type VehicleState } from './game/vehicle';
import { ChaseCamera, RunIntroCamera, SpeedStreaks, createKitsuneCar, createPlayerCar, type PlayerCarVisual } from './game/visuals';
import { HighwayWorld, LANE_OFFSETS, LANE_WIDTH, configureRoadRoute, laneX, roadCenterX, roadCenterY, roadHeading, tunnelAcousticAmount } from './game/world';

type GameMode = 'menu' | 'intro' | 'running' | 'paused' | 'crashing' | 'gameover';
type ScenarioName = 'normal-pass' | 'near-miss' | 'distant-pass' | 'duplicate' | 'collision' | 'scrape' | 'thread-needle';

interface RunStats {
  score: number;
  nearMisses: number;
  driftPoints: number;
  topSpeed: number;
  elapsed: number;
}

interface DebugSnapshot {
  mode: GameMode;
  selectedCar: CarId;
  player: Record<string, number | boolean>;
  score: number;
  highScore: number;
  combo: ComboState;
  nearbyTraffic: Array<Record<string, number | string | boolean>>;
  nearMissCandidates: number;
  maxFormation: number;
  roadCoverage: boolean;
  roadStartZ: number;
  roadEndZ: number;
  trafficHeadlightPools: number;
  trafficDynamicHeadlights: number;
  impactKind: string;
  impactSeverity: number;
  fps: number;
  objects: number;
  drawCalls: number;
}

declare global {
  interface Window {
    __GAME_DEBUG__?: {
      getState: () => DebugSnapshot;
      startRun: () => void;
      setScenario: (name: ScenarioName) => void;
      forceCrash: () => void;
      addBoost: (amount?: number) => void;
      toggleCamera: () => string;
      selectCar: (id: CarId) => void;
      getMusicState: () => { loaded: boolean; playing: boolean; muted: boolean; currentTime: number };
    };
  }
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing UI element #${id}`);
  return found as T;
}

const canvas = element<HTMLCanvasElement>('game');
const loading = element('loading');
const menu = element('menu');
const hud = element('hud');
const pauseScreen = element('pause');
const gameoverScreen = element('gameover');
const debugPanel = element('debug-panel');
const debugReadout = element<HTMLPreElement>('debug-readout');
const muteIndicator = element('mute-indicator');
const startButton = element<HTMLButtonElement>('start-button');
const previousCarButton = element<HTMLButtonElement>('previous-car');
const nextCarButton = element<HTMLButtonElement>('next-car');
const carDragSurface = element('car-drag-surface');
const carCounterText = element('car-counter');
const carNameText = element('car-name');
const carClassText = element('car-class');
const carDescriptionText = element('car-description');
const resumeButton = element<HTMLButtonElement>('resume-button');
const restartPauseButton = element<HTMLButtonElement>('restart-pause-button');
const quitButton = element<HTMLButtonElement>('quit-button');
const restartButton = element<HTMLButtonElement>('restart-button');
const gameoverQuitButton = element<HTMLButtonElement>('gameover-quit-button');
const scoreText = element('score');
const highScoreText = element('high-score');
const menuHighScoreText = element('menu-high-score');
const comboWrap = element('combo-wrap');
const comboText = element('combo');
const comboTimer = element('combo-timer');
const speedText = element('speed');
const gearText = element('gear');
element('rpm-face').innerHTML = dialMarkup(RPM_DIAL, 'tach-needle');
element('speed-face').innerHTML = dialMarkup(SPEED_DIAL, 'speed-needle');
const tachNeedle = element('tach-needle');
const speedNeedle = element('speed-needle');
const rpmValueText = element('rpm-value');
const boostFill = element('boost-fill');
const boostVignette = element('boost-vignette');
const damageFlash = element('damage-flash');
const crashBlackout = element('crash-blackout');
const callout = element('callout');
const finalScoreText = element('final-score');
const finalComboText = element('final-combo');
const finalSpeedText = element('final-speed');
const finalMissesText = element('final-misses');
const renderScaleSelect = element<HTMLSelectElement>('render-scale');
const trafficSelect = element<HTMLSelectElement>('traffic-setting');
const engineSoundSelect = element<HTMLSelectElement>('engine-sound');
const pauseEngineSoundSelect = element<HTMLSelectElement>('pause-engine-sound');
const bloomCheckbox = element<HTMLInputElement>('bloom-setting');
const ditherCheckbox = element<HTMLInputElement>('dither-setting');
const mobileControlModeSelect = element<HTMLSelectElement>('mobile-control-mode');
const mobileControls = element<HTMLElement>('mobile-controls');
const mobilePauseButton = element<HTMLButtonElement>('mobile-pause');
const mobileCameraButton = element<HTMLButtonElement>('mobile-camera');
const mobileRecoverButton = element<HTMLButtonElement>('mobile-recover');
const mobileCalibrateButton = element<HTMLButtonElement>('mobile-calibrate');
const TOUCH_CAPABLE = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const MOBILE_DEVICE = TOUCH_CAPABLE && Math.min(screen.width, screen.height) < 900;
document.documentElement.classList.toggle('touch-capable', TOUCH_CAPABLE);
document.documentElement.classList.toggle('heavy-dither', ditherCheckbox.checked);

function formatScore(value: number): string {
  return Math.max(0, Math.round(value)).toString().padStart(6, '0').replace(/(\d)(?=(\d{3})+$)/g, '$1 ');
}

function safeHighScore(): number {
  try { return Number.parseInt(localStorage.getItem('midnight-loop-v2-high-score') ?? '0', 10) || 0; }
  catch { return 0; }
}

let highScore = safeHighScore();
menuHighScoreText.textContent = formatScore(highScore);
try {
  const legacy = Number(localStorage.getItem('midnight-loop-high-score') ?? localStorage.getItem('nitro-veil-high-score') ?? 0);
  element('legacy-record').textContent = legacy > 0 ? `LEGACY RECORD  ${formatScore(legacy)}` : '';
} catch { /* Records remain playable without storage. */ }
highScoreText.textContent = formatScore(highScore);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE_DEVICE, powerPreference: 'high-performance', alpha: false });
renderer.setSize(innerWidth, innerHeight, false);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.105;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050504);
scene.fog = new THREE.FogExp2(0x16130f, 0.0061);
const environmentGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = environmentGenerator.fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .109;
environmentGenerator.dispose();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .08, 1700);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .42, .58, .955);
composer.addPass(bloomPass);
const cameraResolution = new THREE.Vector2();
renderer.getDrawingBufferSize(cameraResolution);
const cameraPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: cameraResolution },
    uSpeed: { value: 0 },
    uImpact: { value: 0 },
    uHeavyDither: { value: 1 },
    starburstIntensity: { value: .34 },
    starburstThreshold: { value: .972 },
    starburstLength: { value: .5 },
    starburstRotation: { value: Math.PI / 4 },
    starburstChromaticSpread: { value: .022 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uSpeed;
    uniform float uImpact;
    uniform float uHeavyDither;
    uniform float starburstIntensity;
    uniform float starburstThreshold;
    uniform float starburstLength;
    uniform float starburstRotation;
    uniform float starburstChromaticSpread;
    varying vec2 vUv;

    float luminanceOf(vec3 value) {
      return dot(value, vec3(0.2126, 0.7152, 0.0722));
    }
    vec3 sourceAt(vec2 uv) {
      return texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
    }
    vec3 highlightAt(vec2 uv) {
      vec3 source = sourceAt(uv);
      float mask = smoothstep(starburstThreshold, 1.22, luminanceOf(source));
      return source * mask;
    }
    vec3 starAxis(vec2 uv, vec2 direction, float reach) {
      vec3 flare = vec3(0.0);
      for (int index = 1; index <= 4; index++) {
        float stepDistance = float(index * index) * reach;
        float weight = (5.0 - float(index)) / 10.0;
        flare += highlightAt(uv + direction * stepDistance) * weight;
        flare += highlightAt(uv - direction * stepDistance) * weight;
      }
      return flare;
    }
    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float bayer4(vec2 pixelPosition) {
      vec2 cell = mod(floor(pixelPosition), 4.0);
      if (cell.y < 1.0) {
        if (cell.x < 1.0) return 0.0 / 16.0;
        if (cell.x < 2.0) return 8.0 / 16.0;
        if (cell.x < 3.0) return 2.0 / 16.0;
        return 10.0 / 16.0;
      }
      if (cell.y < 2.0) {
        if (cell.x < 1.0) return 12.0 / 16.0;
        if (cell.x < 2.0) return 4.0 / 16.0;
        if (cell.x < 3.0) return 14.0 / 16.0;
        return 6.0 / 16.0;
      }
      if (cell.y < 3.0) {
        if (cell.x < 1.0) return 3.0 / 16.0;
        if (cell.x < 2.0) return 11.0 / 16.0;
        if (cell.x < 3.0) return 1.0 / 16.0;
        return 9.0 / 16.0;
      }
      if (cell.x < 1.0) return 15.0 / 16.0;
      if (cell.x < 2.0) return 7.0 / 16.0;
      if (cell.x < 3.0) return 13.0 / 16.0;
      return 5.0 / 16.0;
    }
    void main() {
      vec2 centered = vUv - 0.5;
      float radial = length(centered) / 0.7071;
      vec2 sampleUv = clamp(vUv, 0.001, 0.999);
      vec2 pixel = 1.0 / max(uResolution, vec2(1.0));
      vec2 radialDirection = normalize(centered + vec2(0.00001));
      vec3 base = sourceAt(sampleUv);
      float baseLuma = luminanceOf(base);

      // Consumer-video motion persistence: a tiny vertical smear that grows
      // with speed without turning lights into modern anamorphic streaks.
      vec3 smear = sourceAt(sampleUv - vec2(0.0, pixel.y * (1.2 + uSpeed * 3.2)));
      base = mix(base, smear, .008 + uSpeed * .018);

      // Keep luminance readable while softening/quantizing chroma detail.
      vec3 colorSoft = (sourceAt(sampleUv + pixel * vec2(.7, .25)) + sourceAt(sampleUv - pixel * vec2(.7, .25))) * .5;
      float softLuma = luminanceOf(colorSoft);
      vec3 chroma = (colorSoft - vec3(softLuma)) * .94;
      chroma = floor(chroma * 160.0 + .5) / 160.0;
      vec3 color = vec3(baseLuma) + chroma;

      // Restrained edge/highlight RGB misregistration, with a short impact
      // excursion. The center stays effectively registered.
      float highlightMask = smoothstep(.72, 1.0, baseLuma);
      float aberrationMask = smoothstep(.28, 1.0, radial) * .65 + highlightMask * .35;
      float aberrationPx = .45 + radial * .8 + uSpeed * .55 + uImpact * 1.4;
      vec2 chromaOffset = radialDirection * pixel * aberrationPx;
      vec3 separated = vec3(sourceAt(sampleUv + chromaOffset).r, color.g, sourceAt(sampleUv - chromaOffset).b);
      color = mix(color, separated, aberrationMask * .16);

      // Thresholded cross-screen diffraction: long diagonal axes plus much
      // shorter horizontal/vertical rays for an inexpensive optical filter.
      vec2 diagonalA = vec2(cos(starburstRotation), sin(starburstRotation)) * pixel;
      vec2 diagonalB = vec2(-sin(starburstRotation), cos(starburstRotation)) * pixel;
      float reach = 2.4 + starburstLength * 2.8;
      vec3 longStar = starAxis(sampleUv, diagonalA, reach) + starAxis(sampleUv, diagonalB, reach);
      vec3 shortStar = starAxis(sampleUv, vec2(pixel.x, 0.0), reach * .34) + starAxis(sampleUv, vec2(0.0, pixel.y), reach * .34);
      vec3 star = longStar + shortStar * .24;
      float starLuma = luminanceOf(star);
      vec3 starCore = mix(star, vec3(starLuma * 1.08, starLuma * 1.04, starLuma * .9), .62);
      vec3 starFringe = vec3(star.r * (1.0 + starburstChromaticSpread), star.g, star.b * (1.0 + starburstChromaticSpread * .7));
      color += mix(starCore, starFringe, .18) * starburstIntensity;

      // Dirty MiniDV night balance: restrained saturation, green/yellow
      // midtones, deep green-black shadows, and clipped warm-white sources.
      float luma = luminanceOf(color);
      color = mix(vec3(luma), color, .94);
      float midtone = smoothstep(.08, .32, luma) * (1.0 - smoothstep(.58, .9, luma));
      color += vec3(.009, .031, -.015) * midtone;
      color *= vec3(1.0, 1.022, .972);
      color = (color - .14) * 1.12 + .14;
      color = max(color - vec3(.007, .004, .008), 0.0);
      color = pow(color, vec3(1.025));
      float clipped = smoothstep(.91, 1.08, luminanceOf(color));
      color = mix(color, vec3(1.0, .985, .86), clipped * .28);

      // Fine, animated CCD/CMOS noise: strongest in shadows, almost absent
      // in clipped highlights. No VHS lines, blocks, or colored flecks.
      float shadowNoise = mix(.028, .006, smoothstep(.04, .82, luminanceOf(color)));
      vec2 noiseSeed = gl_FragCoord.xy + floor(uTime * 30.0) * vec2(37.0, 17.0);
      float luminanceNoise = hash21(noiseSeed) - .5;
      vec3 colorNoise = vec3(
        hash21(noiseSeed + 19.7) - .5,
        hash21(noiseSeed + 47.3) - .5,
        hash21(noiseSeed + 83.1) - .5
      );
      color += luminanceNoise * shadowNoise;
      color += colorNoise * shadowNoise * vec3(.34, .48, .27);
      color *= 1.0 - smoothstep(.62, 1.0, radial) * .028;

      // Deliberately heavy early-digital ordered dithering. Two physical
      // pixels share each Bayer sample, and a reduced color ladder makes the
      // pattern legible in road gradients, fog, bodywork, and light bloom.
      float ditherThreshold = bayer4(floor(gl_FragCoord.xy * .5)) - .5;
      float ditherLevels = 9.0;
      vec3 dithered = floor(clamp(color, 0.0, 1.0) * ditherLevels + ditherThreshold + .5) / ditherLevels;
      color = mix(color, dithered, uHeavyDither * .94);
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
});
composer.addPass(cameraPass);

scene.add(new THREE.HemisphereLight(0x85847d, 0x040403, .159));
const keyLight = new THREE.DirectionalLight(0xc8c2b0, .095);
keyLight.position.set(-40, 65, -20);
scene.add(keyLight);
const cityGlow = new THREE.PointLight(0xffaa5c, 1.656, 145, 2);
cityGlow.position.set(55, 30, 260);
scene.add(cityGlow);
const neutralFill = new THREE.PointLight(0xd6d1c2, .411, 98, 2);
neutralFill.position.set(-48, 18, 175);
scene.add(neutralFill);
const moonLight = new THREE.DirectionalLight(0xa8bdca, .058);
moonLight.position.set(-150, 125, 420);
scene.add(moonLight);

function addStars(): void {
  const positions = new Float32Array(700 * 3);
  let seed = 34561;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 700; i += 1) {
    positions[i * 3] = (random() - .5) * 1200;
    positions[i * 3 + 1] = 55 + random() * 270;
    positions[i * 3 + 2] = -200 + random() * 1550;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xc5c0b2, size: .45, transparent: true, opacity: .26, depthWrite: false })));
}
addStars();

element('loading-stage').textContent = 'INITIALIZING VEHICLE DYNAMICS';
await RAPIER.init();
const physics = new RAPIER.World({ x: 0, y: 0, z: 0 });
physics.timestep = 1 / 120;
element('loading-stage').textContent = 'BUILDING INTERSTATE 45';
const highway = new HighwayWorld(scene, renderer);
const asterionCar = createPlayerCar(scene);
let kitsuneCar: PlayerCarVisual;
try {
  element('loading-stage').textContent = 'PREPARING THE GARAGE';
  kitsuneCar = await createKitsuneCar(scene);
} catch (error) {
  console.warn('KITSUNE R-SPEC model failed to load; using a safe visual fallback.', error);
  kitsuneCar = createPlayerCar(scene);
  kitsuneCar.group.name = 'Kitsune R-Spec fallback visual';
  element('asset-status').textContent = 'KITSUNE UNAVAILABLE / ASTERION LOAN CAR ACTIVE';
  const retry = document.createElement('button'); retry.textContent = 'RETRY GARAGE'; retry.className = 'ghost-button';
  retry.addEventListener('click', () => location.reload()); element('asset-status').append(retry);
}
const playerCars: Record<CarId, PlayerCarVisual> = {
  'asterion-vxr': asterionCar,
  'kitsune-r-spec': kitsuneCar,
};
let selectedCarId: CarId = 'asterion-vxr';
try {
  const storedCar = localStorage.getItem('midnight-loop-selected-car');
  if (isCarId(storedCar)) selectedCarId = storedCar;
} catch { /* privacy mode */ }
let playerCar = playerCars[selectedCarId];
for (const [id, car] of Object.entries(playerCars)) car.group.visible = id === selectedCarId;
const chaseCamera = new ChaseCamera(camera);
const runIntroCamera = new RunIntroCamera(camera);
const speedStreaks = new SpeedStreaks(scene);
const playerBody = physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, .65, 16));
const playerCollider = physics.createCollider(
  RAPIER.ColliderDesc.cuboid(PLAYER_COLLISION_HALF_WIDTH, .46, PLAYER_COLLISION_HALF_LENGTH)
    .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC),
  playerBody,
);
playerCollider.setFriction(.9);
const traffic = new TrafficManager(scene, physics, RAPIER, 56);
const audio = new GameAudio();
let engineOption: EngineOption = 'street-sedan';
try {
  const storedEngine = localStorage.getItem('midnight-loop-engine-sound');
  if (isEngineOption(storedEngine)) engineOption = storedEngine;
} catch { /* privacy mode */ }
engineSoundSelect.value = engineOption;
pauseEngineSoundSelect.value = engineOption;
audio.setEngineOption(engineOption);

function selectEngineOption(value: string, preview = false): void {
  if (!isEngineOption(value)) return;
  engineOption = value;
  engineSoundSelect.value = value;
  pauseEngineSoundSelect.value = value;
  audio.setEngineOption(value, preview);
  try { localStorage.setItem('midnight-loop-engine-sound', value); } catch { /* privacy mode */ }
}
const passTracker = new NearMissTracker();
let vehicle = createVehicleState();
let combo = createCombo();
let stats: RunStats = { score: 0, nearMisses: 0, driftPoints: 0, topSpeed: vehicle.speedMph, elapsed: 0 };
const ledger = new ScoreLedger();
let speedScoreRemainder = 0;
let scoreSerial = 0;
let draftEligibleUntil = 0;
const needlePairs = new Set<string>();
function awardScore(id: string, source: ScoreSource, points: number, multiplier = 1): number {
  const added = ledger.award(id, source, points, multiplier);
  stats.score = ledger.total;
  return added;
}
let drift: DriftState = createDriftState();
let lastSpeedRiskTier = 1;
let mode: GameMode = 'menu';
let accumulator = 0;
let lastTime = performance.now() / 1000;
let crashTimer = 0;
let calloutUntil = 0;
let damageUntil = 0;
let lastGear = vehicle.gear;
let lastPass: NearMissEvent | null = null;
let draftVehicleId = -1;
let draftTime = 0;
let draftedVehicleId = -1;
let runClock = 0;
let fps = 60;
let fpsFrames = 0;
let fpsTimer = 0;
let debugScenario = '';
let debugAutoDrive = false;
let debugDrift = false;
let debugHandlingMode: '' | 'brake' | 'swerve' = '';
let debugHandlingStartedAt = 0;
let debugTargetRoadOffset: number | null = null;
let debugDuplicateReplayAt = 0;
let debugDuplicateScore = -1;
let debugLastKey = '--';
let debugKeyEvents = 0;
let rapierContactCount = 0;
let lastImpactKind = 'none';
let lastImpactSeverity = 0;
const pressed = new Set<string>();
const mobileInput = createMobileInputState();
const mobilePointers = new Map<number, { action: MobileControlAction; button: HTMLButtonElement; startY: number; boostSwipe: boolean }>();
let mobileControlMode: MobileControlMode = 'buttons';
let tiltGamma: number | null = null;
let tiltNeutralGamma = 0;
let tiltSteer = 0;
let tiltCalibrated = false;
let tiltPermissionReady = false;
let mobileSwipeBoostUntil = 0;
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

try {
  if (localStorage.getItem('midnight-loop-mobile-controls') === 'tilt') mobileControlMode = 'tilt';
} catch { /* privacy mode */ }
mobileControlModeSelect.value = mobileControlMode;
mobileControls.dataset.controlMode = mobileControlMode;

function calibrateTiltSteering(): void {
  tiltSteer = 0;
  if (tiltGamma === null) {
    tiltCalibrated = false;
    return;
  }
  tiltNeutralGamma = tiltGamma;
  tiltCalibrated = true;
  navigator.vibrate?.(18);
}

function applyMobileControlMode(next: MobileControlMode): void {
  mobileControlMode = next;
  mobileControlModeSelect.value = next;
  mobileControls.dataset.controlMode = next;
  clearMobileInput();
  tiltSteer = 0;
  try { localStorage.setItem('midnight-loop-mobile-controls', next); } catch { /* privacy mode */ }
}

async function enableTiltSteering(): Promise<void> {
  if (!TOUCH_CAPABLE || mobileControlMode !== 'tilt') return;
  if (tiltPermissionReady) {
    calibrateTiltSteering();
    return;
  }
  const orientationApi = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  try {
    if (typeof orientationApi?.requestPermission === 'function') {
      const permission = await orientationApi.requestPermission();
      if (permission !== 'granted') {
        applyMobileControlMode('buttons');
        showCallout('TILT ACCESS DENIED', 'THUMB CONTROLS ACTIVE', 1.2);
        return;
      }
    }
    tiltPermissionReady = true;
    calibrateTiltSteering();
  } catch {
    applyMobileControlMode('buttons');
    showCallout('TILT UNAVAILABLE', 'THUMB CONTROLS ACTIVE', 1.2);
  }
}

window.addEventListener('deviceorientation', (event) => {
  if (event.gamma === null) return;
  tiltGamma = event.gamma;
  if (mobileControlMode === 'tilt' && !tiltCalibrated) calibrateTiltSteering();
}, { passive: true });

const previousPose = { x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw };
const renderVehicle: VehicleState = { ...vehicle };
const showroomVehicle: VehicleState = {
  ...vehicle,
  vx: 0, vz: 0, speedMps: 0, speedMph: 0,
  longitudinalSpeed: 0, lateralSpeed: 0, yawRate: 0,
  steering: 0, steerAngle: 0, rpm: 900, gear: 1,
};
let showroomYaw = .45;
let showroomDragging = false;
let showroomPointerId = -1;
let showroomLastPointerX = 0;
let showroomAutoResumeAt = 0;

function updateCarSelectionUi(): void {
  const definition = carDefinition(selectedCarId);
  const index = CAR_DEFINITIONS.findIndex((car) => car.id === selectedCarId);
  carCounterText.textContent = `${String(index + 1).padStart(2, '0')} / ${String(CAR_DEFINITIONS.length).padStart(2, '0')}`;
  carNameText.textContent = definition.name;
  carClassText.textContent = definition.classLabel;
  carDescriptionText.textContent = definition.description;
  carDragSurface.setAttribute('aria-label', `${definition.name} rotating 360 degree preview`);
}

function selectCar(nextId: CarId): void {
  if (nextId === selectedCarId) return;
  playerCar.group.visible = false;
  selectedCarId = nextId;
  playerCar = playerCars[selectedCarId];
  playerCar.group.visible = true;
  showroomYaw = .45;
  showroomAutoResumeAt = performance.now() / 1000 + 1.2;
  try { localStorage.setItem('midnight-loop-selected-car', selectedCarId); } catch { /* privacy mode */ }
  updateCarSelectionUi();
  audio.ui();
}

function stepCarSelection(direction: -1 | 1): void {
  selectCar(adjacentCar(selectedCarId, direction));
}

function updateShowroom(dt: number, now: number): void {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !showroomDragging && now >= showroomAutoResumeAt) showroomYaw += dt * .34;
  showroomVehicle.x = roadCenterX(16);
  showroomVehicle.z = 16;
  showroomVehicle.yaw = showroomYaw;
  showroomVehicle.boostActive = false;
  playerCar.update(showroomVehicle, false, dt);
  playerCar.group.rotation.y = showroomYaw;
  playerCar.group.rotation.x = 0;
  playerCar.group.rotation.z = 0;
  const roadY = roadCenterY(showroomVehicle.z);
  const portraitShowroom = MOBILE_DEVICE && innerHeight > innerWidth;
  if (portraitShowroom) {
    // Aim below the axle line to lift the car clear of the selector while also
    // bringing it closer in the narrow mobile viewport.
    camera.position.set(showroomVehicle.x + 4.55, roadY + 2.25, showroomVehicle.z - 5.35);
    camera.lookAt(showroomVehicle.x, roadY - .16, showroomVehicle.z);
  } else {
    camera.position.set(showroomVehicle.x + 5.4, roadY + 2.2, showroomVehicle.z - 6.25);
    camera.lookAt(showroomVehicle.x, roadY + .66, showroomVehicle.z);
  }
  const showroomFov = portraitShowroom ? 43 : 47;
  camera.fov += (showroomFov - camera.fov) * Math.min(1, dt * 7);
  camera.updateProjectionMatrix();
}

updateCarSelectionUi();

traffic.reset(vehicle.z);
playerCar.update(vehicle, false, 1 / 60);
chaseCamera.reset(vehicle);

function clearMobileInput(): void {
  resetMobileControls(mobileInput);
  mobileSwipeBoostUntil = 0;
  for (const active of mobilePointers.values()) active.button.classList.remove('is-pressed', 'is-boosting');
  mobilePointers.clear();
}

function setMode(next: GameMode): void {
  mode = next;
  menu.classList.toggle('hidden', next !== 'menu');
  hud.classList.toggle('hidden', next === 'menu' || next === 'gameover');
  hud.classList.toggle('cinematic', next === 'intro');
  pauseScreen.classList.toggle('hidden', next !== 'paused');
  gameoverScreen.classList.toggle('hidden', next !== 'gameover');
  const mobileDriving = TOUCH_CAPABLE && next === 'running';
  mobileControls.classList.toggle('active', mobileDriving);
  mobileControls.setAttribute('aria-hidden', String(!mobileDriving));
  if (!mobileDriving) clearMobileInput();
  if (next === 'menu') {
    showroomAutoResumeAt = performance.now() / 1000 + .65;
    updateCarSelectionUi();
  }
}

function startRun(): void {
  void audio.start(true);
  if (mobileControlMode === 'tilt') void enableTiltSteering();
  audio.ui();
  configureRoadRoute(DEBUG ? 20260814 : Math.floor(Math.random() * 2147483646) + 1);
  vehicle = createVehicleState();
  combo = createCombo();
  calloutQueue.length = 0; calloutUntil = 0;
  element('drift-pending').textContent = '';
  ledger.reset(); speedScoreRemainder = 0; scoreSerial = 0; needlePairs.clear();
  stats = { score: 0, nearMisses: 0, driftPoints: 0, topSpeed: vehicle.speedMph, elapsed: 0 };
  drift = createDriftState();
  lastSpeedRiskTier = 1;
  runClock = 0;
  crashTimer = 0;
  calloutUntil = 0;
  damageUntil = 0;
  lastImpactKind = 'none';
  lastImpactSeverity = 0;
  crashBlackout.classList.remove('active');
  callout.textContent = '';
  callout.style.opacity = '0';
  lastPass = null;
  draftVehicleId = -1;
  draftedVehicleId = -1;
  draftTime = 0; draftEligibleUntil = 0;
  passTracker.reset();
  highway.reset(vehicle.z, true);
  traffic.density = Number.parseFloat(trafficSelect.value);
  // The player covers almost 200 m during the aerial introduction. Reserve a
  // clear opening corridor so its center-lane handoff cannot land beside or
  // inside the first traffic wave. Normal dense recycling resumes afterward.
  traffic.reset(vehicle.z, DEBUG ? 0 : 120);
  chaseCamera.reset(vehicle);
  lastGear = vehicle.gear;
  accumulator = 0;
  debugScenario = '';
  debugAutoDrive = false;
  debugDrift = false;
  debugHandlingMode = '';
  debugTargetRoadOffset = null;
  previousPose.x = vehicle.x; previousPose.z = vehicle.z; previousPose.yaw = vehicle.yaw;
  Object.assign(renderVehicle, vehicle);
  debugPanel.querySelectorAll<HTMLButtonElement>('button').forEach((button) => button.classList.remove('active'));
  if (DEBUG) {
    runIntroCamera.cancel();
    setMode('running');
  } else {
    setMode('intro');
    runIntroCamera.start(vehicle, chaseCamera.getPose());
  }
  updateHud(1);
}

function quitToMenu(): void {
  drift = createDriftState(); calloutQueue.length = 0; element('drift-pending').textContent = '';
  pressed.clear();
  runIntroCamera.cancel();
  audio.stopMusic();
  if (chaseCamera.getMode() === 'hood') chaseCamera.toggle(renderVehicle);
  playerCar.group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.visible = true;
  });
  crashBlackout.classList.remove('active');
  setMode('menu');
  menuHighScoreText.textContent = formatScore(highScore);
  audio.ui();
}

function togglePause(): void {
  if (mode === 'running') {
    pressed.clear();
    audio.pauseMusic();
    setMode('paused');
  } else if (mode === 'paused') {
    accumulator = 0;
    void audio.start();
    setMode('running');
  }
  audio.ui();
}

function skipRunIntro(): void {
  if (mode !== 'intro') return;
  runIntroCamera.cancel();
  chaseCamera.reset(renderVehicle);
  hud.classList.remove('cinematic');
  accumulator = 0;
  setMode('running');
}

function toggleCamera(): string {
  const cameraMode = chaseCamera.toggle(renderVehicle);
  showCallout(cameraMode === 'hood' ? 'HOOD CAMERA' : 'CHASE CAMERA', '', .55);
  audio.ui();
  return cameraMode;
}

function recoverCurrentVehicle(): void {
  if (mode !== 'running') return;
  drift = createDriftState(); draftedVehicleId = -1; element('drift-pending').textContent = '';
  recoverVehicle(vehicle);
  previousPose.x = vehicle.x;
  previousPose.z = vehicle.z;
  previousPose.yaw = vehicle.yaw;
  showCallout('VEHICLE RECOVERED', '', .65);
  audio.ui();
}

function endRun(): void {
  if (mode === 'gameover') return;
  if (stats.score > highScore) {
    highScore = Math.round(stats.score);
    try { localStorage.setItem('midnight-loop-v2-high-score', String(highScore)); } catch { /* privacy mode */ }
  }
  highScoreText.textContent = formatScore(highScore);
  finalScoreText.textContent = formatScore(stats.score);
  finalComboText.textContent = `×${combo.bestMultiplier.toFixed(2)}`;
  finalSpeedText.textContent = `${Math.round(stats.topSpeed)} MPH`;
  finalMissesText.textContent = `${stats.nearMisses}`;
  element('score-breakdown').textContent = Object.entries(ledger.totals).map(([key, value]) => `${key.toUpperCase()}  ${formatScore(value)}`).join('   /   ');
  setMode('gameover');
  crashBlackout.classList.remove('active');
}

function beginCrash(severity: number): void {
  drift = createDriftState(); element('drift-pending').textContent = ''; calloutQueue.length = 0;
  if (mode !== 'running') return;
  mode = 'crashing';
  crashTimer = 1.05;
  combo = breakCombo(combo);
  crashBlackout.classList.add('active');
  audio.crash(severity);
}

function getInput(): DriverInput {
  if (mode === 'intro') return { throttle: .62, brake: 0, steer: 0, handbrake: false, boost: false };
  if (mode !== 'running') return { throttle: 0, brake: .45, steer: 0, handbrake: false, boost: false };
  if (DEBUG && debugHandlingMode) {
    const phase = runClock - debugHandlingStartedAt;
    if (debugHandlingMode === 'brake') {
      return phase < .42
        ? { throttle: .4, brake: 0, steer: .38, handbrake: false, boost: false }
        : { throttle: 0, brake: 1, steer: 0, handbrake: false, boost: false };
    }
    const swervePhase = phase % 2.8;
    const steer = swervePhase < .62 ? .58 : swervePhase < 1.25 ? -.58 : swervePhase < 1.82 ? .48 : swervePhase < 2.35 ? -.48 : 0;
    return { throttle: .72, brake: 0, steer, handbrake: false, boost: false };
  }
  if (DEBUG && debugDrift) {
    return { throttle: .68, brake: 0, steer: .3, handbrake: true, boost: false };
  }
  if (DEBUG && debugAutoDrive) {
    return { throttle: 1, brake: 0, steer: 0, handbrake: false, boost: vehicle.speedMph > 112 && vehicle.boost > .08 };
  }
  const throttle = pressed.has('KeyW') || pressed.has('ArrowUp') ? 1 : 0;
  const brake = pressed.has('KeyS') || pressed.has('ArrowDown') ? 1 : 0;
  const left = pressed.has('KeyA') || pressed.has('ArrowLeft');
  const right = pressed.has('KeyD') || pressed.has('ArrowRight');
  const touch = mobileDriverInput(mobileInput);
  if (TOUCH_CAPABLE && mobileControlMode === 'tilt') {
    const targetSteer = tiltGamma !== null && tiltCalibrated
      ? tiltGammaToDriverSteer(tiltGamma, tiltNeutralGamma)
      : 0;
    tiltSteer += (targetSteer - tiltSteer) * .075;
    touch.steer = tiltSteer;
    touch.throttle = touch.brake > 0 ? 0 : 1;
  }
  return {
    throttle: Math.max(throttle, touch.throttle),
    brake: Math.max(brake, touch.brake),
    steer: touch.steer !== 0 ? touch.steer : digitalSteer(left, right),
    handbrake: pressed.has('Space') || touch.handbrake,
    boost: pressed.has('ShiftLeft') || pressed.has('ShiftRight') || touch.boost || runClock < mobileSwipeBoostUntil,
  };
}

function handleImpact(collision: TrafficCollision | null, barrierSeverity = 0): void {
  const closingSpeed = collision?.closingSpeed ?? barrierSeverity;
  // Correction and score invalidation always run, including during effect cooldowns.
  if (collision) {
    passTracker.markCollision(collision.vehicle.id);
    vehicle.x += collision.correctionX ?? 0;
    vehicle.z += collision.correctionZ ?? 0;
    if (closingSpeed > 0) applyCollisionImpulse(vehicle, collision.normalX, collision.normalZ, closingSpeed, collision.scrape, collision.lever);
  }
  drift = createDriftState(); element('drift-pending').textContent = '';
  draftedVehicleId = -1; draftEligibleUntil = 0;
  if (collision?.notify === false || (!collision && vehicle.collisionCooldown > 0)) return;
  lastImpactKind = collision ? (collision.scrape ? 'scrape' : 'impact') : 'barrier';
  lastImpactSeverity = closingSpeed;
  vehicle.collisionCooldown = .34;
  combo = breakCombo(combo, collision?.scrape ?? closingSpeed < 7);
  if (closingSpeed >= HANDLING.fatalClosingSpeed) beginCrash(closingSpeed * 1.5);
  else {
    audio.collision(Math.max(4, closingSpeed * 1.5), collision?.scrape ?? true);
    chaseCamera.hit(Math.min(.7, closingSpeed / 35));
    damageUntil = runClock + Math.min(.32, .10 + closingSpeed * .006);
    showCallout(closingSpeed > 10 ? 'HARD CONTACT // KEEP GOING' : 'BODY SCRAPE', '', .65);
  }
}

function awardNearMiss(event: NearMissEvent): void {
  const multiplier = event.appliedMultiplier ?? combo.multiplier * speedRiskMultiplier(vehicle.speedMph);
  awardScore(`pass:${event.id}`, 'pass', event.points / multiplier, multiplier);
  stats.nearMisses += 1;
  vehicle.boost = Math.min(1, vehicle.boost + (event.perfect ? .16 : .075) + Math.max(0, .07 - event.clearance * .022));
  showCallout(`${event.perfect ? 'PERFECT PASS' : 'NEAR MISS'} +${event.points}`, event.perfect ? 'perfect' : '', .9);
  if (draftedVehicleId === event.id && runClock <= draftEligibleUntil) {
    const bonus = awardScore(`draft:${event.id}`, 'draft', 420, multiplier);
    showCallout(`DRAFT RELEASE +${bonus}`, '', .9);
    draftedVehicleId = -1;
  }
  audio.nearMiss(event.perfect);
  const pair = lastPass ? [lastPass.id, event.id].sort((a,b) => a-b).join(':') : '';
  if (lastPass && isThreadNeedlePair(lastPass, event) && !needlePairs.has(pair)) {
    needlePairs.add(pair);
    const bonus = awardScore(`needle:${pair}`, 'needle', 1350, multiplier);
    vehicle.boost = Math.min(1, vehicle.boost + .28);
    showCallout(`THREAD THE NEEDLE +${bonus}`, 'perfect', 1.25);
    audio.threadNeedle();
  }
  combo = addToCombo(combo, runClock);
  lastPass = event;
}

function updateDraft(dt: number): void {
  let candidate: TrafficVehicle | null = null;
  let best = 25;
  for (const item of traffic.vehicles) {
    if (!item.group.visible) continue;
    const heading = roadHeading(vehicle.z);
    const worldX = item.group.position.x - vehicle.x, worldZ = item.z - vehicle.z;
    const dz = worldX * Math.sin(heading) + worldZ * Math.cos(heading);
    const dx = Math.abs(worldX * Math.cos(heading) - worldZ * Math.sin(heading));
    if (dz > 3.5 && dz < best && dx < item.halfWidth + .72 && vehicle.longitudinalSpeed > item.speed + 2.5 && vehicle.speedMps > 34) {
      candidate = item;
      best = dz;
    }
  }
  if (candidate) {
    if (draftVehicleId === candidate.id) draftTime += dt;
    else { draftVehicleId = candidate.id; draftTime = 0; }
    if (draftTime > 1.15) { draftedVehicleId = candidate.id; draftEligibleUntil = runClock + 3; }
  } else {
    draftVehicleId = -1;
    draftTime = 0;
  }
}

function simulate(dt: number): void {
  previousPose.x = vehicle.x;
  previousPose.z = vehicle.z;
  previousPose.yaw = vehicle.yaw;
  runClock += dt;
  combo = tickCombo(combo, runClock);
  stats.elapsed += dt;
  if (debugScenario === 'duplicate' && debugDuplicateReplayAt > 0 && runClock >= debugDuplicateReplayAt) {
    const primary = traffic.vehicles[0];
    debugDuplicateScore = Math.round(stats.score);
    primary.z = vehicle.z + 18;
    primary.speed = 24;
    primary.desiredSpeed = 24;
    primary.collisionCooldown = 0;
    debugDuplicateReplayAt = 0;
    showCallout('DUPLICATE REPLAY // SAME ID', '', .75);
  }
  const input = getInput();
  const priorGear = vehicle.gear;
  const result = stepVehicle(vehicle, input, dt);
  if (mode === 'intro') {
    // The cinematic car follows the exact center-lane spline. This prevents
    // accumulated tire-model drift on a curved segment from creating a
    // slightly off-center first playable frame.
    const introHeading = roadHeading(vehicle.z);
    const introSpeed = Math.max(0, vehicle.longitudinalSpeed);
    vehicle.x = laneX(vehicle.z, 2);
    vehicle.yaw = introHeading;
    vehicle.vx = Math.sin(introHeading) * introSpeed;
    vehicle.vz = Math.cos(introHeading) * introSpeed;
    vehicle.yawRate = 0;
    vehicle.lateralSpeed = 0;
  }
  const debugRoadLock = debugTargetRoadOffset ?? (debugAutoDrive ? 0 : null);
  if (debugRoadLock !== null) {
    // Keep deterministic scoring fixtures road-relative while preserving the
    // simulated longitudinal speed. Normal gameplay never enters this branch.
    const fixtureHeading = roadHeading(vehicle.z);
    const fixtureSpeed = Math.max(0, vehicle.longitudinalSpeed);
    vehicle.x = roadCenterX(vehicle.z) + Math.cos(fixtureHeading) * debugRoadLock;
    vehicle.yaw = fixtureHeading;
    vehicle.vx = Math.sin(fixtureHeading) * fixtureSpeed;
    vehicle.vz = Math.cos(fixtureHeading) * fixtureSpeed;
    vehicle.yawRate = 0;
    vehicle.lateralSpeed = 0;
  }
  if (vehicle.gear !== priorGear && vehicle.gear !== lastGear) audio.gearShift(priorGear, vehicle.gear, vehicle.rpm);
  lastGear = vehicle.gear;


  const previousTrafficIds = traffic.vehicles.map(item => item.id);
  const collisions = traffic.update(
    dt,
    vehicle.x,
    vehicle.z,
    vehicle.yaw,
    vehicle.vx,
    vehicle.vz,
    PLAYER_COLLISION_HALF_WIDTH,
    PLAYER_COLLISION_HALF_LENGTH,
  );
  for (let i = 0; i < previousTrafficIds.length; i++) if (previousTrafficIds[i] !== traffic.vehicles[i].id) passTracker.forget(previousTrafficIds[i]);
  for (const item of traffic.vehicles) {
    if (item.passedPlayer) {
      const lateralDistance = Math.abs(item.group.position.x - vehicle.x);
      audio.trafficPass(
        item.group.position.x > vehicle.x ? 1 : -1,
        Math.max(0, vehicle.speedMps - item.speed),
        lateralDistance,
      );
    }
  }
  const collisionIds = new Set<number>();
  for (const collision of collisions) {
    if (mode === 'intro' || debugAutoDrive || debugDrift || debugHandlingMode) continue;
    collisionIds.add(collision.vehicle.id);
    handleImpact(collision);
  }
  if (mode === 'running' && !debugAutoDrive && !debugDrift && !debugHandlingMode && result.barrierImpact > 0) handleImpact(null, result.barrierImpact);

  const playerRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, vehicle.yaw, 0));
  playerBody.setNextKinematicTranslation({ x: vehicle.x, y: roadCenterY(vehicle.z) + .65, z: vehicle.z });
  playerBody.setNextKinematicRotation({ x: playerRotation.x, y: playerRotation.y, z: playerRotation.z, w: playerRotation.w });
  physics.step();
  rapierContactCount = 0;
  physics.contactPairsWith(playerCollider, (otherCollider) => {
    if (mode === 'intro' || debugAutoDrive || debugDrift || debugHandlingMode) return;
    const item = traffic.vehicleForCollider(otherCollider.handle);
    if (!item || collisionIds.has(item.id) || item.collisionCooldown > 0) return;
    let penetrating = false;
    physics.contactPair(playerCollider, otherCollider, (manifold) => {
      for (let index = 0; index < manifold.numContacts(); index += 1) {
        if (manifold.contactDist(index) <= .015) penetrating = true;
      }
    });
    if (!penetrating) return;
    rapierContactCount += 1;
    collisionIds.add(item.id);
    const contact = carContact(
      { x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw, vx: vehicle.vx, vz: vehicle.vz, halfWidth: PLAYER_COLLISION_HALF_WIDTH, halfLength: PLAYER_COLLISION_HALF_LENGTH },
      { x: item.group.position.x, z: item.z, yaw: item.group.rotation.y, vx: item.vx, vz: item.vz, halfWidth: item.collisionHalfWidth, halfLength: item.collisionHalfLength },
    );
    if (!contact) return;
    handleImpact({ vehicle: item, severity: contact.closingSpeed, closingSpeed: contact.closingSpeed,
      normalX: contact.normalX, normalZ: contact.normalZ, scrape: contact.scrape, lever: contact.lever,
      notify: item.collisionCooldown <= 0, correctionX: -contact.normalX * contact.penetration, correctionZ: -contact.normalZ * contact.penetration });
    item.collisionCooldown = .7;
  });

  if (mode === 'running') {
    const riskMultiplier = combo.multiplier * speedRiskMultiplier(vehicle.speedMph);
    const driftUpdate = updateDrift(drift, {
      speedMps: vehicle.speedMps,
      longitudinalSpeed: vehicle.longitudinalSpeed,
      lateralSpeed: vehicle.lateralSpeed,
      yawRate: vehicle.yawRate,
      handbrake: input.handbrake,
      now: runClock,
      dt,
      multiplier: riskMultiplier,
      invalidated: collisionIds.size > 0 || result.barrierImpact > 0,
    });
    drift = driftUpdate.state;
    element('drift-pending').textContent = drift.active ? `DRIFT  ${drift.points.toLocaleString()}  /  UNBANKED` : '';
    if (driftUpdate.completedPoints > 0) {
      const added = awardScore(`drift:${scoreSerial++}`, 'drift', driftUpdate.completedPoints);
      stats.driftPoints += added;
      combo = addToCombo(combo, runClock);
      vehicle.boost = Math.min(1, vehicle.boost + Math.min(.18, driftUpdate.completedPoints / 2400));
      showCallout(`DRIFT +${added}  //  TOTAL ${formatScore(stats.score)}`, 'drift-award', 1.35);
      audio.driftBonus();
    }
  } else {
    drift = createDriftState();
  }

  if (mode === 'running') {
    const passMultiplier = combo.multiplier * speedRiskMultiplier(vehicle.speedMph);
    for (const item of traffic.vehicles) {
      if (!item.group.visible || Math.abs(item.z - vehicle.z) > 45) continue;
      const heading = roadHeading(vehicle.z);
      const relativeX = item.group.position.x - vehicle.x;
      const relativeZ = item.z - vehicle.z;
      const playerFootprint = projectedCollisionFootprint(PLAYER_COLLISION_HALF_WIDTH, PLAYER_COLLISION_HALF_LENGTH, vehicle.yaw - heading);
      const trafficFootprint = projectedCollisionFootprint(item.collisionHalfWidth, item.collisionHalfLength, item.group.rotation.y - heading);
      const event = passTracker.sample({
        id: item.id,
        now: runClock,
        playerX: 0,
        playerZ: 0,
        playerHalfWidth: playerFootprint.halfWidth,
        playerHalfLength: playerFootprint.halfLength,
        playerSpeed: Math.max(0, vehicle.longitudinalSpeed),
        trafficX: relativeX * Math.cos(heading) - relativeZ * Math.sin(heading),
        trafficZ: relativeX * Math.sin(heading) + relativeZ * Math.cos(heading),
        trafficHalfWidth: trafficFootprint.halfWidth,
        trafficHalfLength: trafficFootprint.halfLength,
        trafficSpeed: item.speed,
        collided: collisionIds.has(item.id),
      }, passMultiplier);
      if (event) awardNearMiss(event);
    }
    combo = tickCombo(combo, runClock);
    updateDraft(dt);
    stats.topSpeed = Math.max(stats.topSpeed, vehicle.speedMph);
    const speedTier = speedRiskMultiplier(vehicle.speedMph);
    if (!debugScenario) {
      speedScoreRemainder += calculateHighSpeedScore(vehicle.speedMph, dt, combo.multiplier);
      if (speedScoreRemainder >= 1) {
        const whole = Math.floor(speedScoreRemainder);
        awardScore(`speed:${scoreSerial++}`, 'speed', whole);
        speedScoreRemainder -= whole;
      }
    }
    if (speedTier > lastSpeedRiskTier) showCallout(`HIGH SPEED // RISK ×${(combo.multiplier * speedTier).toFixed(2)}`, 'perfect', .75);
    lastSpeedRiskTier = speedTier;
  } else if (mode === 'crashing') {
    crashTimer -= dt * 3.6;
    if (crashTimer <= 0) endRun();
  }
}

const calloutQueue: { text: string; className: string; duration: number }[] = [];
function showCallout(text: string, className = '', duration = .8): void {
  if (calloutQueue.some(item => item.text === text)) return;
  if (calloutQueue.length >= 5) calloutQueue.shift();
  calloutQueue.push({ text, className, duration });
  if (runClock >= calloutUntil) nextCallout();
}
function nextCallout(): void {
  const next = calloutQueue.shift();
  if (!next) { callout.style.opacity = '0'; return; }
  callout.textContent = next.text;
  callout.className = `callout ${next.className}`;
  calloutUntil = runClock + next.duration;
  callout.style.opacity = '1';
}

let displayRpm = 4300, displaySpeed = 80;
function updateHud(dt: number): void {
  scoreText.textContent = formatScore(stats.score);
  highScoreText.textContent = formatScore(Math.max(highScore, stats.score));
  speedText.textContent = Math.round(Math.max(0, vehicle.speedMph)).toString().padStart(3, '0');
  gearText.textContent = vehicle.longitudinalSpeed < -1 ? 'R' : String(vehicle.gear);
  rpmValueText.textContent = Math.round(vehicle.rpm).toString().padStart(4, '0');
  displayRpm = dampNeedle(displayRpm, vehicle.rpm, dt);
  displaySpeed = dampNeedle(displaySpeed, vehicle.speedMph, dt);
  tachNeedle.style.transform = `rotate(${dialAngle(displayRpm, RPM_DIAL)}deg)`;
  speedNeedle.style.transform = `rotate(${dialAngle(displaySpeed, SPEED_DIAL)}deg)`;
  boostFill.style.transform = `scaleX(${vehicle.boost})`;
  boostVignette.classList.toggle('active', vehicle.boostActive);
  comboText.textContent = `×${combo.multiplier.toFixed(2)}`;
  element('speed-risk').textContent = `SPEED ×${speedRiskMultiplier(vehicle.speedMph).toFixed(2)}`;
  comboWrap.classList.toggle('active', combo.chain > 0);
  const remaining = combo.chain > 0 ? Math.max(0, (combo.expiresAt - runClock) / PASS_CONFIG.comboWindow) : 0;
  comboTimer.style.transform = `scaleX(${remaining})`;
  damageFlash.classList.toggle('active', runClock < damageUntil);
  if (runClock > calloutUntil) nextCallout();
}

function debugSnapshot(): DebugSnapshot {
  const nearby = traffic.vehicles
    .filter((item) => item.group.visible && Math.abs(item.z - vehicle.z) < 160)
    .sort((a, b) => Math.abs(a.z - vehicle.z) - Math.abs(b.z - vehicle.z))
    .slice(0, 12)
    .map((item) => ({ id: item.id, type: item.archetype, lane: Number(item.lanePosition.toFixed(2)), dz: Number((item.z - vehicle.z).toFixed(1)), dx: Number((item.group.position.x - vehicle.x).toFixed(2)), speedMps: Number(item.speed.toFixed(1)), visible: item.group.visible }));
  const maxFormation = maximumOccupiedLanesInBand(traffic.vehicles
    .filter((item) => item.group.visible && item.z > vehicle.z && item.z < vehicle.z + 260));
  const roadRange = highway.getChunkRange();
  const trafficLighting = traffic.getLightingTelemetry();
  return {
    mode, selectedCar: selectedCarId,
    player: {
      x: Number(vehicle.x.toFixed(3)), y: Number((roadCenterY(vehicle.z) + .55).toFixed(3)), z: Number(vehicle.z.toFixed(3)),
      yaw: Number(vehicle.yaw.toFixed(4)), speedMps: Number(vehicle.speedMps.toFixed(3)), speedMph: Number(vehicle.speedMph.toFixed(2)),
      lateralSpeed: Number(vehicle.lateralSpeed.toFixed(3)), yawRate: Number(vehicle.yawRate.toFixed(4)), rpm: Math.round(vehicle.rpm), gear: vehicle.gear,
      steer: Number(vehicle.steering.toFixed(3)), frontSlip: Number(vehicle.frontSlip.toFixed(4)), rearSlip: Number(vehicle.rearSlip.toFixed(4)),
      boost: Number(vehicle.boost.toFixed(3)), boostActive: vehicle.boostActive,
      driftActive: drift.active, driftAngle: Number(drift.angleDeg.toFixed(2)), driftRadius: Number.isFinite(drift.radiusM) ? Number(drift.radiusM.toFixed(2)) : -1,
      driftPoints: Math.round(drift.points), cameraHood: chaseCamera.getMode() === 'hood',
      cameraFov: Number(chaseCamera.getTelemetry().fov.toFixed(2)), cameraShake: Number(chaseCamera.getTelemetry().speedShake.toFixed(4)),
      cameraDistance: Number(chaseCamera.getTelemetry().followDistance.toFixed(3)),
    },
    score: Math.round(stats.score), highScore, combo, nearbyTraffic: nearby,
    nearMissCandidates: nearby.filter((item) => Math.abs(Number(item.dz)) < 25).length,
    maxFormation,
    roadCoverage: highway.covers(vehicle.z),
    roadStartZ: Math.round(roadRange.startZ),
    roadEndZ: Math.round(roadRange.endZ),
    trafficHeadlightPools: trafficLighting.projected,
    trafficDynamicHeadlights: trafficLighting.dynamic,
    impactKind: lastImpactKind,
    impactSeverity: Number(lastImpactSeverity.toFixed(1)),
    fps: Math.round(fps), objects: scene.children.length, drawCalls: renderer.info.render.calls,
  };
}

function setScenario(name: ScenarioName): void {
  if (mode !== 'running') startRun();
  debugAutoDrive = false;
  debugDrift = false;
  debugHandlingMode = '';
  debugScenario = name;
  debugDuplicateReplayAt = 0;
  debugDuplicateScore = -1;
  debugTargetRoadOffset = null;
  lastImpactKind = 'none';
  lastImpactSeverity = 0;
  vehicle.collisionCooldown = 0;
  calloutQueue.length = 0; calloutUntil = 0;
  element('drift-pending').textContent = '';
  ledger.reset(); speedScoreRemainder = 0; scoreSerial = 0; needlePairs.clear();
  stats.score = 0;
  stats.nearMisses = 0;
  stats.driftPoints = 0;
  drift = createDriftState();
  passTracker.reset();
  combo = createCombo();
  const heading = roadHeading(vehicle.z);
  const speed = 57;
  vehicle.yaw = heading;
  vehicle.vx = Math.sin(heading) * speed;
  vehicle.vz = Math.cos(heading) * speed;
  vehicle.yawRate = 0;
  vehicle.steering = 0;
  for (let index = 1; index < traffic.vehicles.length; index += 1) {
    traffic.vehicles[index].z = vehicle.z + 900 + index * 24;
  }
  const lanePositionX = (z: number, position: number): number => {
    const nearest = Math.round(position);
    return laneX(z, nearest) + Math.cos(roadHeading(z)) * (position - nearest) * LANE_WIDTH;
  };
  const primary = traffic.vehicles[0];
  primary.lane = 1; primary.targetLane = 1; primary.lanePosition = 1; primary.z = vehicle.z + 18; primary.speed = 24; primary.desiredSpeed = 24; primary.collisionCooldown = 0; primary.group.visible = true;
  const clearance = name === 'distant-pass' ? 2.9 : name === 'collision' ? -.4 : name === 'normal-pass' ? 1.35 : .4;
  const fixtureClearance = name === 'collision' || name === 'thread-needle' ? clearance : clearance + .5;
  debugTargetRoadOffset = name === 'collision'
      ? LANE_OFFSETS[1]
      : name === 'scrape'
      ? LANE_OFFSETS[1] - (PLAYER_COLLISION_HALF_WIDTH + primary.collisionHalfWidth - .16)
      : LANE_OFFSETS[1] - (.97 + primary.halfWidth + fixtureClearance);
  vehicle.x = roadCenterX(vehicle.z) + Math.cos(heading) * debugTargetRoadOffset;
  if (name === 'thread-needle') {
    const second = traffic.vehicles[1];
    primary.lane = 1.34; primary.targetLane = 1.34; primary.lanePosition = 1.34;
    second.lane = 2.66; second.targetLane = 2.66; second.lanePosition = 2.66; second.z = primary.z + .15; second.speed = 24; second.desiredSpeed = 24; second.group.visible = true;
    const shiftedPrimaryX = lanePositionX(primary.z, primary.lanePosition);
    const secondX = lanePositionX(second.z, second.lanePosition);
    debugTargetRoadOffset = 0;
    vehicle.x = (shiftedPrimaryX + secondX) / 2;
  }
  if (name === 'collision') vehicle.x = roadCenterX(vehicle.z) + Math.cos(heading) * LANE_OFFSETS[1];
  if (name === 'duplicate') debugDuplicateReplayAt = runClock + 2.2;
  showCallout(`DEBUG // ${name.toUpperCase()}`, '', .7);
}

if (DEBUG) {
  debugPanel.classList.remove('hidden');
  window.__GAME_DEBUG__ = {
    getState: debugSnapshot,
    startRun,
    setScenario,
    forceCrash: () => beginCrash(80),
    addBoost: (amount = 1) => { vehicle.boost = Math.min(1, vehicle.boost + amount); },
    toggleCamera,
    selectCar,
    getMusicState: () => audio.getMusicState(),
  };
  debugPanel.querySelectorAll<HTMLButtonElement>('[data-debug-scenario]').forEach((button) => {
    button.addEventListener('click', () => {
      debugPanel.querySelectorAll<HTMLButtonElement>('button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      setScenario(button.dataset.debugScenario as ScenarioName);
    });
  });
  debugPanel.querySelector<HTMLButtonElement>('[data-debug-action="auto"]')?.addEventListener('click', (event) => {
    if (mode !== 'running') startRun();
    debugScenario = '';
    debugTargetRoadOffset = null;
    debugDrift = false;
    debugHandlingMode = '';
    debugAutoDrive = !debugAutoDrive;
    (event.currentTarget as HTMLButtonElement).classList.toggle('active', debugAutoDrive);
    showCallout(debugAutoDrive ? 'AUTO DRIVE // TEST' : 'AUTO DRIVE // OFF', '', .65);
  });
  debugPanel.querySelector<HTMLButtonElement>('[data-debug-action="high-speed"]')?.addEventListener('click', (event) => {
    if (mode !== 'running') startRun();
    debugScenario = '';
    debugTargetRoadOffset = null;
    debugDrift = false;
    debugHandlingMode = '';
    debugAutoDrive = true;
    const heading = roadHeading(vehicle.z);
    const speed = 70;
    vehicle.yaw = heading;
    vehicle.vx = Math.sin(heading) * speed;
    vehicle.vz = Math.cos(heading) * speed;
    vehicle.longitudinalSpeed = speed;
    vehicle.speedMps = speed;
    vehicle.speedMph = speed * 2.236936;
    vehicle.gear = 5;
    vehicle.rpm = 6500;
    vehicle.boost = Math.max(.55, vehicle.boost);
    debugPanel.querySelectorAll<HTMLButtonElement>('button').forEach((button) => button.classList.remove('active'));
    (event.currentTarget as HTMLButtonElement).classList.add('active');
    showCallout('HIGH SPEED // 157 MPH', 'perfect', .9);
  });
  debugPanel.querySelector<HTMLButtonElement>('[data-debug-action="drift"]')?.addEventListener('click', (event) => {
    if (mode !== 'running') startRun();
    debugScenario = '';
    debugTargetRoadOffset = null;
    debugAutoDrive = false;
    debugHandlingMode = '';
    debugDrift = !debugDrift;
    drift = createDriftState();
    if (debugDrift) {
      const heading = roadHeading(vehicle.z);
      const speed = 42;
      vehicle.yaw = heading;
      vehicle.vx = Math.sin(heading) * speed;
      vehicle.vz = Math.cos(heading) * speed;
      vehicle.longitudinalSpeed = speed;
      vehicle.lateralSpeed = 0;
      vehicle.speedMps = speed;
      vehicle.speedMph = speed * 2.236936;
    }
    debugPanel.querySelectorAll<HTMLButtonElement>('button').forEach((button) => button.classList.remove('active'));
    (event.currentTarget as HTMLButtonElement).classList.toggle('active', debugDrift);
    // Do not overwrite the real drift-bank callout when the fixture releases
    // the handbrake. This keeps browser validation faithful to normal play.
    if (debugDrift) showCallout('DRIFT TEST // HANDBRAKE', '', .7);
  });
  const startHandlingTest = (handlingMode: 'brake' | 'swerve', event: Event) => {
    if (mode !== 'running') startRun();
    debugScenario = '';
    debugTargetRoadOffset = null;
    debugAutoDrive = false;
    debugDrift = false;
    debugHandlingMode = handlingMode;
    debugHandlingStartedAt = runClock;
    const heading = roadHeading(vehicle.z);
    const speed = handlingMode === 'brake' ? 54 : 70;
    vehicle.yaw = heading;
    vehicle.vx = Math.sin(heading) * speed;
    vehicle.vz = Math.cos(heading) * speed;
    vehicle.longitudinalSpeed = speed;
    vehicle.lateralSpeed = 0;
    vehicle.yawRate = 0;
    vehicle.speedMps = speed;
    vehicle.speedMph = speed * 2.236936;
    debugPanel.querySelectorAll<HTMLButtonElement>('button').forEach((button) => button.classList.remove('active'));
    (event.currentTarget as HTMLButtonElement).classList.add('active');
    showCallout(handlingMode === 'brake' ? 'SERVICE BRAKE // STABILITY' : 'HIGHWAY SWERVE // STABILITY', '', .8);
  };
  debugPanel.querySelector<HTMLButtonElement>('[data-debug-action="brake"]')?.addEventListener('click', (event) => startHandlingTest('brake', event));
  debugPanel.querySelector<HTMLButtonElement>('[data-debug-action="swerve"]')?.addEventListener('click', (event) => startHandlingTest('swerve', event));
  debugPanel.querySelector<HTMLButtonElement>('[data-debug-action="crash"]')?.addEventListener('click', () => beginCrash(80));
}

function updateDebug(): void {
  if (!DEBUG) return;
  const snapshot = debugSnapshot();
  const closest = snapshot.nearbyTraffic[0];
  debugReadout.textContent = [
    `MIDNIGHT LOOP DEBUG ${debugScenario ? `// ${debugScenario}` : ''}`,
    `mode ${snapshot.mode}  fps ${snapshot.fps}  draw ${snapshot.drawCalls}  test ${debugAutoDrive ? 'AUTO' : debugDrift ? 'DRIFT' : debugHandlingMode || 'off'}`,
    `speed ${snapshot.player.speedMph} mph  gear ${snapshot.player.gear}  rpm ${snapshot.player.rpm}  steer ${snapshot.player.steer}`,
    `pos ${snapshot.player.x}, ${snapshot.player.z}  lat ${snapshot.player.lateralSpeed}  yawRate ${snapshot.player.yawRate}`,
    `slip F ${snapshot.player.frontSlip}  R ${snapshot.player.rearSlip}`,
    `drift ${snapshot.player.driftActive ? 'ON' : 'off'}  ${snapshot.player.driftAngle}\u00b0  r ${snapshot.player.driftRadius}m  pts ${snapshot.player.driftPoints}`,
    `camera ${snapshot.player.cameraHood ? 'HOOD' : 'CHASE'}  fov ${snapshot.player.cameraFov}  shake ${snapshot.player.cameraShake}  dist ${snapshot.player.cameraDistance}`,
    `score ${snapshot.score}  combo ×${snapshot.combo.multiplier.toFixed(2)}  boost ${snapshot.player.boost}`,
    `traffic ${snapshot.nearbyTraffic.length} nearby  max band ${snapshot.maxFormation}/5  rapier contacts ${rapierContactCount}`,
    `road ${snapshot.roadCoverage ? 'COVERED' : 'MISSING'}  ${snapshot.roadStartZ}..${snapshot.roadEndZ}  headlights ${snapshot.trafficHeadlightPools} pools + ${snapshot.trafficDynamicHeadlights} dynamic`,
    `impact ${snapshot.impactKind}  severity ${snapshot.impactSeverity}`,
    closest ? `closest #${closest.id}  dz ${closest.dz}  dx ${closest.dx}  ${closest.speedMps} m/s` : 'closest --',
    `keyboard ${debugLastKey}  events ${debugKeyEvents}`,
    debugDuplicateScore >= 0 ? `duplicate first score ${debugDuplicateScore} // current ${snapshot.score}` : '',
  ].filter(Boolean).join('\n');
}

function resize(): void {
  const renderScale = Number.parseFloat(renderScaleSelect.value);
  const mobileLayout = MOBILE_DEVICE && innerHeight > innerWidth;
  renderer.setPixelRatio(Math.min(devicePixelRatio * renderScale, mobileLayout ? 1 : 1.6));
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  renderer.getDrawingBufferSize(cameraPass.uniforms.uResolution.value);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  chaseCamera.setPortraitLayout(mobileLayout);
  document.documentElement.classList.toggle('mobile-portrait', mobileLayout);
}

window.addEventListener('resize', resize);
renderScaleSelect.addEventListener('change', resize);
trafficSelect.addEventListener('change', () => { traffic.density = Number.parseFloat(trafficSelect.value); });
engineSoundSelect.addEventListener('change', () => selectEngineOption(engineSoundSelect.value, true));
pauseEngineSoundSelect.addEventListener('change', () => selectEngineOption(pauseEngineSoundSelect.value, true));

const gameplayCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC']);
window.addEventListener('keydown', (event) => {
  if (gameplayCodes.has(event.code)) event.preventDefault();
  if (DEBUG) { debugLastKey = event.code; debugKeyEvents += 1; }
  if (event.repeat && ['Escape', 'KeyM', 'KeyR', 'KeyC'].includes(event.code)) return;
  if (mode === 'menu') {
    if (event.repeat && ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Enter', 'Space'].includes(event.code)) return;
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') { stepCarSelection(-1); return; }
    if (event.code === 'ArrowRight' || event.code === 'KeyD') { stepCarSelection(1); return; }
    if (event.code === 'Enter' || event.code === 'Space') { startRun(); return; }
  }
  if (mode === 'intro' && ['Enter', 'Space', 'Escape'].includes(event.code)) {
    event.preventDefault();
    skipRunIntro();
    return;
  }
  pressed.add(event.code);
  if (event.code === 'Escape') togglePause();
  if (event.code === 'KeyR') recoverCurrentVehicle();
  if (event.code === 'KeyC' && (mode === 'running' || mode === 'paused')) toggleCamera();
  if (event.code === 'KeyM') {
    const muted = audio.toggleMute();
    muteIndicator.classList.toggle('hidden', !muted);
  }
}, { passive: false });
window.addEventListener('keyup', (event) => { pressed.delete(event.code); });
window.addEventListener('blur', () => { clearMobileInput(); if (mode === 'running') togglePause(); });

for (const button of mobileControls.querySelectorAll<HTMLButtonElement>('[data-mobile-control]')) {
  const action = button.dataset.mobileControl as MobileControlAction;
  const release = (pointerId: number): void => {
    const active = mobilePointers.get(pointerId);
    if (!active) return;
    mobilePointers.delete(pointerId);
    const actionStillHeld = [...mobilePointers.values()].some((pointer) => pointer.action === active.action);
    const buttonStillHeld = [...mobilePointers.values()].some((pointer) => pointer.button === active.button);
    setMobileControl(mobileInput, active.action, actionStillHeld);
    const boostStillHeld = [...mobilePointers.values()].some((pointer) => pointer.action === 'boost' || pointer.boostSwipe);
    setMobileControl(mobileInput, 'boost', boostStillHeld);
    if (!buttonStillHeld) active.button.classList.remove('is-pressed');
    if (![...mobilePointers.values()].some((pointer) => pointer.button === active.button && pointer.boostSwipe)) {
      active.button.classList.remove('is-boosting');
    }
  };
  button.addEventListener('pointerdown', (event) => {
    if (!TOUCH_CAPABLE || mode !== 'running') return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    mobilePointers.set(event.pointerId, { action, button, startY: event.clientY, boostSwipe: false });
    setMobileControl(mobileInput, action, true);
    button.classList.add('is-pressed');
    if (action === 'boost') navigator.vibrate?.(12);
  });
  button.addEventListener('pointermove', (event) => {
    const active = mobilePointers.get(event.pointerId);
    if (!active) return;
    if (active.action === 'left' || active.action === 'right') {
      const steeringRow = button.closest<HTMLElement>('.mobile-arrow-row');
      if (!steeringRow) return;
      const bounds = steeringRow.getBoundingClientRect();
      const nextAction = steeringActionForPointerX(event.clientX, bounds.left, bounds.width);
      if (nextAction === active.action) return;
      const previousAction = active.action;
      const previousButton = active.button;
      const nextButton = steeringRow.querySelector<HTMLButtonElement>(`[data-mobile-control="${nextAction}"]`);
      if (!nextButton) return;
      active.action = nextAction;
      active.button = nextButton;
      const previousStillHeld = [...mobilePointers.values()].some((pointer) => pointer.action === previousAction);
      const previousButtonStillHeld = [...mobilePointers.values()].some((pointer) => pointer.button === previousButton);
      setMobileControl(mobileInput, previousAction, previousStillHeld);
      setMobileControl(mobileInput, nextAction, true);
      if (!previousButtonStillHeld) previousButton.classList.remove('is-pressed');
      nextButton.classList.add('is-pressed');
      return;
    }
    if (active.action !== 'throttle' || active.boostSwipe) return;
    if (!isBoostSwipe(active.startY, event.clientY)) return;
    active.boostSwipe = true;
    mobileSwipeBoostUntil = Math.max(mobileSwipeBoostUntil, runClock + .9);
    setMobileControl(mobileInput, 'boost', true);
    button.classList.add('is-boosting');
    navigator.vibrate?.([18, 22, 28]);
  });
  button.addEventListener('pointerup', (event) => release(event.pointerId));
  button.addEventListener('pointercancel', (event) => release(event.pointerId));
  button.addEventListener('lostpointercapture', (event) => release(event.pointerId));
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}
mobilePauseButton.addEventListener('click', () => { if (mode === 'running') togglePause(); });
mobileCameraButton.addEventListener('click', () => { if (mode === 'running') toggleCamera(); });
mobileRecoverButton.addEventListener('click', recoverCurrentVehicle);
mobileCalibrateButton.addEventListener('click', () => {
  if (mobileControlMode !== 'tilt') return;
  if (!tiltPermissionReady) void enableTiltSteering();
  else calibrateTiltSteering();
  showCallout('TILT CENTERED', '', .7);
});
mobileControlModeSelect.addEventListener('change', () => {
  applyMobileControlMode(mobileControlModeSelect.value === 'tilt' ? 'tilt' : 'buttons');
  if (mobileControlMode === 'tilt') void enableTiltSteering();
});
ditherCheckbox.addEventListener('change', () => {
  document.documentElement.classList.toggle('heavy-dither', ditherCheckbox.checked);
});

previousCarButton.addEventListener('click', () => stepCarSelection(-1));
nextCarButton.addEventListener('click', () => stepCarSelection(1));
carDragSurface.addEventListener('pointerdown', (event) => {
  if (mode !== 'menu') return;
  event.preventDefault();
  showroomDragging = true;
  showroomPointerId = event.pointerId;
  showroomLastPointerX = event.clientX;
  carDragSurface.classList.add('is-dragging');
  carDragSurface.setPointerCapture(event.pointerId);
});
carDragSurface.addEventListener('pointermove', (event) => {
  if (!showroomDragging || event.pointerId !== showroomPointerId) return;
  const movement = event.clientX - showroomLastPointerX;
  showroomLastPointerX = event.clientX;
  showroomYaw += movement * .012;
});
const releaseShowroomPointer = (event: PointerEvent): void => {
  if (event.pointerId !== showroomPointerId) return;
  showroomDragging = false;
  showroomPointerId = -1;
  showroomAutoResumeAt = performance.now() / 1000 + 2;
  carDragSurface.classList.remove('is-dragging');
};
carDragSurface.addEventListener('pointerup', releaseShowroomPointer);
carDragSurface.addEventListener('pointercancel', releaseShowroomPointer);
carDragSurface.addEventListener('lostpointercapture', releaseShowroomPointer);

startButton.addEventListener('click', startRun);
resumeButton.addEventListener('click', togglePause);
restartPauseButton.addEventListener('click', startRun);
quitButton.addEventListener('click', quitToMenu);
restartButton.addEventListener('click', startRun);
gameoverQuitButton.addEventListener('click', quitToMenu);

function frame(timeMs: number): void {
  const now = timeMs / 1000;
  const realDt = Math.min(.05, Math.max(0, now - lastTime));
  lastTime = now;
  fpsFrames += 1;
  fpsTimer += realDt;
  if (fpsTimer >= .5) { fps = fpsFrames / fpsTimer; fpsFrames = 0; fpsTimer = 0; }

  const fixedStep = 1 / 120;
  if (mode === 'intro' || mode === 'running' || mode === 'crashing') {
    const timeScale = mode === 'crashing' ? .28 : 1;
    accumulator += realDt * timeScale;
    let substeps = 0;
    while (accumulator >= fixedStep && substeps < 10) {
      simulate(fixedStep);
      accumulator -= fixedStep;
      substeps += 1;
    }
  }

  Object.assign(renderVehicle, vehicle);
  const renderAlpha = Math.min(1, Math.max(0, accumulator / fixedStep));
  renderVehicle.x = previousPose.x + (vehicle.x - previousPose.x) * renderAlpha;
  renderVehicle.z = previousPose.z + (vehicle.z - previousPose.z) * renderAlpha;
  const yawDelta = Math.atan2(Math.sin(vehicle.yaw - previousPose.yaw), Math.cos(vehicle.yaw - previousPose.yaw));
  renderVehicle.yaw = previousPose.yaw + yawDelta * renderAlpha;

  highway.update(vehicle.z);
  if (mode === 'menu') {
    updateShowroom(realDt, now);
  } else {
    playerCar.update(renderVehicle, getInput().brake > .1, realDt);
    chaseCamera.update(renderVehicle, realDt);
  }
  if (mode === 'intro') {
    const introFinished = runIntroCamera.update(renderVehicle, realDt, chaseCamera.getPose());
    if (runIntroCamera.getProgress() > .74) hud.classList.remove('cinematic');
    if (introFinished) setMode('running');
  }
  speedStreaks.update(renderVehicle, realDt);
  cityGlow.position.z = vehicle.z + 240;
  cityGlow.position.x = vehicle.x + 55;
  neutralFill.position.z = vehicle.z + 125;
  neutralFill.position.x = vehicle.x - 48;
  audio.update(vehicle, realDt, mode === 'intro' || mode === 'running', tunnelAcousticAmount(vehicle.z));
  if (mode !== 'menu') updateHud(realDt);
  updateDebug();
  bloomPass.enabled = bloomCheckbox.checked;
  cameraPass.uniforms.uTime.value = now;
  cameraPass.uniforms.uSpeed.value = Math.max(0, Math.min(1, (vehicle.speedMph - 70) / 110));
  cameraPass.uniforms.uImpact.value = mode === 'crashing' ? 1 : Math.max(0, Math.min(1, damageUntil - runClock));
  cameraPass.uniforms.uHeavyDither.value = ditherCheckbox.checked ? 1 : 0;
  composer.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
resize();
element('loading-stage').textContent = 'GARAGE READY / START YOUR RUN';
setTimeout(() => {
  loading.classList.add('fade');
  setTimeout(() => loading.classList.add('hidden'), 520);
  setMode('menu');
}, 420);
