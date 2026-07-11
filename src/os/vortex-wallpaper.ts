import * as THREE from 'three';
import { generateShape, SHAPE_NAMES, ShapeName } from './shape-library';

/**
 * Fluid Particle Vortex wallpaper.
 *
 * 76k particles (38k mobile) driven entirely by GPU shaders.
 * Pointer interaction creates a fluid trail with spring physics.
 * Morphs into procedural shapes (cube/torus/torusKnot/galaxy) when idle.
 */

const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PARTICLE_COUNT = reducedMotion ? 22000 : isMobile ? 38000 : 76000;
const TRAIL_COUNT = 6;

const IDLE_DELAY_S = 8;        // idle segundos antes de morfar p/ próxima forma
const SHAPE_DWELL_S = 30;      // segundos na forma antes de voltar ao vortex
const MORPH_DURATION_S = 2.5;  // duração da transição vortex↔forma
const TOUCH_FADE_S = 0.8;      // retorno acelerado ao vortex quando tocado

export function createVortexWallpaper(_w: number, _h: number, forcedShape?: ShapeName) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 50);
  camera.position.set(0, 0, 7.4);

  // ── Geometry ──
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const follows = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const u = Math.random();
    const v = Math.random();
    const w = Math.random();
    const radius = 2.18 * Math.cbrt(u);
    const theta = Math.PI * 2 * v;
    const cosPhi = 2 * w - 1;
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);

    positions[i3] = radius * sinPhi * Math.cos(theta);
    positions[i3 + 1] = radius * cosPhi;
    positions[i3 + 2] = radius * sinPhi * Math.sin(theta);
    seeds[i] = Math.random();
    sizes[i] = 0.55 + Math.pow(Math.random(), 2.2) * 1.8;
    follows[i] = Math.random();
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aFollow', new THREE.BufferAttribute(follows, 1));

  // Morph target positions (zeroed = vortex only; filled by state machine)
  const targetArray = new Float32Array(PARTICLE_COUNT * 3);
  if (forcedShape) generateShape(forcedShape, PARTICLE_COUNT, targetArray);
  geometry.setAttribute('aTarget', new THREE.BufferAttribute(targetArray, 3));

  // ── Trail uniform (array of vec3) ──
  const trailArray = Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector3());

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(devicePixelRatio, isMobile ? 1.35 : 1.8) },
    uInteraction: { value: 0 },
    uVelocity: { value: new THREE.Vector3() },
    uTrail: { value: trailArray },
    uMorph: { value: forcedShape ? 1 : 0 },
    uShapeSpin: { value: new THREE.Matrix3() },
    uShapeSpin2: { value: new THREE.Matrix3() },
    uDragRotation: { value: new THREE.Matrix3() },
  };

  // ── Particle shader material ──
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uInteraction;
      uniform vec3 uVelocity;
      uniform vec3 uTrail[${TRAIL_COUNT}];
      uniform float uMorph;
      uniform mat3 uShapeSpin;
      uniform mat3 uShapeSpin2;
      uniform mat3 uDragRotation;

      attribute float aSeed;
      attribute float aSize;
      attribute float aFollow;
      attribute vec3 aTarget;

      varying float vAlpha;
      varying float vHue;
      varying float vCore;

      mat2 rotate2D(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(c, -s, s, c);
      }

      vec3 getTrailPoint(float t) {
        if (t < 0.1667) return uTrail[0];
        if (t < 0.3333) return uTrail[1];
        if (t < 0.5000) return uTrail[2];
        if (t < 0.6667) return uTrail[3];
        if (t < 0.8333) return uTrail[4];
        return uTrail[5];
      }

      // inline hash + value noise (GLSL ES 1.00 has no built-in noise)
      float hash11(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      float noise1(float x) {
        float i = floor(x);
        float f = fract(x);
        float u = f * f * (3.0 - 2.0 * f);
        return mix(hash11(i), hash11(i + 1.0), u) * 2.0 - 1.0;
      }

      void main() {
        // ── 1. sphereHome: base sphere with slow waves/spin (no trail) ──
        vec3 sphereHome = position;
        float radius = length(sphereHome);
        float normalizedRadius = radius / 2.18;
        float core = 1.0 - smoothstep(0.05, 1.0, normalizedRadius);

        float spinSpeed = mix(1.05, 0.24, normalizedRadius);
        float spin = uTime * spinSpeed + sphereHome.y * 1.28 + aSeed * 6.2831853;
        sphereHome.xz = rotate2D(spin) * sphereHome.xz;

        float waveA = sin(uTime * 1.15 + aSeed * 19.0 + sphereHome.y * 3.4);
        float waveB = cos(uTime * 0.78 + aSeed * 11.0 + radius * 5.2);
        float turbulence = (0.025 + core * 0.075) * (0.35 + uInteraction * 0.65);
        sphereHome += vec3(
          waveA * turbulence,
          waveB * turbulence * 0.72,
          (waveA + waveB) * turbulence * 0.45
        );

        float equator = 1.0 - smoothstep(0.25, 1.9, abs(sphereHome.y));
        sphereHome.xz *= 0.87 + equator * 0.17;
        sphereHome.y += sin(spin * 2.0 + uTime * 0.7) * 0.045 * (1.0 - normalizedRadius);

        // ── 2. fluid offset: trail + shear (dragTwist excluded — too distorting on shapes) ──
        vec3 fluid = vec3(0.0);

        vec3 head = uTrail[0];
        vec3 delayed = getTrailPoint(aFollow);
        vec3 flowCenter = mix(head, delayed, 0.76);
        float depthLag = smoothstep(-2.2, 2.2, sphereHome.z);
        flowCenter -= uVelocity * (0.028 + 0.105 * aFollow) * (0.45 + depthLag);
        fluid += flowCenter;

        float speed = min(length(uVelocity), 8.0);
        vec2 direction = normalize(uVelocity.xy + vec2(0.0001));
        vec2 tangent = vec2(-direction.y, direction.x);
        float shear = speed * 0.025 * (aFollow - 0.35) * (1.0 - normalizedRadius * 0.55);
        fluid.xy += tangent * shear;

        // Vortex mode gets the full physics baked in; shape mode adds fluid on top.
        vec3 vortexPos = sphereHome + fluid;

        // ── 3. targetPos: shape with rotation + per-particle boil ──
        vec3 spunTarget = uDragRotation * uShapeSpin2 * (uShapeSpin * aTarget);
        // boil — each particle displaces along its own seeded noise so the
        // shape "dissolves" rather than reading as a hard surface
        float boilAmp = 0.085;
        vec3 boil = vec3(
          noise1(aSeed * 17.0 + uTime * 0.95),
          noise1(aSeed * 31.0 + uTime * 1.15),
          noise1(aSeed * 53.0 + uTime * 1.05)
        ) * boilAmp;
        vec3 targetPos = spunTarget + boil;

        // ── 4. combine: morph between sphereHome (vortex identity) and
        //    targetPos (shape), keeping fluid always additive so trail/drag
        //    affect both modes identically
        vec3 finalPos = mix(sphereHome, targetPos, uMorph) + fluid;

        vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float perspective = 7.4 / max(1.0, -mvPosition.z);
        gl_PointSize = aSize * uPixelRatio * perspective * (2.0 + core * 1.75);

        vAlpha = mix(0.16, 0.78, core) * (0.65 + aSeed * 0.35);
        vHue = fract(aSeed * 0.55 + normalizedRadius * 0.34 + uTime * 0.018);
        vCore = core;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vHue;
      varying float vCore;

      vec3 palette(float t) {
        vec3 cyan = vec3(0.08, 0.68, 1.00);
        vec3 violet = vec3(0.62, 0.18, 1.00);
        vec3 mint = vec3(0.10, 1.00, 0.72);
        float firstMix = smoothstep(0.00, 0.58, t);
        float secondMix = smoothstep(0.58, 1.00, t);
        return mix(mix(cyan, violet, firstMix), mint, secondMix * 0.46);
      }

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;

        float solid = smoothstep(0.48, 0.08, dist);
        float halo = exp(-dist * 7.5);
        float alpha = (solid * 0.72 + halo * 0.55) * vAlpha;

        vec3 color = palette(vHue);
        color *= 0.72 + halo * 1.35 + vCore * 0.48;

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  scene.add(particles);

  // ── Central halo ──
  const haloMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime,
      uCenter: { value: trailArray[0] },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform vec3 uCenter;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + uCenter, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv - 0.5;
        float d = length(uv);
        float pulse = 0.94 + sin(uTime * 2.0) * 0.06;
        float glow = exp(-d * 8.0 / pulse) * (1.0 - smoothstep(0.22, 0.5, d));
        vec3 color = mix(vec3(0.06, 0.35, 1.0), vec3(0.55, 0.10, 1.0), d * 1.8);
        gl_FragColor = vec4(color, glow * 0.15);
      }
    `,
  });

  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), haloMaterial);
  halo.position.z = -0.45;
  scene.add(halo);

  // ── Trail / Spring physics ──
  const origin = new THREE.Vector3();
  const pointerDesired = new THREE.Vector3();
  const pointerNdc = new THREE.Vector2();
  const intersection = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const springForce = new THREE.Vector3();

  let pointerActive = false;
  let pointerId: number | null = null;
  let interaction = 0;

  // ── Morph state ──
  type MorphPhase = 'vortex_idle' | 'morphing' | 'shape_idle';
  const SHAPES_ORDER: ShapeName[] = [...SHAPE_NAMES];
  let phase: MorphPhase = forcedShape ? 'shape_idle' : 'vortex_idle';
  let morphDir: 1 | -1 = forcedShape ? 1 : -1;
  let morphProgress = forcedShape ? 1 : 0;
  let shapeIdx = 0;
  let shapeStartS = 0;
  let isTouchFading = false;
  let currentShapeName: ShapeName | undefined = forcedShape;
  let currentTimeS = 0;
  let lastInteractionS = 0;

  // Drag-driven rotation (accumulates while dragging, decays on release)
  let dragRotX = 0;
  let dragRotY = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  // Angular velocity for flick momentum (rad/s, continues after release)
  let angularVelX = 0;
  let angularVelY = 0;
  let prevDragRotX = 0;
  let prevDragRotY = 0;
  const _dragRy = new THREE.Matrix3();
  const _dragRx = new THREE.Matrix3();

  const trail: { position: THREE.Vector3; velocity: THREE.Vector3 }[] = Array.from(
    { length: TRAIL_COUNT },
    () => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3() }),
  );

  // ── Interaction overlay ──
  const interactionLayer = document.createElement('div');
  interactionLayer.style.cssText =
    'position:fixed;inset:0;z-index:1;touch-action:none;pointer-events:auto;';
  interactionLayer.id = 'vortex-interaction';

  // Insert right after the canvas (before OS UI so we don't steal events from it)
  // Wait for DOM — the canvas may not exist yet. We insert in update() or at timout.
  // Instead, use a small delay or check on first frame.

  function pointerToWorld(clientX: number, clientY: number) {
    const rect = interactionLayer.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);

    if (!raycaster.ray.intersectPlane(interactionPlane, intersection)) return;

    const maxRadius = Math.min(3.25, 2.35 * camera.aspect + 0.8);
    const distance = intersection.length();
    if (distance > maxRadius) {
      intersection.multiplyScalar(maxRadius / distance);
    }
    pointerDesired.copy(intersection);
  }

  function shouldHandleVortex(el: EventTarget | null): boolean {
    if (!el) return false;
    const target = el as HTMLElement;
    // Exclude OS UI elements
    if (target.closest('.win98-window, .taskbar, .start-menu, .desktop-icon-cell')) return false;
    // Accept body, canvas, desktop grid background, or interaction layer
    if (
      target === document.body ||
      target === document.getElementById('os-canvas') ||
      target.classList.contains('desktop-grid') ||
      target.id === 'vortex-interaction'
    ) {
      return true;
    }
    return false;
  }

  function onPointerDown(e: PointerEvent) {
    if (!shouldHandleVortex(e.target)) return;
    lastInteractionS = currentTimeS;
    pointerActive = true;
    pointerId = e.pointerId;
    interactionLayer.setPointerCapture(e.pointerId);
    interactionLayer.classList.add('is-dragging');
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    pointerToWorld(e.clientX, e.clientY);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    // Hover (sem botão) também conta como interação p/ resetar o idle
    lastInteractionS = currentTimeS;
    if (!pointerActive || e.pointerId !== pointerId) return;
    // Accumulate drag rotation: horizontal drag → Y rotation, vertical → X
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    dragRotY += dx * 0.006;
    dragRotX += dy * 0.006;
    pointerToWorld(e.clientX, e.clientY);
    e.preventDefault();
  }

  function onPointerUp(e: PointerEvent) {
    if (pointerId !== null && e.pointerId !== pointerId) return;
    pointerActive = false;
    pointerId = null;
    pointerDesired.set(0, 0, 0);
    interactionLayer.classList.remove('is-dragging');
  }

  function onPointerCancel() {
    pointerActive = false;
    pointerId = null;
    pointerDesired.set(0, 0, 0);
    interactionLayer.classList.remove('is-dragging');
  }

  // Insert interaction layer into DOM on first update (canvas already exists)
  let inserted = false;

  // ── Spring physics ──
  function updateSpring(
    node: { position: THREE.Vector3; velocity: THREE.Vector3 },
    target: THREE.Vector3,
    stiffness: number,
    damping: number,
    dt: number,
  ) {
    springForce.subVectors(target, node.position);
    node.velocity.addScaledVector(springForce, stiffness * dt);
    node.velocity.multiplyScalar(Math.exp(-damping * dt));
    node.position.addScaledVector(node.velocity, dt);
  }

  // ── Morph helpers ──
  function smoothEase(x: number): number {
    return x * x * (3 - 2 * x);
  }

  function applyShapeSpin(name: ShapeName | undefined, t: number) {
    const m1 = uniforms.uShapeSpin.value as THREE.Matrix3;
    const m2 = uniforms.uShapeSpin2.value as THREE.Matrix3;
    if (!name) {
      m1.identity();
      m2.identity();
      return;
    }
    switch (name) {
      case 'galaxy': {
        // Y-axis rotation only (flat disk should stay flat)
        const a = t * 0.18;
        const c = Math.cos(a), s = Math.sin(a);
        m1.set(c, 0, s, 0, 1, 0, -s, 0, c);
        m2.identity();
        break;
      }
      case 'cube': {
        // Multi-axis tumble (Y primary, X secondary)
        const ax = t * 0.07;
        const ay = t * 0.05;
        const cx = Math.cos(ax), sx = Math.sin(ax);
        const cy = Math.cos(ay), sy = Math.sin(ay);
        // Y rotation
        m1.set(cy, 0, sy, 0, 1, 0, -sy, 0, cy);
        // X rotation
        m2.set(1, 0, 0, 0, cx, -sx, 0, sx, cx);
        break;
      }
      case 'torus': {
        // Steady Y spin
        const a = t * 0.22;
        const c = Math.cos(a), s = Math.sin(a);
        m1.set(c, 0, s, 0, 1, 0, -s, 0, c);
        // Small Z wobble so the ring breathes
        const az = t * 0.10;
        const cz = Math.cos(az), sz = Math.sin(az);
        m2.set(cz, -sz, 0, sz, cz, 0, 0, 0, 1);
        break;
      }
      case 'torusKnot': {
        // X + Y compound
        const ax = t * 0.13;
        const ay = t * 0.10;
        const cx = Math.cos(ax), sx = Math.sin(ax);
        const cy = Math.cos(ay), sy = Math.sin(ay);
        m1.set(cy, 0, sy, 0, 1, 0, -sy, 0, cy);
        m2.set(1, 0, 0, 0, cx, -sx, 0, sx, cx);
        break;
      }
    }
  }

  function loadShape(name: ShapeName) {
    generateShape(name, PARTICLE_COUNT, targetArray);
    geometry.attributes.aTarget.needsUpdate = true;
    currentShapeName = name;
  }

  function advanceMorphState(t: number, dt: number) {
    switch (phase) {
      case 'vortex_idle': {
        applyShapeSpin(undefined, t);
        if (t - lastInteractionS >= IDLE_DELAY_S) {
          const next = SHAPES_ORDER[shapeIdx % SHAPES_ORDER.length];
          loadShape(next);
          phase = 'morphing';
          morphDir = 1;
          isTouchFading = false;
        }
        break;
      }
      case 'morphing': {
        const duration = isTouchFading ? TOUCH_FADE_S : MORPH_DURATION_S;
        morphProgress += (morphDir * dt) / duration;
        if (morphProgress >= 1) {
          morphProgress = 1;
          uniforms.uMorph.value = 1;
          phase = 'shape_idle';
          shapeStartS = t;
        } else if (morphProgress <= 0) {
          morphProgress = 0;
          uniforms.uMorph.value = 0;
          shapeIdx = (shapeIdx + 1) % SHAPES_ORDER.length;
          phase = 'vortex_idle';
          isTouchFading = false;
          currentShapeName = undefined;
        } else {
          uniforms.uMorph.value = smoothEase(morphProgress);
        }
        applyShapeSpin(currentShapeName, t);
        break;
      }
      case 'shape_idle': {
        applyShapeSpin(currentShapeName, t);
        if (t - shapeStartS >= SHAPE_DWELL_S) {
          phase = 'morphing';
          morphDir = -1;
          isTouchFading = false;
        }
        break;
      }
    }
  }

  // ── Public API ──
  function update(t: number, dt: number) {
    currentTimeS = t;
    // Insert interaction overlay if not yet
    if (!inserted) {
      const canvas = document.getElementById('os-canvas');
      if (canvas && canvas.parentNode) {
        canvas.parentNode.insertBefore(interactionLayer, canvas.nextSibling);
        inserted = true;

        interactionLayer.addEventListener('pointerdown', onPointerDown);
        interactionLayer.addEventListener('pointermove', onPointerMove);
        interactionLayer.addEventListener('pointerup', onPointerUp);
        interactionLayer.addEventListener('pointercancel', onPointerCancel);
        interactionLayer.addEventListener('lostpointercapture', onPointerCancel);
      }
    }

    // Smooth interaction intensity
    interaction += ((pointerActive ? 1 : 0) - interaction) * (1 - Math.exp(-9 * dt));

    // First trail node follows pointer
    updateSpring(trail[0], pointerActive ? pointerDesired : origin, 58, 10.5, dt);

    // Subsequent nodes chase the previous one
    for (let i = 1; i < TRAIL_COUNT; i++) {
      updateSpring(trail[i], trail[i - 1].position, 43 - i * 3.6, 10.2 - i * 0.35, dt);
    }

    // Zero out when settled
    const settled =
      !pointerActive &&
      trail.every((n) => n.position.lengthSq() < 1e-7 && n.velocity.lengthSq() < 1e-7);

    if (settled) {
      for (const node of trail) {
        node.position.set(0, 0, 0);
        node.velocity.set(0, 0, 0);
      }
    }

    // Copy trail positions to uniforms
    for (let i = 0; i < TRAIL_COUNT; i++) {
      trailArray[i].copy(trail[i].position);
    }

    // Morph state machine (forcedShape bypasses scheduler)
    if (forcedShape) {
      uniforms.uMorph.value = 1;
      applyShapeSpin(forcedShape, t);
    } else {
      advanceMorphState(t, dt);
    }

    // Track angular velocity during drag (delta of dragRot per frame)
    if (pointerActive) {
      const dx = dragRotX - prevDragRotX;
      const dy = dragRotY - prevDragRotY;
      // Smooth toward new velocity (avoid single-frame spikes)
      angularVelX = angularVelX * 0.6 + (dx / Math.max(dt, 1e-4)) * 0.4;
      angularVelY = angularVelY * 0.6 + (dy / Math.max(dt, 1e-4)) * 0.4;
    } else {
      // Flick momentum: continue spinning in drag direction, light friction
      dragRotX += angularVelX * dt;
      dragRotY += angularVelY * dt;
      const friction = Math.exp(-0.4 * dt);
      angularVelX *= friction;
      angularVelY *= friction;
    }
    prevDragRotX = dragRotX;
    prevDragRotY = dragRotY;
    // Build uDragRotation = Ry(dragRotY) * Rx(dragRotX)
    const cx = Math.cos(dragRotX), sx = Math.sin(dragRotX);
    const cy = Math.cos(dragRotY), sy = Math.sin(dragRotY);
    _dragRy.set(cy, 0, sy, 0, 1, 0, -sy, 0, cy);
    _dragRx.set(1, 0, 0, 0, cx, -sx, 0, sx, cx);
    (uniforms.uDragRotation.value as THREE.Matrix3).multiplyMatrices(_dragRy, _dragRx);

    uniforms.uTime.value = t;
    uniforms.uInteraction.value = interaction;
    uniforms.uVelocity.value.copy(trail[0].velocity);
  }

  function resize(newWidth: number, newHeight: number) {
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
  }

  return {
    scene,
    camera,
    update,
    resize,
    getMorphState: () => ({
      uMorph: uniforms.uMorph.value as number,
      phase,
      morphProgress,
      shapeIdx,
      currentShapeName: currentShapeName ?? null,
      forcedShape: forcedShape ?? null,
      dragRotX,
      dragRotY,
      angularVelX,
      angularVelY,
      pointerActive,
    }),
  };
}
