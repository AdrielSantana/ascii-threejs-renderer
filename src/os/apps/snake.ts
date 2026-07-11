import type { App } from './registry';
import { createIcon } from '../icons';

const GRID_W = 20;
const GRID_H = 20;
const CELL = 12;

type Dir = 'up' | 'down' | 'left' | 'right';

interface Point { x: number; y: number }

export const snakeApp: App = {
  id: 'snake',
  title: 'Snake',
  label: 'Snake',
  icon: createIcon('snake'),
  defaultRect: { x: 60, y: 60, w: 320, h: 380 },
  minSize: { w: 260, h: 320 },
  mount(body) {
    body.className = 'win98-body';

    const container = document.createElement('div');
    container.style.cssText = 'flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#000; padding:8px;';

    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-family:VT323,monospace; font-size:20px; color:#00ff00; margin-bottom:4px;';
    scoreEl.textContent = 'Score: 0';

    const canvas = document.createElement('canvas');
    canvas.width = GRID_W * CELL;
    canvas.height = GRID_H * CELL;
    canvas.style.cssText = 'image-rendering:pixelated; border:1px solid #333;';
    canvas.tabIndex = 0;
    container.appendChild(scoreEl);
    container.appendChild(canvas);

    // Status
    const status = document.createElement('div');
    status.style.cssText = 'font-family:VT323,monospace; font-size:14px; color:#888; margin-top:4px;';
    status.textContent = 'Arrow keys / swipe to move';
    container.appendChild(status);

    // Button row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:8px; margin-top:8px;';

    const restartBtn = document.createElement('button');
    restartBtn.className = 'app-button';
    restartBtn.textContent = 'Restart';
    btnRow.appendChild(restartBtn);

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'app-button';
    pauseBtn.textContent = 'Pause';
    btnRow.appendChild(pauseBtn);

    container.appendChild(btnRow);
    body.appendChild(container);

    const ctx = canvas.getContext('2d')!;

    // Game state
    let snake: Point[] = [{ x: 10, y: 10 }];
    let food: Point = { x: 15, y: 10 };
    let dir: Dir = 'right';
    let nextDir: Dir = 'right';
    let paused = false;
    let gameOver = false;
    let score = 0;
    let loopTimer: number | null = null;

    // Touch swipe
    let touchStartX = 0;
    let touchStartY = 0;

    const placeFood = () => {
      const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
      let p: Point;
      do {
        p = { x: Math.floor(Math.random() * GRID_W), y: Math.floor(Math.random() * GRID_H) };
      } while (occupied.has(`${p.x},${p.y}`));
      food = p;
    };

    const gameLoop = () => {
      if (paused || gameOver) return;

      dir = nextDir;

      const head = { ...snake[0] };
      switch (dir) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
      }

      // Wall wrap
      if (head.x < 0) head.x = GRID_W - 1;
      if (head.x >= GRID_W) head.x = 0;
      if (head.y < 0) head.y = GRID_H - 1;
      if (head.y >= GRID_H) head.y = 0;

      // Self collision
      for (const seg of snake) {
        if (seg.x === head.x && seg.y === head.y) {
          gameOver = true;
          draw();
          status.textContent = 'Game Over! Press Restart';
          return;
        }
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreEl.textContent = `Score: ${score}`;
        placeFood();
      } else {
        snake.pop();
      }

      draw();
    };

    const draw = () => {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= GRID_W; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= GRID_H; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(canvas.width, y * CELL);
        ctx.stroke();
      }

      // Snake
      snake.forEach((seg, i) => {
        const isHead = i === 0;
        ctx.fillStyle = isHead ? '#00ff00' : '#00cc00';
        ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
        if (isHead) {
          ctx.fillStyle = '#fff';
          const cx = seg.x * CELL + CELL / 2;
          const cy = seg.y * CELL + CELL / 2;
          ctx.fillRect(cx - 2, cy - 2, 2, 2);
        }
      });

      // Food
      ctx.fillStyle = '#ff2a86';
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 1, 0, Math.PI * 2);
      ctx.fill();

      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff2a86';
        ctx.font = '16px VT323,monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
      }

      if (paused && !gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00f0ff';
        ctx.font = '16px VT323,monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
      }
    };

    const reset = () => {
      if (loopTimer !== null) clearInterval(loopTimer);
      snake = [{ x: 10, y: 10 }];
      dir = 'right';
      nextDir = 'right';
      score = 0;
      gameOver = false;
      paused = false;
      scoreEl.textContent = 'Score: 0';
      status.textContent = 'Arrow keys / swipe to move';
      pauseBtn.textContent = 'Pause';
      placeFood();
      draw();
      loopTimer = window.setInterval(gameLoop, 150);
    };

    // Keyboard
    canvas.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowUp': if (dir !== 'down') nextDir = 'up'; e.preventDefault(); break;
        case 'ArrowDown': if (dir !== 'up') nextDir = 'down'; e.preventDefault(); break;
        case 'ArrowLeft': if (dir !== 'right') nextDir = 'left'; e.preventDefault(); break;
        case 'ArrowRight': if (dir !== 'left') nextDir = 'right'; e.preventDefault(); break;
        case ' ': e.preventDefault(); togglePause(); break;
      }
    });

    // Touch swipe on canvas
    canvas.addEventListener('pointerdown', (e) => {
      touchStartX = e.clientX;
      touchStartY = e.clientY;
    });

    canvas.addEventListener('pointerup', (e) => {
      const dx = e.clientX - touchStartX;
      const dy = e.clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < 10) return; // tap threshold

      if (absDx > absDy) {
        if (dx > 0 && dir !== 'left') nextDir = 'right';
        else if (dx < 0 && dir !== 'right') nextDir = 'left';
      } else {
        if (dy > 0 && dir !== 'up') nextDir = 'down';
        else if (dy < 0 && dir !== 'down') nextDir = 'up';
      }
    });

    const togglePause = () => {
      if (gameOver) return;
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      draw();
    };

    restartBtn.addEventListener('click', reset);
    pauseBtn.addEventListener('click', togglePause);

    // Start game
    reset();
  },
  unmount(body) {
    body.innerHTML = '';
  },
};
