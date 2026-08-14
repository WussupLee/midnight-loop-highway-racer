import * as THREE from 'three';

export const LANE_WIDTH = 3.65;
export const LANE_OFFSETS = [-7.3, -3.65, 0, 3.65, 7.3] as const;
export const LANE_COUNT = LANE_OFFSETS.length;
export const ROAD_HALF_WIDTH = 11.95;
export const VEHICLE_ROAD_EDGE = 10.32;
export const ROAD_MARK_SPACING = 10;
export const OUTER_EDGE_LINE_SEGMENT_LENGTH = 10.4;
export const TUNNEL_CEILING_LIGHT_COLOR = 0xffa64b;
export const TUNNEL_AMBIENT_COLOR = 0x36c9c1;
export const TUNNEL_CEILING_LIGHT_HEIGHT = 6.18;
export const TUNNEL_UNIFORM_FILL_INTENSITY = .78;
export const ROAD_CURVE_CELL_LENGTH = 900;

export function isTunnelChunkNumber(chunkNumber: number): boolean {
  const phase = Math.abs(chunkNumber % 13);
  return phase === 7 || phase === 8;
}

interface RoadCurveCell {
  start: number;
  duration: number;
  shift: number;
}

let roadRouteSeed = 481516;
let roadCurveCells: RoadCurveCell[] = [];
let roadCurveOffsets: number[] = [0];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function seeded(seed: number): () => number {
  let value = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function configureRoadRoute(seed: number): number {
  roadRouteSeed = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  roadCurveCells = [];
  roadCurveOffsets = [0];
  return roadRouteSeed;
}

export function getRoadRouteSeed(): number {
  return roadRouteSeed;
}

function smootherStep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function ensureRoadCurveCell(index: number): void {
  while (roadCurveCells.length <= index) {
    const cellIndex = roadCurveCells.length;
    const random = seeded(roadRouteSeed + (cellIndex + 1) * 104729);
    const previousOffset = roadCurveOffsets[cellIndex];
    const wantsCurve = random() < .68;
    let direction = random() < .5 ? -1 : 1;
    if (previousOffset > 42) direction = -1;
    else if (previousOffset < -42) direction = 1;
    const magnitude = 23 + random() * 15;
    const start = 255 + random() * 85;
    const duration = 390 + random() * 75;
    const globalStart = cellIndex * ROAD_CURVE_CELL_LENGTH + start;
    const firstChunk = Math.floor(globalStart / 150);
    const lastChunk = Math.floor((globalStart + duration) / 150);
    let crossesTunnel = false;
    for (let chunk = firstChunk; chunk <= lastChunk; chunk += 1) {
      if (isTunnelChunkNumber(chunk)) crossesTunnel = true;
    }
    const shift = wantsCurve && !crossesTunnel ? direction * magnitude : 0;
    roadCurveCells.push({
      start,
      duration,
      shift,
    });
    roadCurveOffsets.push(previousOffset + shift);
  }
}

export function roadCenterX(z: number): number {
  if (z <= 0) return 0;
  const cellIndex = Math.floor(z / ROAD_CURVE_CELL_LENGTH);
  ensureRoadCurveCell(cellIndex);
  const curve = roadCurveCells[cellIndex];
  const localZ = z - cellIndex * ROAD_CURVE_CELL_LENGTH;
  const progress = (localZ - curve.start) / curve.duration;
  return roadCurveOffsets[cellIndex] + curve.shift * smootherStep(progress);
}

export function roadCenterY(z: number): number {
  return 0.36 * Math.sin(z / 380) + 0.2 * Math.sin(z / 145 + 1.3);
}

export function roadHeading(z: number): number {
  const epsilon = 0.5;
  return Math.atan2(roadCenterX(z + epsilon) - roadCenterX(z - epsilon), epsilon * 2);
}

export function laneX(z: number, lane: number): number {
  const offset = LANE_OFFSETS[Math.round(clamp(lane, 0, LANE_COUNT - 1))];
  return roadCenterX(z) + Math.cos(roadHeading(z)) * offset;
}

export function routeSector(z: number): string {
  const sectors = ['DOWNTOWN SPUR', 'MERCER DISTRICT', 'EASTBOUND TUNNEL', 'FREIGHT YARDS', 'NORTH INTERCHANGE', 'AIRPORT LOOP'];
  return sectors[Math.abs(Math.floor(z / 850)) % sectors.length];
}

export function highwayChunkStartFor(playerZ: number, chunkLength = 150): number {
  return Math.floor((playerZ - 300) / chunkLength) * chunkLength;
}

function createAsphaltTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#171717';
  context.fillRect(0, 0, 256, 256);
  const random = seeded(9462);
  for (let i = 0; i < 15500; i += 1) {
    const shade = Math.floor(16 + random() * 32);
    context.fillStyle = `rgba(${shade + 3},${shade + 2},${shade},${0.08 + random() * 0.18})`;
    const size = random() < 0.92 ? 1 : 2;
    context.fillRect(random() * 256, random() * 256, size, size);
  }
  for (let i = 0; i < 16; i += 1) {
    context.fillStyle = `rgba(2,5,8,${0.04 + random() * 0.06})`;
    context.fillRect(random() * 256, 0, 1 + random() * 3, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 20);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFullMoonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, 512, 512);
  context.save();
  context.beginPath();
  context.arc(256, 256, 184, 0, Math.PI * 2);
  context.clip();
  const surface = context.createRadialGradient(202, 188, 26, 256, 256, 198);
  surface.addColorStop(0, '#fffbe8');
  surface.addColorStop(.48, '#e7e2ce');
  surface.addColorStop(.82, '#b9b8ad');
  surface.addColorStop(1, '#777a76');
  context.fillStyle = surface;
  context.fillRect(60, 60, 392, 392);

  const maria = [
    [183, 206, 55, .2], [309, 171, 42, .18], [295, 293, 66, .22],
    [203, 326, 37, .16], [347, 248, 27, .17], [237, 154, 22, .14],
  ];
  for (const [x, y, radius, opacity] of maria) {
    const shade = context.createRadialGradient(x, y, radius * .1, x, y, radius);
    shade.addColorStop(0, `rgba(71,76,77,${opacity})`);
    shade.addColorStop(.7, `rgba(88,91,88,${opacity * .72})`);
    shade.addColorStop(1, 'rgba(90,92,90,0)');
    context.fillStyle = shade;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const random = seeded(67291);
  for (let index = 0; index < 46; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 158;
    const x = 256 + Math.cos(angle) * distance;
    const y = 256 + Math.sin(angle) * distance;
    const radius = 2.5 + random() * 10;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(57,62,62,${.12 + random() * .14})`;
    context.fill();
    context.beginPath();
    context.arc(x - radius * .22, y - radius * .25, radius * .72, Math.PI * 1.05, Math.PI * 1.88);
    context.strokeStyle = `rgba(255,252,229,${.13 + random() * .14})`;
    context.lineWidth = Math.max(1, radius * .18);
    context.stroke();
  }
  context.restore();
  const rim = context.createRadialGradient(256, 256, 160, 256, 256, 190);
  rim.addColorStop(0, 'rgba(255,255,245,0)');
  rim.addColorStop(.83, 'rgba(255,248,220,.18)');
  rim.addColorStop(1, 'rgba(255,248,220,0)');
  context.fillStyle = rim;
  context.beginPath();
  context.arc(256, 256, 192, 0, Math.PI * 2);
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createMoonHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const halo = context.createRadialGradient(128, 128, 7, 128, 128, 126);
  halo.addColorStop(0, 'rgba(224,240,255,.72)');
  halo.addColorStop(.2, 'rgba(174,207,232,.34)');
  halo.addColorStop(.55, 'rgba(111,151,185,.09)');
  halo.addColorStop(1, 'rgba(70,100,130,0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d')!;
  const lobes = [
    [82, 111, 76], [142, 86, 91], [218, 105, 112], [304, 78, 102], [384, 105, 94], [452, 91, 64],
  ];
  for (const [x, y, radius] of lobes) {
    const gradient = context.createRadialGradient(x, y, radius * .08, x, y, radius);
    gradient.addColorStop(0, 'rgba(235,242,245,.9)');
    gradient.addColorStop(.45, 'rgba(195,207,214,.55)');
    gradient.addColorStop(1, 'rgba(130,145,154,0)');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function setInstance(instance: THREE.InstancedMesh, index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0): void {
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(sx, sy, sz));
  instance.setMatrixAt(index, matrix);
}

export function createTunnelArchGeometry(length: number, halfWidth = 12.9, height = 6.8, segments = 24): THREE.BufferGeometry {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const angle = progress * Math.PI;
    const x = Math.cos(angle) * halfWidth;
    const y = Math.sin(angle) * height;
    vertices.push(x, y, -length / 2, x, y, length / 2);
    uvs.push(progress, 0, progress, 1);
    if (index < segments) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createTunnelRibGeometry(length: number, halfWidth = 12.82, height = 6.74, archSegments = 24, ribCount = 9): THREE.BufferGeometry {
  const vertices: number[] = [];
  for (let rib = 0; rib < ribCount; rib += 1) {
    const z = -length / 2 + 8 + rib * ((length - 16) / Math.max(1, ribCount - 1));
    for (let segment = 0; segment < archSegments; segment += 1) {
      const firstAngle = segment / archSegments * Math.PI;
      const secondAngle = (segment + 1) / archSegments * Math.PI;
      vertices.push(
        Math.cos(firstAngle) * halfWidth, Math.sin(firstAngle) * height, z,
        Math.cos(secondAngle) * halfWidth, Math.sin(secondAngle) * height, z,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

interface Chunk {
  group: THREE.Group;
  startZ: number;
  endZ: number;
}

export interface HighwaySignDescriptor {
  exitNumber: number;
  streetName: string;
  side: 'left' | 'right';
}

const HIGHWAY_STREET_NAMES = [
  'MERCER AVE', 'HARBOR BLVD', 'WESTGATE WAY', 'CYPRESS ST',
  'AIRPORT DR', 'RIVERLINE RD', 'SUMMIT AVE', 'BELMONT ST',
  'ASHLAND WAY', 'COMMERCE BLVD', 'LAUREL AVE', 'FAIRVIEW RD',
] as const;

export function highwaySignIndex(chunkNumber: number): number | null {
  const normalized = ((chunkNumber % 7) + 7) % 7;
  if (chunkNumber < 2 || normalized !== 2) return null;
  return Math.floor((chunkNumber - 2) / 7);
}

export function highwaySignDescriptor(index: number): HighwaySignDescriptor {
  const safeIndex = Math.max(0, Math.floor(index));
  const exitRandom = seeded(50491);
  let exitNumber = 50;
  for (let step = 0; step < safeIndex; step += 1) exitNumber += 1 + Math.floor(exitRandom() * 3);
  const detailRandom = seeded(7193 + safeIndex * 7919);
  return {
    exitNumber,
    streetName: HIGHWAY_STREET_NAMES[Math.floor(detailRandom() * HIGHWAY_STREET_NAMES.length)],
    side: detailRandom() < .5 ? 'left' : 'right',
  };
}

function createFreewaySignMaterial(descriptor: HighwaySignDescriptor): THREE.MeshBasicMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 336;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#08704b';
  context.beginPath();
  context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 18);
  context.fill();
  context.strokeStyle = '#f2f4ea';
  context.lineWidth = 9;
  context.stroke();
  context.beginPath();
  context.moveTo(10, 92);
  context.lineTo(canvas.width - 10, 92);
  context.lineWidth = 7;
  context.stroke();
  context.fillStyle = '#f6f7ef';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '700 60px "Arial Narrow", "DIN Condensed", Arial, sans-serif';
  context.fillText(`EXIT  ${descriptor.exitNumber}`, canvas.width / 2, 51);
  context.font = '600 67px "Arial Narrow", "DIN Condensed", Arial, sans-serif';
  context.fillText(descriptor.streetName, canvas.width / 2, 157);

  const arrowDirection = descriptor.side === 'right' ? 1 : -1;
  const startX = canvas.width / 2 - arrowDirection * 34;
  const startY = 286;
  const endX = canvas.width / 2 + arrowDirection * 72;
  const endY = 211;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.strokeStyle = '#f6f7ef';
  context.lineWidth = 28;
  context.lineCap = 'square';
  context.stroke();
  context.beginPath();
  context.moveTo(endX, endY);
  context.lineTo(endX - arrowDirection * 58, endY + 3);
  context.moveTo(endX, endY);
  context.lineTo(endX - arrowDirection * 7, endY + 58);
  context.lineWidth = 25;
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
}

export class HighwayWorld {
  readonly group = new THREE.Group();
  readonly skyline = new THREE.Group();
  private readonly celestial = new THREE.Group();
  private readonly chunks: Chunk[] = [];
  private readonly chunkLength = 150;
  private readonly chunkCount = 28;
  private nextStartZ = 0;
  private readonly roadMaterial: THREE.MeshStandardMaterial;
  private readonly tunnelRoadMaterial: THREE.MeshStandardMaterial;
  private readonly tunnelAmbient = new THREE.HemisphereLight(TUNNEL_AMBIENT_COLOR, 0x12383a, 0);
  private readonly shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0x121211, roughness: 0.76, metalness: 0.1, side: THREE.DoubleSide });
  private readonly laneMaterial = new THREE.MeshStandardMaterial({ color: 0xd4d2c8, emissive: 0x8d8a78, emissiveIntensity: 1.18, roughness: 0.4, metalness: 0.12 });
  private readonly barrierMaterial = new THREE.MeshStandardMaterial({ color: 0x595956, roughness: 0.82, metalness: 0.06 });
  private readonly buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x101112, emissive: 0x090908, emissiveIntensity: 0.288, roughness: 0.86 });
  private readonly sodiumMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3.4, 2.05, .76), toneMapped: false });
  private readonly neutralLightMaterial = new THREE.MeshBasicMaterial({ color: 0xe5e2d4, toneMapped: false });

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    const asphalt = createAsphaltTexture(renderer);
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x090a0a,
      map: asphalt,
      roughness: 0.58,
      metalness: 0.16,
      envMapIntensity: 0.09,
      side: THREE.DoubleSide,
    });
    this.tunnelRoadMaterial = new THREE.MeshStandardMaterial({
      color: 0x102a2c,
      map: asphalt,
      emissive: 0x0a5558,
      emissiveIntensity: .92,
      roughness: .68,
      metalness: .1,
      envMapIntensity: .12,
      side: THREE.DoubleSide,
    });
    scene.add(this.group, this.skyline, this.celestial, this.tunnelAmbient);
    this.buildDistantSkyline();
    this.reset(16);
  }

  reset(playerZ: number, forceRebuild = false): void {
    if (!forceRebuild && this.chunks.length > 0 && this.covers(playerZ)) {
      this.skyline.position.z = Math.floor(playerZ / 800) * 800;
      this.tunnelAmbient.intensity = isTunnelChunkNumber(Math.floor(playerZ / this.chunkLength)) ? TUNNEL_UNIFORM_FILL_INTENSITY : 0;
      this.updateCelestial(playerZ);
      return;
    }
    for (const chunk of this.chunks) {
      this.group.remove(chunk.group);
      this.disposeChunk(chunk.group);
    }
    this.chunks.length = 0;

    const firstStartZ = highwayChunkStartFor(playerZ, this.chunkLength);
    this.nextStartZ = firstStartZ;
    for (let index = 0; index < this.chunkCount; index += 1) {
      const chunk = this.buildChunk(this.nextStartZ);
      this.chunks.push(chunk);
      this.group.add(chunk.group);
      this.nextStartZ = chunk.endZ;
    }
    this.skyline.position.z = Math.floor(playerZ / 800) * 800;
    this.tunnelAmbient.intensity = isTunnelChunkNumber(Math.floor(playerZ / this.chunkLength)) ? TUNNEL_UNIFORM_FILL_INTENSITY : 0;
    this.updateCelestial(playerZ);
  }

  covers(z: number): boolean {
    return this.chunks.some((chunk) => chunk.startZ <= z && chunk.endZ >= z);
  }

  getChunkRange(): { startZ: number; endZ: number } {
    return {
      startZ: Math.min(...this.chunks.map((chunk) => chunk.startZ)),
      endZ: Math.max(...this.chunks.map((chunk) => chunk.endZ)),
    };
  }

  update(playerZ: number): void {
    for (const chunk of this.chunks) {
      if (chunk.endZ < playerZ - 330) {
        this.group.remove(chunk.group);
        this.disposeChunk(chunk.group);
        const replacement = this.buildChunk(this.nextStartZ);
        chunk.group = replacement.group;
        chunk.startZ = replacement.startZ;
        chunk.endZ = replacement.endZ;
        this.nextStartZ = replacement.endZ;
        this.group.add(chunk.group);
      }
    }
    this.skyline.position.z = Math.floor(playerZ / 800) * 800;
    const tunnelTarget = isTunnelChunkNumber(Math.floor(playerZ / this.chunkLength)) ? TUNNEL_UNIFORM_FILL_INTENSITY : 0;
    this.tunnelAmbient.intensity += (tunnelTarget - this.tunnelAmbient.intensity) * .08;
    this.updateCelestial(playerZ);
  }

  private updateCelestial(playerZ: number): void {
    this.celestial.position.set(roadCenterX(playerZ), 0, playerZ);
    this.celestial.rotation.y = roadHeading(playerZ);
  }

  private disposeChunk(group: THREE.Group): void {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();

      if (object instanceof THREE.Mesh && object.userData.disposeMaterial) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          const mappedMaterial = material as THREE.Material & { map?: THREE.Texture | null };
          mappedMaterial.map?.dispose();
          mappedMaterial.dispose();
        }
      }
    });
  }

  private buildChunk(startZ: number): Chunk {
    const group = new THREE.Group();
    group.name = `highway-${Math.floor(startZ)}`;
    const endZ = startZ + this.chunkLength;
    const subdivisions = 18;
    const roadVertices: number[] = [];
    const roadUvs: number[] = [];
    const roadIndices: number[] = [];
    const shoulderVertices: number[] = [];
    const shoulderUvs: number[] = [];
    const shoulderIndices: number[] = [];

    for (let i = 0; i <= subdivisions; i += 1) {
      const z = startZ + this.chunkLength * (i / subdivisions);
      const centerX = roadCenterX(z);
      const centerY = roadCenterY(z);
      const heading = roadHeading(z);
      const nx = Math.cos(heading);
      for (const side of [-1, 1]) {
        roadVertices.push(centerX + nx * ROAD_HALF_WIDTH * side, centerY, z);
        roadUvs.push(side < 0 ? 0 : 1, i / subdivisions * 4);
        shoulderVertices.push(centerX + nx * (ROAD_HALF_WIDTH + 1.3) * side, centerY - 0.015, z);
        shoulderUvs.push(side < 0 ? 0 : 1, i / subdivisions * 4);
      }
      if (i < subdivisions) {
        const a = i * 2;
        roadIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        shoulderIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const roadGeometry = new THREE.BufferGeometry();
    roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadVertices, 3));
    roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeometry.setIndex(roadIndices);
    roadGeometry.computeVertexNormals();
    const chunkNumber = Math.floor(startZ / this.chunkLength);
    const road = new THREE.Mesh(roadGeometry, isTunnelChunkNumber(chunkNumber) ? this.tunnelRoadMaterial : this.roadMaterial);
    road.frustumCulled = false;
    road.renderOrder = -2;
    group.add(road);

    const shoulderGeometry = new THREE.BufferGeometry();
    shoulderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shoulderVertices, 3));
    shoulderGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(shoulderUvs, 2));
    shoulderGeometry.setIndex(shoulderIndices);
    shoulderGeometry.computeVertexNormals();
    const shoulder = new THREE.Mesh(shoulderGeometry, this.shoulderMaterial);
    shoulder.frustumCulled = false;
    shoulder.renderOrder = -3;
    group.add(shoulder);

    const markGeometry = new THREE.BoxGeometry(0.13, 0.025, 3.5);
    const laneDividers = [-5.475, -1.825, 1.825, 5.475];
    const markCount = laneDividers.length * 15;
    const marks = new THREE.InstancedMesh(markGeometry, this.laneMaterial, markCount);
    const outerEdgeGeometry = new THREE.BoxGeometry(0.19, 0.03, OUTER_EDGE_LINE_SEGMENT_LENGTH);
    const leftEdgeMarks = new THREE.InstancedMesh(outerEdgeGeometry, this.laneMaterial, 15);
    const rightEdgeMarks = new THREE.InstancedMesh(outerEdgeGeometry.clone(), this.laneMaterial, 15);
    let markIndex = 0;
    for (let i = 0; i < 15; i += 1) {
      const z = startZ + ROAD_MARK_SPACING * .5 + i * ROAD_MARK_SPACING;
      const heading = roadHeading(z);
      const centerX = roadCenterX(z);
      const y = roadCenterY(z) + 0.025;
      const nx = Math.cos(heading);
      for (const offset of laneDividers) {
        setInstance(marks, markIndex++, centerX + nx * offset, y, z, 1, 1, 1, heading);
      }
      setInstance(leftEdgeMarks, i, centerX - nx * 9.18, y + 0.002, z, 1, 1, 1, heading);
      setInstance(rightEdgeMarks, i, centerX + nx * 9.18, y + 0.002, z, 1, 1, 1, heading);
    }
    marks.instanceMatrix.needsUpdate = true;
    leftEdgeMarks.instanceMatrix.needsUpdate = true;
    rightEdgeMarks.instanceMatrix.needsUpdate = true;
    group.add(marks, leftEdgeMarks, rightEdgeMarks);

    const wetSheen = new THREE.InstancedMesh(
      new THREE.BoxGeometry(.22, .012, 8),
      new THREE.MeshBasicMaterial({ color: 0xd8c49b, transparent: true, opacity: .037, depthWrite: false, blending: THREE.AdditiveBlending }),
      16,
    );
    for (let i = 0; i < 16; i += 1) {
      const z = startZ + 5 + i * 9;
      const heading = roadHeading(z);
      const offset = LANE_OFFSETS[i % LANE_COUNT];
      setInstance(wetSheen, i, roadCenterX(z) + Math.cos(heading) * offset, roadCenterY(z) + .018, z, 1, 1, 1, heading);
    }
    wetSheen.instanceMatrix.needsUpdate = true;
    group.add(wetSheen);

    const barrierCount = 20;
    const barrierBases = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.barrierMaterial, barrierCount);
    const barrierTops = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.barrierMaterial, barrierCount);
    const reflectors = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .09, .28), this.neutralLightMaterial, barrierCount);
    for (let i = 0; i < 10; i += 1) {
      const z = startZ + 7.5 + i * 15;
      const heading = roadHeading(z);
      const nx = Math.cos(heading);
      const roadY = roadCenterY(z);
      for (const side of [-1, 1]) {
        const index = i * 2 + (side > 0 ? 1 : 0);
        const barrierX = roadCenterX(z) + nx * 11.62 * side;
        setInstance(barrierBases, index, barrierX, roadY + .3, z, .72, .58, 14.72, heading);
        setInstance(barrierTops, index, barrierX, roadY + .72, z, .42, .48, 14.7, heading);
        setInstance(reflectors, index, roadCenterX(z) + nx * 11.34 * side, roadY + .68, z - 4.2, 1, 1, 1, heading);
      }
    }
    barrierBases.instanceMatrix.needsUpdate = true;
    barrierTops.instanceMatrix.needsUpdate = true;
    reflectors.instanceMatrix.needsUpdate = true;
    group.add(barrierBases, barrierTops, reflectors);

    this.addRoadside(group, startZ, endZ);
    return { group, startZ, endZ };
  }

  private addRoadside(group: THREE.Group, startZ: number, endZ: number): void {
    const random = seeded(startZ * 77 + 43);
    const centerZ = (startZ + endZ) / 2;
    const chunkNumber = Math.floor(startZ / this.chunkLength);
    const inTunnel = isTunnelChunkNumber(chunkNumber);

    if (inTunnel) {
      const centerX = roadCenterX(centerZ);
      const heading = roadHeading(centerZ);
      const tunnelBaseY = roadCenterY(centerZ) + .42;
      const shellMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a3738,
        emissive: 0x087174,
        emissiveIntensity: 1.08,
        roughness: .9,
        metalness: .05,
        side: THREE.DoubleSide,
      });
      const shell = new THREE.Mesh(createTunnelArchGeometry(this.chunkLength + 2), shellMaterial);
      shell.position.set(centerX, tunnelBaseY, centerZ);
      shell.rotation.y = heading;
      shell.receiveShadow = true;
      const ribs = new THREE.LineSegments(
        createTunnelRibGeometry(this.chunkLength + 1),
        new THREE.LineBasicMaterial({ color: 0x426667, transparent: true, opacity: .48 }),
      );
      ribs.position.copy(shell.position);
      ribs.rotation.copy(shell.rotation);
      group.add(shell, ribs);
      const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.06, 4.5), this.sodiumMaterial, 14);
      const tunnelLightGlows = new THREE.InstancedMesh(
        new THREE.BoxGeometry(.72, .08, 5.6),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(TUNNEL_CEILING_LIGHT_COLOR).multiplyScalar(2.4), transparent: true,
          opacity: .18, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        }),
        14,
      );
      for (let i = 0; i < 7; i += 1) {
        const z = startZ + 11 + i * 21;
        const h = roadHeading(z);
        const nx = Math.cos(h);
        for (const side of [-1, 1]) {
          const index = i * 2 + (side > 0 ? 1 : 0);
          const x = roadCenterX(z) + nx * side * 6.2;
          const ceilingY = roadCenterY(z) + TUNNEL_CEILING_LIGHT_HEIGHT;
          setInstance(lights, index, x, ceilingY, z, 1, 1, 1, h);
          setInstance(tunnelLightGlows, index, x, ceilingY - .01, z, 1, 1, 1, h);
        }
      }
      lights.instanceMatrix.needsUpdate = true;
      tunnelLightGlows.instanceMatrix.needsUpdate = true;
      group.add(lights, tunnelLightGlows);
      return;
    }

    const buildingCount = 14;
    const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.buildingMaterial, buildingCount);
    const windowBands = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(1.65, 1.32, .82), transparent: true,
        opacity: .62, toneMapped: false,
      }),
      112,
    );
    const windowDots = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .96, toneMapped: false }),
      760,
    );
    const windowHalos = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: .16,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }),
      760,
    );
    const windowPalette = [
      new THREE.Color().setRGB(1.65, 1.30, .76),
      new THREE.Color().setRGB(1.48, 1.46, 1.30),
      new THREE.Color().setRGB(1.03, 1.34, 1.36),
    ];
    let windowIndex = 0;
    let windowDotIndex = 0;
    for (let i = 0; i < buildingCount; i += 1) {
      const side = i % 2 ? 1 : -1;
      const z = startZ + random() * this.chunkLength;
      const h = roadHeading(z);
      const nx = Math.cos(h);
      const width = 8 + random() * 15;
      const depth = 8 + random() * 19;
      const height = 9 + random() * (Math.abs(chunkNumber % 8) < 3 ? 58 : 27);
      const buildingX = roadCenterX(z) + nx * side * (27 + random() * 55);
      const buildingYaw = h + (random() - 0.5) * 0.18;
      setInstance(buildings, i, buildingX, height / 2 - 0.2, z, width, height, depth, buildingYaw);
      const cosYaw = Math.cos(buildingYaw);
      const sinYaw = Math.sin(buildingYaw);
      const localPoint = (localX: number, localZ: number): { x: number; z: number } => ({
        x: buildingX + cosYaw * localX + sinYaw * localZ,
        z: z - sinYaw * localX + cosYaw * localZ,
      });
      const roadFaceX = -side * width * .506;
      const bands = Math.min(5, Math.max(2, Math.floor(height / 11)));
      for (let band = 0; band < bands && windowIndex < 112; band += 1) {
        const y = 4.2 + band * Math.max(3.8, (height - 7) / bands);
        const face = localPoint(roadFaceX, 0);
        setInstance(windowBands, windowIndex++, face.x, y, face.z, .055, .12, depth * .76, buildingYaw);
        if (windowIndex < 112 && band % 2 === 0) {
          const sideFace = localPoint(0, (i % 2 ? 1 : -1) * depth * .506);
          setInstance(windowBands, windowIndex++, sideFace.x, y + .12, sideFace.z, width * .68, .09, .055, buildingYaw);
        }
      }
      const dotCount = 25 + Math.floor(random() * 15);
      for (let dot = 0; dot < dotCount && windowDotIndex < 760; dot += 1) {
        const localZ = (random() - .5) * depth * .75;
        const dotY = 3 + random() * Math.max(2, height - 6);
        const dotPoint = localPoint(roadFaceX, localZ);
        setInstance(windowDots, windowDotIndex, dotPoint.x, dotY, dotPoint.z, .06, .22 + random() * .16, .38 + random() * .34, buildingYaw);
        const color = windowPalette[Math.floor(random() * windowPalette.length)];
        windowDots.setColorAt(windowDotIndex, color);
        setInstance(windowHalos, windowDotIndex, dotPoint.x, dotY, dotPoint.z, .07, .62, 1.08, buildingYaw);
        windowHalos.setColorAt(windowDotIndex, color);
        windowDotIndex += 1;
      }
      const sideDotCount = 12 + Math.floor(random() * 10);
      const sideFaceZ = (i % 2 ? 1 : -1) * depth * .506;
      for (let dot = 0; dot < sideDotCount && windowDotIndex < 760; dot += 1) {
        const localX = (random() - .5) * width * .72;
        const dotY = 3 + random() * Math.max(2, height - 6);
        const dotPoint = localPoint(localX, sideFaceZ);
        setInstance(windowDots, windowDotIndex, dotPoint.x, dotY, dotPoint.z, .4 + random() * .32, .22 + random() * .16, .06, buildingYaw);
        const color = windowPalette[Math.floor(random() * windowPalette.length)];
        windowDots.setColorAt(windowDotIndex, color);
        setInstance(windowHalos, windowDotIndex, dotPoint.x, dotY, dotPoint.z, 1.08, .62, .07, buildingYaw);
        windowHalos.setColorAt(windowDotIndex, color);
        windowDotIndex += 1;
      }
    }
    buildings.instanceMatrix.needsUpdate = true;
    windowBands.count = windowIndex;
    windowBands.instanceMatrix.needsUpdate = true;
    windowDots.count = windowDotIndex;
    windowDots.instanceMatrix.needsUpdate = true;
    if (windowDots.instanceColor) windowDots.instanceColor.needsUpdate = true;
    windowHalos.count = windowDotIndex;
    windowHalos.instanceMatrix.needsUpdate = true;
    if (windowHalos.instanceColor) windowHalos.instanceColor.needsUpdate = true;
    group.add(buildings, windowBands, windowHalos, windowDots);

    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 7, 6), new THREE.MeshStandardMaterial({ color: 0x49545a, metalness: 0.8, roughness: 0.4 }), 8);
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 10, 6), this.sodiumMaterial, 8);
    const lampGlows = new THREE.InstancedMesh(
      new THREE.SphereGeometry(.7, 10, 6),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(2.8, 1.42, .38),
        transparent: true,
        opacity: .2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      8,
    );
    for (let i = 0; i < 4; i += 1) {
      const z = startZ + 18 + i * 38;
      const h = roadHeading(z);
      const nx = Math.cos(h);
      for (const side of [-1, 1]) {
        const index = i * 2 + (side > 0 ? 1 : 0);
        const x = roadCenterX(z) + nx * side * 12.75;
        setInstance(poles, index, x, roadCenterY(z) + 3.5, z, 1, 1, 1, h);
        const lampX = x - nx * side * 1.15;
        const lampY = roadCenterY(z) + 6.78;
        setInstance(lamps, index, lampX, lampY, z, 1, 1, 1, h);
        setInstance(lampGlows, index, lampX, lampY, z, 1, .72, 1, h);
      }
    }
    poles.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    lampGlows.instanceMatrix.needsUpdate = true;
    group.add(poles, lamps, lampGlows);

    if (Math.abs(chunkNumber % 9) === 4) this.addOverpass(group, centerZ);
    const signIndex = highwaySignIndex(chunkNumber);
    if (signIndex !== null) this.addSign(group, centerZ + 30, highwaySignDescriptor(signIndex));
  }

  private addOverpass(group: THREE.Group, z: number): void {
    const h = roadHeading(z);
    const center = roadCenterX(z);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x434b50, roughness: 0.76, metalness: 0.18 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(51, 1.2, 9), concrete);
    deck.position.set(center, 6.1, z);
    deck.rotation.y = h + Math.PI / 2;
    group.add(deck);
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.35, 6, 1.35), concrete);
      pillar.position.set(center + Math.cos(h) * side * 13.2, 2.8, z);
      group.add(pillar);
    }
  }

  private addSign(group: THREE.Group, z: number, descriptor: HighwaySignDescriptor): void {
    const h = roadHeading(z);
    const center = roadCenterX(z);
    const gantry = new THREE.Group();
    const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x576268, roughness: 0.45, metalness: 0.75 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.2, 0.2), beamMaterial);
    beam.position.y = 7.35;
    gantry.add(beam);
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 7.35, 0.18), beamMaterial);
      pole.position.set(side * 11.45, 3.625, 0);
      gantry.add(pole);
    }
    const signSide = descriptor.side === 'right' ? -1 : 1;
    const signMaterial = createFreewaySignMaterial(descriptor);
    const backing = new THREE.Mesh(new THREE.BoxGeometry(7.7, 3.08, .12), new THREE.MeshStandardMaterial({ color: 0x26332f, roughness: .68, metalness: .28 }));
    backing.userData.disposeMaterial = true;
    backing.position.set(signSide * 6.15, 5.74, .035);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.55, 2.94), signMaterial);
    sign.userData.disposeMaterial = true;
    sign.position.set(signSide * 6.15, 5.74, -.031);
    sign.rotation.y = Math.PI;
    gantry.add(backing, sign);
    gantry.position.set(center, roadCenterY(z), z);
    gantry.rotation.y = h;
    group.add(gantry);
  }

  private buildDistantSkyline(): void {
    const random = seeded(23882);
    const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.buildingMaterial, 75);
    const skylineWindows = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .96, toneMapped: false }),
      5600,
    );
    const skylineWindowHalos = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: .125,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }),
      5600,
    );
    const skylinePalette = [
      new THREE.Color().setRGB(1.54, 1.25, .73),
      new THREE.Color().setRGB(1.43, 1.42, 1.25),
      new THREE.Color().setRGB(1.02, 1.28, 1.32),
      new THREE.Color().setRGB(.88, 1.22, 1.03),
      new THREE.Color().setRGB(1.82, 1.48, .88),
    ];
    let skylineWindowIndex = 0;
    for (let i = 0; i < 75; i += 1) {
      const side = i % 2 ? 1 : -1;
      const width = 12 + random() * 30;
      const depth = 12 + random() * 30;
      const height = 25 + random() * 105;
      const buildingX = side * (100 + random() * 210);
      const buildingZ = -160 + random() * 1080;
      const buildingYaw = (random() - .5) * .18;
      setInstance(buildings, i, buildingX, height / 2 - 2, buildingZ, width, height, depth, buildingYaw);
      const cosYaw = Math.cos(buildingYaw);
      const sinYaw = Math.sin(buildingYaw);
      const localPoint = (localX: number, localZ: number): { x: number; z: number } => ({
        x: buildingX + cosYaw * localX + sinYaw * localZ,
        z: buildingZ - sinYaw * localX + cosYaw * localZ,
      });
      const innerFaceX = -side * width * .506;
      const floorCount = Math.min(25, Math.max(5, Math.floor((height - 8) / 4.15)));
      const frontColumns = Math.min(7, Math.max(2, Math.floor(depth / 6.2)));
      const sideColumns = Math.min(6, Math.max(2, Math.floor(width / 6.4)));
      const visibleSideZ = (i % 4 < 2 ? 1 : -1) * depth * .506;
      for (let floor = 0; floor < floorCount && skylineWindowIndex < 5600; floor += 1) {
        // Entire dark floors and incomplete office occupancy prevent a flat
        // wall-of-light pattern while making each tower read independently.
        if (random() < .14) continue;
        const y = 2.3 + floor * ((height - 7) / Math.max(1, floorCount - 1));
        for (let column = 0; column < frontColumns && skylineWindowIndex < 5600; column += 1) {
          if (random() < .31) continue;
          const localZ = frontColumns === 1 ? 0 : -depth * .34 + column * (depth * .68 / (frontColumns - 1));
          const point = localPoint(innerFaceX, localZ);
          setInstance(skylineWindows, skylineWindowIndex, point.x, y, point.z, .075, .42 + random() * .24, .72 + random() * .42, buildingYaw);
          const color = skylinePalette[Math.floor(random() * skylinePalette.length)];
          skylineWindows.setColorAt(skylineWindowIndex, color);
          setInstance(skylineWindowHalos, skylineWindowIndex, point.x, y, point.z, .085, 1.18, 1.9, buildingYaw);
          skylineWindowHalos.setColorAt(skylineWindowIndex, color);
          skylineWindowIndex += 1;
        }
        for (let column = 0; column < sideColumns && skylineWindowIndex < 5600; column += 1) {
          if (random() < .42) continue;
          const localX = sideColumns === 1 ? 0 : -width * .34 + column * (width * .68 / (sideColumns - 1));
          const point = localPoint(localX, visibleSideZ);
          setInstance(skylineWindows, skylineWindowIndex, point.x, y, point.z, .72 + random() * .42, .42 + random() * .24, .075, buildingYaw);
          const color = skylinePalette[Math.floor(random() * skylinePalette.length)];
          skylineWindows.setColorAt(skylineWindowIndex, color);
          setInstance(skylineWindowHalos, skylineWindowIndex, point.x, y, point.z, 1.9, 1.18, .085, buildingYaw);
          skylineWindowHalos.setColorAt(skylineWindowIndex, color);
          skylineWindowIndex += 1;
        }
      }
    }
    buildings.instanceMatrix.needsUpdate = true;
    skylineWindows.count = skylineWindowIndex;
    skylineWindows.instanceMatrix.needsUpdate = true;
    if (skylineWindows.instanceColor) skylineWindows.instanceColor.needsUpdate = true;
    skylineWindowHalos.count = skylineWindowIndex;
    skylineWindowHalos.instanceMatrix.needsUpdate = true;
    if (skylineWindowHalos.instanceColor) skylineWindowHalos.instanceColor.needsUpdate = true;
    this.skyline.add(buildings, skylineWindowHalos, skylineWindows);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(900, 190), new THREE.MeshBasicMaterial({ color: 0x5c3b25, transparent: true, opacity: 0.104, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(0, 42, 550);
    this.skyline.add(glow);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createFullMoonTexture(), color: new THREE.Color().setRGB(1.7, 1.66, 1.48), transparent: true,
      depthWrite: false, toneMapped: false, fog: false,
    }));
    moon.name = 'detailed-full-moon';
    moon.position.set(-104, 174, 580);
    moon.scale.set(38, 38, 1);

    const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createMoonHaloTexture(), color: 0xb6d5eb, transparent: true,
      opacity: .72, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    }));
    moonHalo.name = 'moon-bloom-halo';
    moonHalo.position.copy(moon.position);
    // The large halo sits behind the cloud layer while the detailed disc stays
    // in front, letting cloud wisps interrupt the atmospheric bloom.
    moonHalo.position.z += 32;
    moonHalo.scale.set(148, 148, 1);

    const cloudTexture = createCloudTexture();
    const cloudPlacements = [
      { x: -108, y: 173, z: 595, sx: 88, sy: 23, opacity: .22, rotation: -.045 },
      { x: -61, y: 182, z: 592, sx: 70, sy: 18, opacity: .15, rotation: .055 },
      { x: -151, y: 164, z: 589, sx: 78, sy: 20, opacity: .16, rotation: .018 },
    ];
    this.celestial.add(moonHalo, moon);
    for (const placement of cloudPlacements) {
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTexture, color: 0x99a8b0, transparent: true,
        opacity: placement.opacity, depthWrite: false, toneMapped: false,
        rotation: placement.rotation, fog: false,
      }));
      cloud.name = 'moonlit-cloud';
      cloud.position.set(placement.x, placement.y, placement.z);
      cloud.scale.set(placement.sx, placement.sy, 1);
      this.celestial.add(cloud);
    }
  }
}
