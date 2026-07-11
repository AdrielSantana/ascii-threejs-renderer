import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { parseAsciiConfig, createAsciiShader } from './ascii-shader';

// --- Config ---
const config = parseAsciiConfig(new URLSearchParams());

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a14);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.2, 4.5);
camera.lookAt(0, 0, 0);

// --- Simple scene objects ---
// Main object: icosahedron with a wireframe feel
const geo = new THREE.IcosahedronGeometry(1.2, 0);
const mat = new THREE.MeshStandardMaterial({
  color: 0x6a4c93,
  metalness: 0.3,
  roughness: 0.4,
  flatShading: true,
});
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);

// Ring of small orbs around it
const ringGroup = new THREE.Group();
const orbGeo = new THREE.SphereGeometry(0.06, 6, 6);
const orbMat = new THREE.MeshStandardMaterial({ color: 0x9b7fd4, emissive: 0x4a3070, emissiveIntensity: 0.5 });
for (let i = 0; i < 24; i++) {
  const angle = (i / 24) * Math.PI * 2;
  const orb = new THREE.Mesh(orbGeo, orbMat);
  orb.position.set(Math.cos(angle) * 1.8, Math.sin(angle) * 0.4, Math.sin(angle) * 1.8);
  ringGroup.add(orb);
}
scene.add(ringGroup);

// Subtle ground grid
const gridHelper = new THREE.GridHelper(8, 16, 0x3a2a5a, 0x1a1a2e);
gridHelper.position.y = -0.9;
scene.add(gridHelper);

// --- Lights ---
const ambient = new THREE.AmbientLight(0x443366, 0.6);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xb8a0dd, 1.8);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x334466, 0.6);
fillLight.position.set(-3, 1, -2);
scene.add(fillLight);

// --- Post-processing ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const asciiPass = new ShaderPass(createAsciiShader(config));
composer.addPass(asciiPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// --- Resize ---
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio, 1.5);
  const shorter = Math.min(w, h);
  const cellH = shorter / config.cellScale;
  const cellW = cellH * 6 / 9;
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  asciiPass.uniforms.uResolution.value.set(w * pr, h * pr);
  asciiPass.uniforms.uCellSize.value.set(cellW * pr, cellH * pr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// --- Loop ---
function animate(time: number) {
  const t = time * 0.001;

  // Rotate objects slowly
  mesh.rotation.x = t * 0.15;
  mesh.rotation.y = t * 0.22;
  ringGroup.rotation.y = t * 0.08;
  ringGroup.rotation.x = Math.sin(t * 0.05) * 0.1;

  // Subtle camera sway
  camera.position.y = 1.2 + Math.sin(t * 0.1) * 0.08;

  composer.render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
