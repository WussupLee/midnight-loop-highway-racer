import * as THREE from 'three';

/** Only solid vehicle geometry participates: glow cards and light targets are not bodywork. */
export function vehicleBounds(group: THREE.Group): THREE.Box3 {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every(material => material.transparent)) return;
    object.geometry.computeBoundingBox();
    bounds.union(object.geometry.boundingBox!.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld)));
  });
  return bounds.applyMatrix4(new THREE.Matrix4().makeScale(group.scale.x, group.scale.y, group.scale.z));
}

/** Fit the complete turntable envelope into its UI opening, including narrow/short screens. */
export function frameShowroom(camera: THREE.PerspectiveCamera, bounds: THREE.Box3,
  origin: THREE.Vector3, rect: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>,
  width: number, height: number): void {
  const size = bounds.getSize(new THREE.Vector3());
  const center = new THREE.Vector3(0, (bounds.min.y + bounds.max.y) / 2, 0).add(origin);
  const radius = Math.hypot(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)));
  const backward = new THREE.Vector3(5.4, 2.8, -6.25).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), backward).normalize();
  const up = new THREE.Vector3().crossVectors(backward, right);
  camera.fov = 47;
  camera.aspect = width / height;
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const availableX = tangent * camera.aspect * Math.max(1, rect.width) / width * .84;
  const availableY = tangent * Math.max(1, rect.height) / height * .88;
  // Retain the requested 30–45% pullback without shrinking short landscape
  // previews to a thumbnail. The geometric fit below can move farther out.
  let distance = width > height && height < 500 ? 10.8 : 12;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 32) for (const y of [-size.y / 2, size.y / 2]) {
    const corner = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    distance = Math.max(distance, corner.dot(backward) + Math.abs(corner.dot(right)) / availableX,
      corner.dot(backward) + Math.abs(corner.dot(up)) / availableY);
  }
  camera.position.copy(center).addScaledVector(backward, distance);
  camera.lookAt(center);
  camera.setViewOffset(width, height, width / 2 - (rect.x + rect.width / 2),
    height / 2 - (rect.y + rect.height / 2), width, height);
  camera.updateMatrixWorld(true);
}

/** Local softboxes keep the surrounding freeway dark. Metal bodywork also needs reflected fill. */
export function createShowroomLights(scene: THREE.Scene): THREE.Group {
  const rig = new THREE.Group();
  for (const [color, intensity, x, y, z] of [
    [0xffe7c6, 100, 4, 7, -5], [0xdce9ff, 70, -5, 3, -2], [0x98b9ed, 90, 1, 5, 6],
  ]) {
    const light = new THREE.SpotLight(color, intensity, 18, .65, .85, 2);
    light.position.set(x, y, z);
    light.target.position.y = .7;
    rig.add(light, light.target);
  }
  scene.add(rig);
  return rig;
}

export function showroomMaterials(group: THREE.Group, environment: THREE.Texture) {
  const entries: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; preview: THREE.Material | THREE.Material[] }[] = [];
  const clones = new Map<THREE.Material, THREE.Material>();
  function preview(material: THREE.Material) {
    if (clones.has(material)) return clones.get(material)!;
    const clone = material.clone();
    if (clone instanceof THREE.MeshStandardMaterial) {
      // Explicit map decouples the car's reflected studio light from the dim freeway environment.
      clone.envMap = environment;
      clone.envMapIntensity = 1.55;
      clone.roughness = Math.max(.6, clone.roughness);
      if (clone.metalness > .5 && Math.max(clone.color.r, clone.color.g, clone.color.b) > .015) {
        clone.color.lerp(new THREE.Color(0xb0b8be), .38);
      }
      if (clone instanceof THREE.MeshPhysicalMaterial) clone.clearcoat = Math.min(.35, clone.clearcoat);
    }
    clones.set(material, clone);
    return clone;
  }
  group.traverse(object => {
    if (object instanceof THREE.Mesh) entries.push({ mesh: object, original: object.material,
      preview: Array.isArray(object.material) ? object.material.map(preview) : preview(object.material) });
  });
  let active = false;
  return (enabled: boolean) => {
    if (enabled === active) return;
    active = enabled;
    for (const entry of entries) entry.mesh.material = enabled ? entry.preview : entry.original;
  };
}
