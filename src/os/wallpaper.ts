import * as THREE from 'three';
import { applyWind } from '../wind';

/**
 * Retrowave wallpaper module.
 *
 * Returns a self-contained Three.js scene with:
 * - background: sky dome, striped sun, distant mountains
 * - ground: scrolling grid floor + highway road
 * - palms: wind-swayed palm trees along the road
 *
 * Animation is driven entirely by update(t, dt).
 */

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = ((t ^ (t >>> 15)) >>> 0) * (t | 1) >>> 0;
    r = (r ^ (r + (((r ^ (r >>> 7)) >>> 0) * (r | 61) >>> 0))) >>> 0;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f0d000';
  // Two thin parallel dashed stripes
  ctx.fillRect(14, 0, 6, 32);
  ctx.fillRect(44, 0, 6, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 40);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWallpaper(width: number, height: number) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 200);
  camera.position.set(0, 1.3, 0);
  camera.lookAt(0, 1.6, -20);

  const background = new THREE.Group();
  const ground = new THREE.Group();
  const palms = new THREE.Group();
  scene.add(background, ground, palms);

  const rng = mulberry32(1337);

  // --- Sky dome ---
  const skyGeo = new THREE.SphereGeometry(80, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0.10, 0.04, 0.28) },
      middleColor: { value: new THREE.Color(0.95, 0.18, 0.55) },
      bottomColor: { value: new THREE.Color(1.0, 0.45, 0.15) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 topColor;
      uniform vec3 middleColor;
      uniform vec3 bottomColor;
      void main() {
        vec3 c = mix(bottomColor, middleColor, smoothstep(0.0, 0.5, vUv.y));
        c = mix(c, topColor, smoothstep(0.5, 1.0, vUv.y));
        float band = fract(sin(vUv.y * 200.0) * 0.5 + 0.5) * 0.04;
        gl_FragColor = vec4(c + band, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  background.add(sky);

  // --- Sun ---
  const sunGeo = new THREE.CircleGeometry(7, 64);
  const sunMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      colA: { value: new THREE.Color(1.0, 0.85, 0.20) },
      colB: { value: new THREE.Color(1.0, 0.20, 0.55) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 colA;
      uniform vec3 colB;
      void main() {
        float stripeMask = step(0.5, fract(vUv.y * 14.0));
        vec3 col = mix(colA, colB, vUv.y);
        gl_FragColor = vec4(col, stripeMask);
      }
    `,
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(0, 6, -30);
  background.add(sun);

  // --- Mountains ---
  const mountainMat = new THREE.MeshBasicMaterial({ color: 0x1a0a2e });
  for (let row = 0; row < 2; row++) {
    const z = -24 - row * 4;
    const count = 7;
    const offset = row * 3.5;
    for (let i = 0; i < count; i++) {
      const radius = 2.5 + rng() * 2.5;
      const h = 4.0 + rng() * 4.0;
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, h, 5, 1), mountainMat);
      const x = -28 + offset + i * 8 + (rng() - 0.5) * 2;
      mountain.position.set(x, h * 0.5 - 1.5, z + (rng() - 0.5) * 1.5);
      background.add(mountain);
    }
  }

  // --- Grid floor ---
  const gridGeo = new THREE.PlaneGeometry(160, 200, 1, 1);
  const gridMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      lineColor: { value: new THREE.Color(0.0, 0.95, 1.0) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 lineColor;
      void main() {
        float vertical = step(0.97, fract(vUv.x * 40.0));
        float horizontal = step(0.95, fract(vUv.y * 30.0 + uTime * 1.5));
        float mask = max(vertical, horizontal);
        float fade = 1.0 - smoothstep(0.5, 1.0, vUv.y);
        gl_FragColor = vec4(lineColor, mask * fade);
      }
    `,
  });
  const grid = new THREE.Mesh(gridGeo, gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = 0;
  ground.add(grid);

  // --- Highway road ---
  const roadGeo = new THREE.PlaneGeometry(7, 200, 1, 1);
  const roadMat = new THREE.MeshBasicMaterial({
    color: 0x10041a,
    map: createRoadTexture(),
    transparent: true,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.005;
  ground.add(road);

  // --- Lights ---
  scene.add(new THREE.HemisphereLight(0x9b5cd6, 0x10041a, 0.5));
  const rimLight = new THREE.DirectionalLight(0xff7ab8, 0.9);
  rimLight.position.set(0, 5, 10);
  rimLight.target.position.set(0, 1.6, -20);
  scene.add(rimLight);
  scene.add(rimLight.target);

  // --- Palm trees ---
  const palmPositions = [-8, -13, -18, -23, -28, -33];
  const trunkMatBase = new THREE.MeshLambertMaterial({ color: 0x080014 });
  const frondMatBase = new THREE.MeshBasicMaterial({ color: 0x1a0a2e, side: THREE.DoubleSide });

  palmPositions.forEach((z, index) => {
    const side = index % 2 === 0 ? 1 : -1;
    const baseX = side * (5 + rng() * 4);
    const x = baseX + (rng() - 0.5) * 0.6;
    const zOffset = z + (rng() - 0.5) * 0.8;

    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 3.5, 5);
    const trunkMat = trunkMatBase.clone();
    applyWind(trunkMat, 0.25, 0.4);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.75, zOffset);
    palms.add(trunk);

    const frondGeo = new THREE.PlaneGeometry(0.4, 1.8, 1, 1);
    for (let f = 0; f < 5; f++) {
      const frondMat = frondMatBase.clone();
      applyWind(frondMat, 0.6, 0.2);
      const frond = new THREE.Mesh(frondGeo, frondMat);
      const angle = (f / 5) * Math.PI * 2;
      frond.position.set(x, 3.3, zOffset);
      frond.rotation.set(Math.PI / 3, angle, 0);
      frond.translateY(0.9);
      palms.add(frond);
    }
  });

  function update(t: number, _dt: number) {
    sun.scale.setScalar(1.0 + Math.sin(t * 0.5) * 0.025);
    sun.rotation.z = t * 0.02;
    gridMat.uniforms.uTime.value = t;
    camera.position.x = Math.sin(t * 0.18) * 0.12;
    camera.position.y = 1.3 + Math.sin(t * 0.11) * 0.04;
    camera.lookAt(0, 1.6, -20);
  }

  function resize(newWidth: number, newHeight: number) {
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
  }

  return { scene, camera, update, resize };
}
