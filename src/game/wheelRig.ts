import * as THREE from 'three';

export interface WheelRig {
  hub: THREE.Group; spin: THREE.Group; radius: number; front: boolean; meshes: THREE.Mesh[];
}

/** Bake transforms first; all tire/rim primitives share one centered hub. */
export function rigImportedWheels(root: THREE.Object3D): WheelRig[] {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const parts: THREE.Mesh[][] = [[], [], [], []];
  const originals: THREE.Mesh[] = [];
  root.traverse(object => {
    if (object instanceof THREE.Mesh && /wheel/i.test(object.name)) originals.push(object);
  });
  for (const original of originals) {
    const geometry = original.geometry.index ? original.geometry.toNonIndexed() : original.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(original.matrixWorld));
    const positions = geometry.getAttribute('position');
    const indices: number[][] = [[], [], [], []];
    for (let i = 0; i < positions.count; i += 3) {
      const x = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
      const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
      indices[(z > 0 ? 2 : 0) + (x > 0 ? 1 : 0)].push(i, i + 1, i + 2);
    }
    indices.forEach((vertices, slot) => {
      if (!vertices.length) return;
      const part = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        const values = new Float32Array(vertices.length * attribute.itemSize);
        vertices.forEach((vertex, index) => {
          for (let component = 0; component < attribute.itemSize; component++) values[index * attribute.itemSize + component] = attribute.getComponent(vertex, component);
        });
        part.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
      }
      for (let i = 0; i < vertices.length; i += 3) {
        const material = geometry.groups.find(g => vertices[i] >= g.start && vertices[i] < g.start + g.count)?.materialIndex ?? 0;
        const last = part.groups[part.groups.length - 1];
        if (last?.materialIndex === material) last.count += 3;
        else part.addGroup(i, 3, material);
      }
      const mesh = new THREE.Mesh(part, original.material);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = original.name;
      parts[slot].push(mesh);
    });
    geometry.dispose();
    original.removeFromParent();
  }
  return parts.map((meshes, slot) => {
    if (!meshes.length) throw new Error(`Missing wheel assembly ${slot}`);
    const bounds = new THREE.Box3();
    for (const mesh of meshes) { mesh.geometry.computeBoundingBox(); bounds.union(mesh.geometry.boundingBox!); }
    const center = bounds.getCenter(new THREE.Vector3());
    const hub = new THREE.Group();
    hub.name = `wheel hub ${slot}`;
    hub.position.copy(center);
    const spin = new THREE.Group();
    hub.add(spin); root.add(hub);
    for (const mesh of meshes) { mesh.geometry.translate(-center.x, -center.y, -center.z); spin.add(mesh); }
    return { hub, spin, front: slot >= 2, radius: (bounds.max.y - bounds.min.y) / 2, meshes };
  });
}
export function animateWheels(rigs: WheelRig[], speed: number, steer: number, handbrake: boolean, dt: number, scale = 1): void {
  for (const rig of rigs) {
    rig.hub.rotation.y = rig.front ? steer : 0;
    rig.spin.rotation.x = (rig.spin.rotation.x - speed * dt / (rig.radius * scale) * (!rig.front && handbrake ? .08 : 1)) % (Math.PI * 2);
  }
}
export function isolateBody(root: THREE.Group, fixed: THREE.Object3D[]): THREE.Group {
  const body = new THREE.Group(); body.name = 'sprung body';
  for (const child of [...root.children]) if (!fixed.includes(child)) body.add(child);
  root.add(body); return body;
}
