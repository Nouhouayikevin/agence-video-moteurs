// Voxel characters for HD-2D shots (Kev's choice, 2026-11-07; RENDU.md §3 bis): every pixel of a sprite becomes a small box, so characters, animals and
// sprite props have a real volume. They no longer rotate with the camera: each one faces a fixed direction for the whole shot.
// In the episode's hd2d.js:
//   import { voxelFacer } from './voxel.js';
//   const vox = voxelFacer(camera), faceList = [], face = () => vox.face(faceList);          // replaces the camera-copying face()
//   in render(), before the shot's own call:
//   if (render.n !== n) { SH[n](sh.debut, 0, sh, E); vox.startShot(); render.n = n; }        // the camera at the shot's first frame fixes where everyone faces,
//                                                                                             // the same result whichever frame a render worker draws first
import * as THREE from 'three';

const DEPTH = w => (w > 24 ? 12 : 7);   // depth in sprite pixels: wide sprites (pigeon, seen from the side) need a thicker body
const INSIDE = 1;                       // how far inside the silhouette a pixel must be to get the full depth

export function voxelFacer(camera) {
  const lit = new THREE.MeshLambertMaterial({ vertexColors: true }), unlit = new THREE.MeshBasicMaterial({ vertexColors: true });
  const cache = new Map(), shotCam = new THREE.Vector3(), wp = new THREE.Vector3();

  const geometry = b => {
    const tx = b.material.map, img = tx.image, plane = b.geometry.parameters, key = tx.uuid + '|' + plane.width;
    if (cache.has(key)) return cache.get(key);
    const w = img.width, h = img.height, d = img.getContext('2d').getImageData(0, 0, w, h).data;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 128;
    const inner = (x, y) => { for (let n = 1; n <= INSIDE; n++) if (!on(x - n, y) || !on(x + n, y) || !on(x, y - n) || !on(x, y + n)) return false; return true; };
    b.geometry.computeBoundingBox();
    const bb = b.geometry.boundingBox, px = plane.width / w, py = plane.height / h, pos = [], nor = [], col = [], c = new THREE.Color();
    const box = new THREE.BoxGeometry(1, 1, 1), bp = box.attributes.position, bn = box.attributes.normal, ix = box.index;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      const i = (y * w + x) * 4; c.set(`rgb(${d[i]},${d[i + 1]},${d[i + 2]})`);
      const dz = (inner(x, y) ? DEPTH(w) : 1) * px, cx = bb.min.x + (x + .5) * px, cy = bb.max.y - (y + .5) * py;   // the rim is the dark outline: kept thin, or it hides the body seen from above
      for (let k = 0; k < ix.count; k++) { const v = ix.getX(k); pos.push(cx + bp.getX(v) * px, cy + bp.getY(v) * py, bp.getZ(v) * dz); nor.push(bn.getX(v), bn.getY(v), bn.getZ(v)); col.push(c.r, c.g, c.b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    cache.set(key, g); return g;
  };

  const voxel = b => {
    if (!b.userData.vox) { const m = new THREE.Mesh(new THREE.BufferGeometry(), lit); m.castShadow = b.castShadow; m.receiveShadow = true; b.add(m); b.userData.vox = m; b.material.visible = false; }
    const m = b.userData.vox; m.geometry = geometry(b); m.scale.z = Math.abs(b.scale.x);
    m.material = b.scale.y < .5 ? unlit : lit;   // shortcut: tiny sprites under a strong close light burn out when lit; replace with a per-shot light setting if another shot needs it
  };

  return {
    startShot() { shotCam.copy(camera.position); },
    face(list) {
      for (const b of list) {
        if (!b.visible) continue;
        const img = b.material.map?.image, big = !img?.getContext || img.width > 64;   // big textures (trees, scenery) stay upright plates turning on the vertical axis
        const ref = big ? camera.position : shotCam;
        b.getWorldPosition(wp); b.rotation.set(0, Math.atan2(ref.x - wp.x, ref.z - wp.z), 0);
        if (!big) voxel(b);
      }
    },
  };
}
