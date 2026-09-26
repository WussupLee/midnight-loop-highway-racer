import * as THREE from 'three';

/** Explicit visual-test mode: samples the real postprocessed scene and a solid-body silhouette. */
export function captureShowroom(renderer: THREE.WebGLRenderer, camera: THREE.Camera,
  car: THREE.Group, render: () => void) {
  render();
  const foreground = renderer.domElement.toDataURL();
  car.visible = false;
  render();
  const background = renderer.domElement.toDataURL();
  car.visible = true;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y);
  const maskScene = new THREE.Scene();
  maskScene.background = new THREE.Color(0);
  const clone = car.clone(true);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  clone.traverse(object => {
    if (!(object instanceof THREE.Mesh)) {
      if (object instanceof THREE.Light || object instanceof THREE.Sprite || object instanceof THREE.Points || object instanceof THREE.Line) object.visible = false;
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every(material => material.transparent)) object.visible = false;
    object.material = white;
  });
  maskScene.add(clone);
  renderer.setRenderTarget(target);
  renderer.render(maskScene, camera);
  const pixels = new Uint8Array(size.x * size.y * 4);
  renderer.readRenderTargetPixels(target, 0, 0, size.x, size.y, pixels);
  const canvas = document.createElement('canvas');
  canvas.width = size.x; canvas.height = size.y;
  const context = canvas.getContext('2d')!;
  const data = context.createImageData(size.x, size.y);
  for (let y = 0; y < size.y; y++) data.data.set(pixels.subarray((size.y - y - 1) * size.x * 4, (size.y - y) * size.x * 4), y * size.x * 4);
  context.putImageData(data, 0, 0);
  const mask = canvas.toDataURL();
  renderer.setRenderTarget(null);
  target.dispose(); white.dispose();
  render();
  return { foreground, background, mask };
}
