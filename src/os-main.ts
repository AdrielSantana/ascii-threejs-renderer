import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { parseAsciiConfig, createAsciiShader } from './ascii-shader';
import { createWallpaper } from './os/wallpaper';
import { WindowManager } from './os/window-manager';
import { Desktop } from './os/desktop';
import { Taskbar } from './os/taskbar';
import { registerApp, listApps, getApp } from './os/apps/registry';
import { notepadApp } from './os/apps/notepad';
import { aboutApp } from './os/apps/about';

// --- Config ---
const config = parseAsciiConfig(new URLSearchParams());

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = 'os-canvas';
document.body.appendChild(renderer.domElement);

// --- Wallpaper ---
const wallpaper = createWallpaper(window.innerWidth, window.innerHeight);

// --- Post-processing ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(wallpaper.scene, wallpaper.camera));

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
  wallpaper.resize(w, h);
}
resize();
window.addEventListener('resize', resize);

// --- OS UI ---
const uiRoot = document.createElement('div');
uiRoot.id = 'os-ui';
document.body.appendChild(uiRoot);

const wm = new WindowManager(uiRoot);
const desktop = new Desktop(uiRoot);
const taskbar = new Taskbar(uiRoot, { onAppTap: (id: string) => {
  if (wm.isOpen(id)) {
    wm.focus(id);
  } else {
    openApp(id);
  }
}});

// Register apps
registerApp(notepadApp);
registerApp(aboutApp);

// Build desktop icons
const desktopIcons = listApps().map((app) => ({
  id: app.id,
  label: app.label,
  icon: app.icon!,
  onOpen: () => openApp(app.id),
}));
desktop.setIcons(desktopIcons);

// Start menu items
const startItems = listApps().map((app) => ({
  id: app.id,
  label: app.label,
  onClick: () => openApp(app.id),
}));
taskbar.setStartMenu(startItems);

function openApp(id: string) {
  const app = getApp(id);
  if (!app) return;
  if (wm.isOpen(id)) {
    wm.focus(id);
    return;
  }
  wm.open(app);
  updateTaskbar();
}

function updateTaskbar() {
  const openIds = wm.listOpen();
  const activeId = openIds.length > 0 ? openIds[openIds.length - 1] : null;
  const running = openIds.map((id) => {
    const app = getApp(id)!;
    return { id, title: app.title, icon: app.icon! };
  });
  taskbar.setRunningApps(running, activeId);
}

// Hook window close to update taskbar
const originalClose = wm.close.bind(wm);
wm.close = (id: string) => {
  originalClose(id);
  updateTaskbar();
};

// Start clock
taskbar.start();

// --- Loop ---
function animate(time: number) {
  const t = time * 0.001;
  wallpaper.update(t, 0);
  composer.render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
