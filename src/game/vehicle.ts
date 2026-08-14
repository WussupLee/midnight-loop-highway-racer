import { VEHICLE_ROAD_EDGE, clamp, roadCenterX, roadHeading } from './world';

export interface DriverInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  boost: boolean;
}

export interface VehicleTelemetry {
  speedMps: number;
  speedMph: number;
  longitudinalSpeed: number;
  lateralSpeed: number;
  rpm: number;
  gear: number;
  steerAngle: number;
  frontSlip: number;
  rearSlip: number;
  tireSlip: number;
  handbrakeActive: boolean;
  boostActive: boolean;
  boost: number;
  forceLongitudinal: number;
  forceLateral: number;
}

export interface VehicleState extends VehicleTelemetry {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  yawRate: number;
  steering: number;
  throttle: number;
  brake: number;
  lastLongAccel: number;
  shiftTimer: number;
  collisionCooldown: number;
}

export interface VehicleStepResult {
  barrierImpact: number;
}

// Slightly inset from the visible body so an apparent clean gap really is
// driveable. This matches the common traffic sedan more closely and leaves a
// forgiving margin for deliberate thread-the-needle passes.
export const PLAYER_COLLISION_HALF_WIDTH = .81;
export const PLAYER_COLLISION_HALF_LENGTH = 2.0;

// The chase camera looks toward +Z. In that view, world -X is screen-right,
// so digital right input must be negative in the vehicle's current basis.
export function digitalSteer(leftPressed: boolean, rightPressed: boolean): number {
  return Number(leftPressed) - Number(rightPressed);
}

const MASS = 1360;
const GRAVITY = 9.81;
const WHEELBASE = 2.62;
const FRONT_ARM = 1.08;
const REAR_ARM = WHEELBASE - FRONT_ARM;
const CG_HEIGHT = 0.47;
const YAW_INERTIA = 2250;
const WHEEL_RADIUS = 0.335;
const FINAL_DRIVE = 3.62;
const GEARS = [0, 3.31, 2.12, 1.52, 1.16, 0.91, 0.74];

export function torqueAtRpm(rpm: number): number {
  const points: [number, number][] = [
    [900, 185], [1800, 265], [3200, 355], [4700, 398], [6100, 372], [7200, 305], [7800, 0],
  ];
  for (let i = 1; i < points.length; i += 1) {
    if (rpm <= points[i][0]) {
      const [r0, t0] = points[i - 1];
      const [r1, t1] = points[i];
      return t0 + (t1 - t0) * ((rpm - r0) / (r1 - r0));
    }
  }
  return 0;
}

export function speedSensitiveSteer(speedMps: number): number {
  const t = clamp((Math.abs(speedMps) - 10) / 55, 0, 1);
  return (29 - 21.5 * t) * Math.PI / 180;
}

export function createVehicleState(): VehicleState {
  const z = 16;
  const heading = roadHeading(z);
  const speed = 35.8;
  return {
    x: roadCenterX(z), y: 0.55, z, yaw: heading,
    vx: Math.sin(heading) * speed, vz: Math.cos(heading) * speed, yawRate: 0,
    steering: 0, throttle: 0, brake: 0, lastLongAccel: 0, shiftTimer: 0,
    speedMps: speed, speedMph: speed * 2.236936, longitudinalSpeed: speed, lateralSpeed: 0,
    rpm: 4300, gear: 3, steerAngle: 0, frontSlip: 0, rearSlip: 0, tireSlip: 0,
    handbrakeActive: false, boostActive: false, boost: 0.55, forceLongitudinal: 0, forceLateral: 0,
    collisionCooldown: 0,
  };
}

function selectGear(state: VehicleState, dt: number): void {
  state.shiftTimer = Math.max(0, state.shiftTimer - dt);
  if (state.shiftTimer > 0) return;
  if (state.rpm > 7350 && state.gear < 6) {
    state.gear += 1;
    state.shiftTimer = 0.18;
  } else if (state.rpm < 2550 && state.gear > 1) {
    state.gear -= 1;
    state.shiftTimer = 0.14;
  }
}

export function applyCollisionImpulse(state: VehicleState, normalX: number, normalZ: number, severity: number, scrape = false): void {
  const alongNormal = state.vx * normalX + state.vz * normalZ;
  const impulse = scrape
    ? Math.max(1.1, severity * .14 + Math.abs(alongNormal) * .32)
    : Math.max(4, severity * 0.42 + Math.abs(alongNormal) * 0.72);
  state.vx -= normalX * impulse;
  state.vz -= normalZ * impulse;
  state.yawRate += scrape
    ? -Math.sign(normalX || 1) * Math.min(.13, severity * .006)
    : (Math.random() - 0.5) * Math.min(2.2, severity * 0.045);
  state.collisionCooldown = scrape ? .28 : .42;
}

export function recoverVehicle(state: VehicleState): void {
  const heading = roadHeading(state.z);
  const speed = clamp(state.longitudinalSpeed * 0.55, 22, 34);
  state.x = roadCenterX(state.z);
  state.yaw = heading;
  state.vx = Math.sin(heading) * speed;
  state.vz = Math.cos(heading) * speed;
  state.yawRate = 0;
  state.steering = 0;
}

export function stepVehicle(state: VehicleState, input: DriverInput, dt: number): VehicleStepResult {
  state.collisionCooldown = Math.max(0, state.collisionCooldown - dt);
  const sin = Math.sin(state.yaw);
  const cos = Math.cos(state.yaw);
  const rightX = cos;
  const rightZ = -sin;
  const u = state.vx * sin + state.vz * cos;
  const v = state.vx * rightX + state.vz * rightZ;
  const speed = Math.hypot(state.vx, state.vz);

  const highSpeedSteer = clamp((speed - 22) / 52, 0, 1);
  const over120Stability = input.handbrake ? 0 : clamp((speed - 53.64) / 18, 0, 1);
  // A keyboard reversal needs to pass through center promptly. A slow
  // left-to-right crossover leaves the front wheels pointing into the old
  // turn while the driver is already requesting the opposite lane, which
  // reads as the rear of the car whipping across the highway.
  const steeringInputReversal = !input.handbrake
    && Math.abs(input.steer) > .05
    && Math.abs(state.steering) > .05
    && Math.sign(input.steer) !== Math.sign(state.steering);
  const activeSteerRate = input.handbrake
    ? 3.85 - highSpeedSteer * .68
    : 3.8 - highSpeedSteer * .55 + (steeringInputReversal ? 5.8 : 0);
  const steerRate = input.steer === 0 ? 7.2 : activeSteerRate;
  state.steering += (input.steer - state.steering) * Math.min(1, steerRate * dt);
  state.throttle += (input.throttle - state.throttle) * Math.min(1, 7.2 * dt);
  state.brake += (input.brake - state.brake) * Math.min(1, 8 * dt);
  const maxSteer = speedSensitiveSteer(speed);
  const serviceBrakeStability = state.brake * (input.handbrake ? 0 : 1);
  const steerAngle = state.steering * maxSteer * (1 - serviceBrakeStability * .2);

  const wheelAngular = Math.max(0, Math.abs(u) / WHEEL_RADIUS);
  const ratio = GEARS[state.gear] * FINAL_DRIVE;
  const coupledRpm = wheelAngular * ratio * 60 / (2 * Math.PI);
  state.rpm = clamp(coupledRpm, 900, 7800);
  selectGear(state, dt);

  const boostActive = input.boost && state.boost > 0.01 && u > 14;
  state.boost = clamp(state.boost + (boostActive ? -0.19 : 0.012) * dt, 0, 1);
  const boostTorque = boostActive ? 1.34 : 1;
  const shiftCut = state.shiftTimer > 0 ? 0.22 : 1;
  // Stronger mid-speed pull makes a brake-and-pass move responsive without
  // changing the gearbox or replacing the force-based drivetrain. The small
  // recovery factor tapers away above highway passing speeds.
  const recoveryPull = 1 + state.throttle * clamp((47 - Math.abs(u)) / 32, 0, .14);
  let driveForce = torqueAtRpm(state.rpm) * ratio * 1.16 / WHEEL_RADIUS * state.throttle * boostTorque * shiftCut * recoveryPull;
  const reversing = state.brake > 0 && u < 1.5;
  if (reversing) driveForce = -3200 * state.brake;

  const serviceBrake = state.brake * (reversing ? 0 : 14500);
  const engineBrake = state.throttle < 0.08 && u > 1 ? 850 + Math.min(1250, state.rpm * 0.12) : 0;
  const signU = u === 0 ? 0 : Math.sign(u);
  const drag = 0.5 * 1.225 * 0.68 * u * Math.abs(u);
  const rolling = 0.014 * MASS * GRAVITY * signU;
  const frontLongDemand = -serviceBrake * 0.7 * signU;
  const rearLongDemand = driveForce - serviceBrake * 0.3 * signU - engineBrake * signU - drag - rolling;

  const accelGuess = state.lastLongAccel;
  const frontLoad = clamp(MASS * GRAVITY * REAR_ARM / WHEELBASE - MASS * accelGuess * CG_HEIGHT / WHEELBASE, MASS * GRAVITY * 0.25, MASS * GRAVITY * 0.72);
  const rearLoad = MASS * GRAVITY - frontLoad;
  const lateralTransfer = clamp(Math.abs(v) * speed * 7.5, 0, MASS * GRAVITY * 0.11);
  const frontMu = 1.12 - Math.min(0.11, lateralTransfer / (MASS * GRAVITY));
  const rearMu = (input.handbrake ? 0.64 : 1.46 + over120Stability * .12) - Math.min(0.055, lateralTransfer / (MASS * GRAVITY));

  const stableU = Math.max(4.2, Math.abs(u));
  const frontSlip = Math.atan2(v + FRONT_ARM * state.yawRate, stableU) - steerAngle;
  const rearSlip = Math.atan2(v - REAR_ARM * state.yawRate, stableU);
  const corneringScale = clamp(Math.abs(u) / 8, 0.22, 1);
  let frontLateral = -82000 * frontSlip * corneringScale;
  let rearLateral = -(input.handbrake ? 97000 : 112000 + over120Stability * 18000) * rearSlip * corneringScale;
  const frontCapacity = Math.sqrt(Math.max(0, (frontMu * frontLoad) ** 2 - frontLongDemand ** 2));
  const handbrakeLong = input.handbrake ? -Math.sign(u) * Math.min(5900, rearMu * rearLoad * 0.78) : 0;
  const rearLongTotal = rearLongDemand + handbrakeLong;
  const rearCapacity = Math.sqrt(Math.max(0, (rearMu * rearLoad) ** 2 - rearLongTotal ** 2));
  frontLateral = clamp(frontLateral, -frontCapacity, frontCapacity);
  rearLateral = clamp(rearLateral, -rearCapacity, rearCapacity);

  if (Math.abs(u) < 4) {
    const lowSpeedDamping = -v * MASS * 3.5;
    frontLateral = lowSpeedDamping * 0.55;
    rearLateral = lowSpeedDamping * 0.45;
  }

  const totalLong = frontLongDemand + rearLongTotal;
  const passiveHighSpeedStability = input.handbrake ? 0 : clamp((speed - 24) / 48, 0, 1);
  const steeringReversal = !input.handbrake && Math.abs(state.yawRate) > .03 && Math.sign(input.steer) === -Math.sign(state.yawRate);
  if (steeringReversal && Math.abs(state.steering) > .06) {
    // Keep the front axle authoritative during a high-speed direction change.
    // The blend remains inside the front tire's friction capacity, so this is
    // still a tire-force response rather than direct lateral translation.
    const requestedFrontForce = Math.sign(state.steering) * frontCapacity
      * clamp(.2 + Math.abs(state.steering) * .58, .2, .72);
    const counterSteerAuthority = .34 + over120Stability * .28;
    frontLateral += (requestedFrontForce - frontLateral) * counterSteerAuthority;
  }
  const bodySlipDampingScale = steeringReversal ? .46 : 1;
  const lateralStabilityForce = -v * MASS * (
    serviceBrakeStability * 1.25
    + (passiveHighSpeedStability * .42 + over120Stability * .52) * bodySlipDampingScale
  );
  const totalLateral = frontLateral + rearLateral + lateralStabilityForce;

  // Highway-speed trajectory assist. The tire model still supplies the
  // steering/yaw response, but keyboard steering also asks for a bounded
  // lateral road velocity. This is the same kind of stability layer used by
  // arcade racers to prevent the rear axle's old momentum from carrying the
  // car across another lane after the driver has reversed direction.
  // Handbrake input removes the assist completely so deliberate drifting
  // retains its loose rear-axle behaviour.
  const roadYaw = roadHeading(state.z);
  const roadRightX = Math.cos(roadYaw);
  const roadRightZ = -Math.sin(roadYaw);
  const roadLateralSpeed = state.vx * roadRightX + state.vz * roadRightZ;
  const arcadeStability = input.handbrake ? 0 : clamp((speed - 34) / 30, 0, 1);
  const immediateCommand = Math.abs(input.steer) > .05
    ? input.steer * .7 + state.steering * .3
    : state.steering;
  const desiredRoadLateralSpeed = immediateCommand * (3.7 + arcadeStability * 2.35);
  const reversingRoadDirection = arcadeStability > .25
    && Math.abs(input.steer) > .05
    && input.steer * roadLateralSpeed < -.2;
  const trajectoryAccelLimit = reversingRoadDirection ? 13.25 : 7.25;
  const trajectoryAccel = clamp(
    (desiredRoadLateralSpeed - roadLateralSpeed) * (1.35 + arcadeStability * 2.15),
    -trajectoryAccelLimit,
    trajectoryAccelLimit,
  ) * arcadeStability;
  const ax = (sin * totalLong + rightX * totalLateral) / MASS + roadRightX * trajectoryAccel;
  const az = (cos * totalLong + rightZ * totalLateral) / MASS + roadRightZ * trajectoryAccel;
  state.vx += ax * dt;
  state.vz += az * dt;

  const yawTorque = FRONT_ARM * frontLateral - REAR_ARM * rearLateral;
  const yawLimit = input.handbrake
    ? 1.62 - highSpeedSteer * .42
    : (.91 - highSpeedSteer * .71) * (1 - over120Stability * .34) * (1 - serviceBrakeStability * .34);
  const desiredYawRate = clamp(
    Math.abs(u) / WHEELBASE * Math.tan(steerAngle),
    -yawLimit,
    yawLimit,
  );
  const yawControlGain = input.handbrake
    ? 0
    : 3900 + highSpeedSteer * 3300 + over120Stability * 4600 + serviceBrakeStability * 9800 + (steeringReversal ? 6200 : 0);
  const yawControlTorque = (desiredYawRate - state.yawRate) * yawControlGain;
  const yawDamping = state.yawRate * (
    1950 + speed * 48 + over120Stability * 3600 + (steeringReversal ? 2400 : 0) + serviceBrakeStability * (3000 + speed * 38)
  );
  state.yawRate += (yawTorque + yawControlTorque - yawDamping) / YAW_INERTIA * dt;
  state.yawRate = clamp(state.yawRate, -yawLimit, yawLimit);
  state.yaw += state.yawRate * dt;
  state.x += state.vx * dt;
  state.z += state.vz * dt;

  let barrierImpact = 0;
  const center = roadCenterX(state.z);
  const lateralOffset = state.x - center;
  if (Math.abs(lateralOffset) > VEHICLE_ROAD_EDGE) {
    const side = Math.sign(lateralOffset);
    barrierImpact = Math.abs(v) * 7 + Math.max(0, speed - 24) * 0.32;
    state.x = center + side * VEHICLE_ROAD_EDGE;
    const roadYaw = roadHeading(state.z);
    const nx = Math.cos(roadYaw) * side;
    const nz = -Math.sin(roadYaw) * side;
    const vn = state.vx * nx + state.vz * nz;
    if (vn > 0) {
      state.vx -= nx * vn * 1.42;
      state.vz -= nz * vn * 1.42;
      state.yawRate -= side * Math.min(1.4, vn * 0.075);
    }
  }

  const nextSin = Math.sin(state.yaw);
  const nextCos = Math.cos(state.yaw);
  const nextRightX = nextCos;
  const nextRightZ = -nextSin;
  const nextU = state.vx * nextSin + state.vz * nextCos;
  const nextV = state.vx * nextRightX + state.vz * nextRightZ;
  state.lastLongAccel = totalLong / MASS;
  state.speedMps = Math.hypot(state.vx, state.vz);
  state.speedMph = state.speedMps * 2.236936;
  state.longitudinalSpeed = nextU;
  state.lateralSpeed = nextV;
  state.rpm = clamp(Math.abs(nextU) / WHEEL_RADIUS * GEARS[state.gear] * FINAL_DRIVE * 60 / (2 * Math.PI), 900, 7800);
  state.steerAngle = steerAngle;
  state.frontSlip = frontSlip;
  state.rearSlip = rearSlip;
  state.tireSlip = clamp((Math.abs(frontSlip) + Math.abs(rearSlip)) / 0.42, 0, 2);
  state.handbrakeActive = input.handbrake;
  state.boostActive = boostActive;
  state.forceLongitudinal = totalLong;
  state.forceLateral = totalLateral;
  return { barrierImpact };
}
