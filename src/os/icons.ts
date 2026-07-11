export function createIcon(name: string, size = 32): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  switch (name) {
    case 'notepad':
      drawNotepad(ctx, size);
      break;
    case 'about':
      drawAbout(ctx, size);
      break;
    case 'terminal':
      drawTerminal(ctx, size);
      break;
    case 'settings':
      drawSettings(ctx, size);
      break;
    case 'paint':
      drawPaint(ctx, size);
      break;
    case 'snake':
      drawSnake(ctx, size);
      break;
    default:
      drawGeneric(ctx, size);
  }

  return canvas;
}

function drawNotepad(ctx: CanvasRenderingContext2D, size: number) {
  const s = size;
  ctx.fillStyle = '#c3c3c3';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#fff';
  ctx.fillRect(4, 6, s - 8, s - 10);
  ctx.fillStyle = '#000';
  for (let y = 9; y < s - 4; y += 4) {
    ctx.fillRect(6, y, s - 12, 1);
  }
  ctx.fillStyle = '#1084d0';
  ctx.fillRect(0, 0, s, 4);
}

function drawAbout(ctx: CanvasRenderingContext2D, size: number) {
  const s = size;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(6, 6, s - 12, 3);
  ctx.fillRect(6, 12, s - 12, 3);
  ctx.fillRect(6, 18, s - 12, 3);
  ctx.fillStyle = '#ff2a86';
  ctx.fillRect(6, 24, 10, 3);
}

function drawTerminal(ctx: CanvasRenderingContext2D, size: number) {
  const s = size;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(4, 6, 6, 3);
  ctx.fillRect(4, 12, s - 8, 3);
  ctx.fillRect(4, 18, s - 12, 3);
  ctx.fillRect(4, 24, 8, 3);
}

function drawSettings(ctx: CanvasRenderingContext2D, size: number) {
  const s = size;
  ctx.fillStyle = '#c3c3c3';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#808080';
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPaint(ctx: CanvasRenderingContext2D, size: number) {
  const s = size;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#ff2a86';
  ctx.fillRect(4, 4, s - 8, s - 8);
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(8, 8, 12, 12);
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(14, 14, 10, 10);
  ctx.fillStyle = '#ffff00';
  ctx.fillRect(6, 20, 8, 8);
}

function drawSnake(ctx: CanvasRenderingContext2D, size: number) {
  const s = size;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(6, 16, 4, 4);
  ctx.fillRect(10, 12, 4, 4);
  ctx.fillRect(14, 8, 4, 4);
  ctx.fillRect(14, 4, 4, 4);
  ctx.fillStyle = '#ff2a86';
  ctx.fillRect(20, 14, 6, 6);
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(10, 12, 2, 2);
  ctx.fillRect(12, 12, 2, 2);
}

function drawGeneric(ctx: CanvasRenderingContext2D, size: number) {
  const s = size;
  ctx.fillStyle = '#6a4c93';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#fff';
  ctx.fillRect(8, 8, s - 16, s - 16);
}
