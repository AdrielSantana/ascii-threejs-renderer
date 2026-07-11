import * as THREE from 'three';

const MAX_DIST = 60;
const DEAD_ZONE = 10;
const LOOK_SENS = 0.004;
const PITCH_LIMIT = Math.PI / 3;

interface TouchState {
  joystick: {
    active: boolean;
    id: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null;
  look: {
    active: boolean;
    id: number;
    lastX: number;
    lastY: number;
  } | null;
}

export function setupMobileControls(
  camera: THREE.PerspectiveCamera,
  keys: Record<string, boolean>,
  renderer: THREE.WebGLRenderer,
  onActivate: () => void,
): () => void {
  const state: TouchState = { joystick: null, look: null };
  let activated = false;

  // --- Joystick DOM elements ---
  let joystickBase: HTMLElement | null = null;
  let joystickThumb: HTMLElement | null = null;

  function createJoystickDOM(cx: number, cy: number) {
    joystickBase = document.createElement('div');
    joystickBase.style.cssText = [
      'position:fixed', 'border-radius:50%',
      'width:' + MAX_DIST * 2 + 'px',
      'height:' + MAX_DIST * 2 + 'px',
      'border:2px solid rgba(200,190,170,0.25)',
      'background:rgba(200,190,170,0.06)',
      'pointer-events:none', 'z-index:9999',
      'transform:translate(-50%,-50%)',
      'left:' + cx + 'px', 'top:' + cy + 'px',
    ].join(';');
    joystickThumb = document.createElement('div');
    joystickThumb.style.cssText = [
      'position:fixed', 'border-radius:50%',
      'width:24px', 'height:24px',
      'background:rgba(200,190,170,0.35)',
      'border:1px solid rgba(200,190,170,0.5)',
      'pointer-events:none', 'z-index:9999',
      'transform:translate(-50%,-50%)',
      'left:' + cx + 'px', 'top:' + cy + 'px',
    ].join(';');
    document.body.appendChild(joystickBase);
    document.body.appendChild(joystickThumb);
  }

  function removeJoystickDOM() {
    if (joystickBase) { joystickBase.remove(); joystickBase = null; }
    if (joystickThumb) { joystickThumb.remove(); joystickThumb = null; }
  }

  function updateJoystickDOM(cx: number, cy: number) {
    if (joystickThumb) {
      joystickThumb.style.left = cx + 'px';
      joystickThumb.style.top = cy + 'px';
    }
  }

  function clearMovementKeys() {
    keys['KeyW'] = false;
    keys['KeyS'] = false;
    keys['KeyA'] = false;
    keys['KeyD'] = false;
  }

  function handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (!activated) {
      activated = true;
      onActivate();
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const isLeft = t.clientX < window.innerWidth / 2;

      if (isLeft && !state.joystick) {
        state.joystick = {
          active: true, id: t.identifier,
          startX: t.clientX, startY: t.clientY,
          currentX: t.clientX, currentY: t.clientY,
        };
        createJoystickDOM(t.clientX, t.clientY);
      } else if (!isLeft && !state.look) {
        state.look = {
          active: true, id: t.identifier,
          lastX: t.clientX, lastY: t.clientY,
        };
      }
    }
  }

  function handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      // Joystick
      if (state.joystick && state.joystick.id === t.identifier) {
        state.joystick.currentX = t.clientX;
        state.joystick.currentY = t.clientY;
        const dx = t.clientX - state.joystick.startX;
        const dy = t.clientY - state.joystick.startY;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, MAX_DIST);
        const angle = Math.atan2(dy, dx);
        const cx = state.joystick.startX + Math.cos(angle) * clamped;
        const cy = state.joystick.startY + Math.sin(angle) * clamped;
        updateJoystickDOM(cx, cy);

        if (dist < DEAD_ZONE) {
          clearMovementKeys();
        } else {
          const norm = Math.min((dist - DEAD_ZONE) / (MAX_DIST - DEAD_ZONE), 1);
          // dy: negativo = dedo subiu na tela → frente (KeyW)
          // dx: positivo = dedo foi pra direita → direita (KeyD)
          const rawFwd = (-dy / dist) * norm;
          const rawRgt = (dx / dist) * norm;
          keys['KeyW'] = rawFwd > 0.2;
          keys['KeyS'] = rawFwd < -0.2;
          keys['KeyD'] = rawRgt > 0.2;
          keys['KeyA'] = rawRgt < -0.2;
        }
      }

      // Look
      if (state.look && state.look.id === t.identifier) {
        const dx = t.clientX - state.look.lastX;
        const dy = t.clientY - state.look.lastY;
        camera.rotation.y -= dx * LOOK_SENS;
        camera.rotation.x = THREE.MathUtils.clamp(
          camera.rotation.x - dy * LOOK_SENS,
          -PITCH_LIMIT, PITCH_LIMIT,
        );
        state.look.lastX = t.clientX;
        state.look.lastY = t.clientY;
      }
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (state.joystick && state.joystick.id === t.identifier) {
        state.joystick = null;
        removeJoystickDOM();
        clearMovementKeys();
      }
      if (state.look && state.look.id === t.identifier) {
        state.look = null;
      }
    }
  }

  function handleTouchCancel(_e: TouchEvent) {
    state.joystick = null;
    state.look = null;
    removeJoystickDOM();
    clearMovementKeys();
  }

  // Disable context menu on mobile
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  // Add touch listeners
  renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
  renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
  renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
  renderer.domElement.addEventListener('touchcancel', handleTouchCancel, { passive: false });

  return () => {
    renderer.domElement.removeEventListener('touchstart', handleTouchStart);
    renderer.domElement.removeEventListener('touchmove', handleTouchMove);
    renderer.domElement.removeEventListener('touchend', handleTouchEnd);
    renderer.domElement.removeEventListener('touchcancel', handleTouchCancel);
    clearMovementKeys();
    removeJoystickDOM();
  };
}
