import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { parseAsciiConfig, createAsciiShader } from './ascii-shader';
import { createWorld, terrainHeight } from './world';
import { windUniforms } from './wind';

// --- Debug params ---
const config = parseAsciiConfig(new URLSearchParams(window.location.search));

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// --- Scene + neblina ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05020b);
scene.fog = new THREE.FogExp2(0x10091d, 0.0082);

const camera = new THREE.PerspectiveCamera(
  68,
  window.innerWidth / window.innerHeight,
  0.08,
  410,
);
camera.position.set(0, 2.15, 24);
camera.rotation.order = 'YXZ';
scene.add(camera);

// --- Mundo ---
const world = createWorld(camera);
scene.add(world.group);

// --- First person controls ---
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const overlay = document.createElement('div');
overlay.textContent = 'Clique para jogar';
overlay.style.cssText = [
  'position:fixed', 'inset:0', 'display:flex',
  'align-items:center', 'justify-content:center',
  'font:bold 24px monospace', 'color:#d6d0b8',
  'background:rgba(0,0,0,0.7)', 'cursor:pointer', 'z-index:100',
].join(';');
overlay.addEventListener('click', () => controls.lock());
document.body.appendChild(overlay);
controls.addEventListener('lock', () => (overlay.style.display = 'none'));
controls.addEventListener('unlock', () => (overlay.style.display = 'flex'));

// --- WASD movement ---
const keys: Record<string, boolean> = {};
window.addEventListener('keydown', (e) => (keys[e.code] = true));
window.addEventListener('keyup', (e) => (keys[e.code] = false));

let bobTime = 0;

// --- Composer: RenderPass → ASCII → Output ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const asciiPass = new ShaderPass(createAsciiShader(config));
composer.addPass(asciiPass);
composer.addPass(new OutputPass());

// --- Toggle ASCII on/off ---
let asciiEnabled = true;
const toggleBtn = document.createElement('button');
toggleBtn.textContent = 'ASCII: ON';
toggleBtn.style.cssText = [
  'position:fixed', 'bottom:12px', 'left:12px',
  'font:bold 12px monospace', 'color:#0f0',
  'background:rgba(0,0,0,0.7)', 'border:1px solid #0f0',
  'padding:6px 10px', 'cursor:pointer', 'z-index:10000',
  'border-radius:3px',
].join(';');
toggleBtn.addEventListener('click', () => {
  asciiEnabled = !asciiEnabled;
  asciiPass.enabled = asciiEnabled;
  debug.ascii = asciiEnabled;
  toggleBtn.textContent = `ASCII: ${asciiEnabled ? 'ON' : 'OFF'}`;
  toggleBtn.style.color = asciiEnabled ? '#0f0' : '#888';
  toggleBtn.style.borderColor = asciiEnabled ? '#0f0' : '#888';
});
document.body.appendChild(toggleBtn);

// --- Stats + HUD ---
const stats = new Stats();
document.body.appendChild(stats.dom);

const hud = document.createElement('div');
hud.style.cssText = [
  'position:fixed', 'top:0', 'right:0',
  'font:11px monospace', 'color:#0f0',
  'background:rgba(0,0,0,0.6)', 'padding:4px 6px',
  'white-space:pre', 'z-index:10000', 'pointer-events:none',
].join(';');
document.body.appendChild(hud);

const debug = {
  fps: 0, ms: 0, frames: 0, cells: 0,
  pos: { x: 0, y: 0, z: 0 },
  ascii: true,
  config,
  startTime: performance.now(),
};
(window as any).__debug = debug;

// --- Resize ---
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  asciiPass.uniforms.uResolution.value.set(w * pr, h * pr);
  asciiPass.uniforms.uCellSize.value.set(config.cellW * pr, config.cellH * pr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// --- Loop ---
let lastTime = performance.now();
let fpsAccum = 0;
let fpsCount = 0;
let fpsLastUpdate = lastTime;

function animate(time: number) {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;
  const t = time * 0.001;

  // Movement (WASD + Shift pra correr)
  const forward = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
  const right = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
  const moving = forward !== 0 || right !== 0;

  if (controls.isLocked && moving) {
    const length = Math.hypot(forward, right) || 1;
    const speed = (keys['ShiftLeft'] || keys['ShiftRight'] ? 8.8 : 5.1) * dt;
    const yaw = controls.getObject().rotation.y;
    const nextX = camera.position.x + ((-Math.sin(yaw) * forward + Math.cos(yaw) * right) / length) * speed;
    const nextZ = camera.position.z + ((-Math.cos(yaw) * forward - Math.sin(yaw) * right) / length) * speed;
    camera.position.x = THREE.MathUtils.clamp(nextX, -43, 43);
    camera.position.z = THREE.MathUtils.clamp(nextZ, -126, 27);
    bobTime += dt * (keys['ShiftLeft'] ? 12 : 8.2);
  }

  // Segue terreno + bob
  const targetY = terrainHeight(camera.position.x, camera.position.z) + 2.12 + (moving ? Math.sin(bobTime) * 0.045 : 0);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 1 - Math.pow(0.001, dt));

  world.update(t, dt, moving, bobTime);
  windUniforms.uTime.value = t;

  composer.render();
  stats.update();

  fpsAccum += 1 / dt;
  fpsCount++;
  if (now - fpsLastUpdate > 500) {
    debug.fps = Math.round(fpsAccum / fpsCount);
    debug.ms = +(dt * 1000).toFixed(2);
    debug.frames++;
    const cellsX = Math.floor(window.innerWidth / config.cellW);
    const cellsY = Math.floor(window.innerHeight / config.cellH);
    debug.cells = cellsX * cellsY;
    const p = camera.position;
    debug.pos = { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) };
    hud.textContent = [
      `FPS: ${debug.fps}`,
      `MS:  ${debug.ms}`,
      `frames: ${debug.frames}`,
      `cells: ${debug.cells} (${cellsX}x${cellsY})`,
      `pos: ${debug.pos.x}, ${debug.pos.y}, ${debug.pos.z}`,
      `ascii: ${asciiEnabled ? 'ON' : 'OFF'}`,
      `cfg: cell=${config.cellW}x${config.cellH} color=${config.colorized}`,
    ].join('\n');
    fpsAccum = 0;
    fpsCount = 0;
    fpsLastUpdate = now;
  }

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
