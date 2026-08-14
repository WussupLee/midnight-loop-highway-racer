import * as THREE from 'three';

export interface LoftSection {
  z: number;
  bottomHalfWidth: number;
  topHalfWidth: number;
  bottomY: number;
  topY: number;
}

/**
 * Builds a very small faceted vehicle shell from transverse sections. The
 * deliberately economical geometry gives curved silhouettes without hiding
 * the polygon structure that made early-2000s car models readable.
 */
export function createLoftGeometry(sections: LoftSection[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const section of sections) {
    positions.push(
      -section.bottomHalfWidth, section.bottomY, section.z,
      section.bottomHalfWidth, section.bottomY, section.z,
      -section.topHalfWidth, section.topY, section.z,
      section.topHalfWidth, section.topY, section.z,
    );
  }
  for (let section = 0; section < sections.length - 1; section += 1) {
    const a = section * 4;
    const b = a + 4;
    indices.push(
      a, b + 1, b, a, a + 1, b + 1,
      a, b, b + 2, a, b + 2, a + 2,
      a + 1, a + 3, b + 3, a + 1, b + 3, b + 1,
      a + 2, b + 2, b + 3, a + 2, b + 3, a + 3,
    );
  }
  const last = (sections.length - 1) * 4;
  indices.push(
    0, 2, 3, 0, 3, 1,
    last, last + 1, last + 3, last, last + 3, last + 2,
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createSoftGlowTexture(color = '#9ad170'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 3, 64, 64, 63);
  gradient.addColorStop(0, color);
  gradient.addColorStop(.28, `${color}b8`);
  gradient.addColorStop(.7, `${color}38`);
  gradient.addColorStop(1, `${color}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A compact taillight halo with restrained early-digital diffraction rays. */
export function createTailLightGlowTexture(color = '#ff1739'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const glow = context.createRadialGradient(64, 64, 2, 64, 64, 62);
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(.08, color);
  glow.addColorStop(.3, `${color}a8`);
  glow.addColorStop(.72, `${color}24`);
  glow.addColorStop(1, `${color}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);

  context.save();
  context.globalCompositeOperation = 'lighter';
  context.lineCap = 'round';
  context.lineWidth = 1.15;
  context.shadowColor = color;
  context.shadowBlur = 3;
  const rayA = context.createLinearGradient(18, 18, 110, 110);
  rayA.addColorStop(0, `${color}00`);
  rayA.addColorStop(.43, `${color}42`);
  rayA.addColorStop(.5, `${color}c8`);
  rayA.addColorStop(.57, `${color}42`);
  rayA.addColorStop(1, `${color}00`);
  context.strokeStyle = rayA;
  context.beginPath();
  context.moveTo(18, 18);
  context.lineTo(110, 110);
  context.stroke();
  const rayB = context.createLinearGradient(18, 110, 110, 18);
  rayB.addColorStop(0, `${color}00`);
  rayB.addColorStop(.43, `${color}42`);
  rayB.addColorStop(.5, `${color}c8`);
  rayB.addColorStop(.57, `${color}42`);
  rayB.addColorStop(1, `${color}00`);
  context.strokeStyle = rayB;
  context.beginPath();
  context.moveTo(18, 110);
  context.lineTo(110, 18);
  context.stroke();
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRoundLamp(radius: number, depth: number, material: THREE.Material): THREE.Mesh {
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 12), material);
  lamp.rotation.x = Math.PI / 2;
  return lamp;
}
