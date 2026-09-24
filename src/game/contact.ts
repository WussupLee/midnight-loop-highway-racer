export interface CarFootprint {
  x: number; z: number; yaw: number; halfWidth: number; halfLength: number; vx: number; vz: number;
}
export interface CarContact {
  normalX: number; normalZ: number; penetration: number; closingSpeed: number; scrape: boolean; lever: number;
}
/** Four-axis SAT plus a swept interval test using relative motion over one tick. */
export function carContact(a: CarFootprint, b: CarFootprint, dt = 0): CarContact | null {
  const axes = [a.yaw, b.yaw].flatMap(y => [[Math.cos(y), -Math.sin(y)], [Math.sin(y), Math.cos(y)]]);
  const radius = (car: CarFootprint, x: number, z: number) => Math.abs(x * Math.cos(car.yaw) - z * Math.sin(car.yaw)) * car.halfWidth + Math.abs(x * Math.sin(car.yaw) + z * Math.cos(car.yaw)) * car.halfLength;
  let penetration = Infinity, nx = 0, nz = 0, touching = true, entry = 0, exit = 1, sweepX = 0, sweepZ = 0;
  for (const [x, z] of axes) {
    const extent = radius(a, x, z) + radius(b, x, z);
    const delta = (a.x - b.x) * x + (a.z - b.z) * z;
    const overlap = extent - Math.abs(delta);
    if (overlap < 0) touching = false;
    if (overlap < penetration) { penetration = overlap; nx = -Math.sign(delta || 1) * x; nz = -Math.sign(delta || 1) * z; }
    const motion = ((a.vx - b.vx) * x + (a.vz - b.vz) * z) * dt;
    const start = delta - motion;
    if (Math.abs(motion) < 1e-9) { if (Math.abs(start) > extent) exit = -1; }
    else {
      const t1 = (-extent - start) / motion, t2 = (extent - start) / motion;
      const first = Math.min(t1, t2), last = Math.max(t1, t2);
      if (first > entry) { entry = first; sweepX = Math.sign(motion) * x; sweepZ = Math.sign(motion) * z; }
      exit = Math.min(exit, last);
    }
  }
  if (!touching) {
    if (dt <= 0 || entry > exit || entry < 0 || entry > 1 || (sweepX === 0 && sweepZ === 0)) return null;
    nx = sweepX; nz = sweepZ;
    penetration = Math.max(0, ((a.vx - b.vx) * nx + (a.vz - b.vz) * nz) * dt * (1 - entry));
  }
  const closingSpeed = Math.max(0, (a.vx - b.vx) * nx + (a.vz - b.vz) * nz);
  const sideContact = Math.abs(nx * Math.cos(a.yaw) - nz * Math.sin(a.yaw)) > .7;
  const cx = Math.max(-a.halfLength, Math.min(a.halfLength, (b.x - a.x) * Math.sin(a.yaw) + (b.z - a.z) * Math.cos(a.yaw)));
  const lateralNormal = nx * Math.cos(a.yaw) - nz * Math.sin(a.yaw);
  return { normalX: nx, normalZ: nz, penetration: Math.max(0, penetration) + .015, closingSpeed, scrape: sideContact && closingSpeed < 7, lever: -cx * lateralNormal * .25 };
}
