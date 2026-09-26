import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { frameShowroom, showroomMaterials, vehicleBounds } from '../src/game/showroom';

describe('catalog-independent showroom framing', () => {
  it.each([[2, 1.5, 4.6], [3, 2.4, 7], [1.5, 1, 3]])('fits a %s by %s by %s vehicle at every angle', (w, h, l) => {
    const box = new THREE.Box3(new THREE.Vector3(-w / 2, 0, -l / 2), new THREE.Vector3(w / 2, h, l / 2));
    for (const [width, height, rect] of [[1440, 900, { x: 350, y: 64, width: 680, height: 644 }], [320, 568, { x: 15, y: 180, width: 290, height: 191 }]] as const) {
      const camera = new THREE.PerspectiveCamera();
      frameShowroom(camera, box, new THREE.Vector3(), rect, width, height);
      for (let angle = 0; angle < 360; angle += 15) for (const x of [-w / 2, w / 2]) for (const y of [0, h]) for (const z of [-l / 2, l / 2]) {
        const point = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle * Math.PI / 180).project(camera);
        const px = (point.x + 1) / 2 * width, py = (1 - point.y) / 2 * height;
        expect(px).toBeGreaterThan(rect.x + 8); expect(px).toBeLessThan(rect.x + rect.width - 8);
        expect(py).toBeGreaterThan(rect.y + 8); expect(py).toBeLessThan(rect.y + rect.height - 8);
      }
    }
  });
  it('ignores oversized glow cards when measuring the vehicle', () => {
    const car = new THREE.Group();
    car.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial()));
    car.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ transparent: true })));
    expect(vehicleBounds(car).getSize(new THREE.Vector3()).toArray()).toEqual([2, 1, 4]);
  });
  it('restores the original driving materials on leaving the preview', () => {
    const car = new THREE.Group(), material = new THREE.MeshStandardMaterial({ color: 0x343a40, metalness: .7 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material); car.add(mesh);
    const originalColor = material.color.clone(), set = showroomMaterials(car, new THREE.Texture());
    set(true); expect(mesh.material).not.toBe(material); expect(material.color.equals(originalColor)).toBe(true);
    set(false); expect(mesh.material).toBe(material);
  });
  it('accounts for imported root scale without including its world position', () => {
    const car = new THREE.Group();
    car.scale.setScalar(2); car.position.set(100, 0, 50);
    car.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial()));
    expect(vehicleBounds(car).getSize(new THREE.Vector3()).toArray()).toEqual([4, 2, 8]);
  });
});
