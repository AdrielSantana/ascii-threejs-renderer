export interface WindowSpec {
  id: string;
  title: string;
  icon?: HTMLCanvasElement; // 32x32 procedural canvas
  defaultRect: { x: number; y: number; w: number; h: number };
  minSize?: { w: number; h: number };
  mount(body: HTMLElement): void;
  unmount?(body: HTMLElement): void;
}

export class WindowManager {
  private root: HTMLElement;
  private windows = new Map<string, HTMLElement>();
  private specs = new Map<string, WindowSpec>();
  private zIndex = 100;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'wm-root';
    this.root.style.position = 'absolute';
    this.root.style.inset = '0';
    this.root.style.pointerEvents = 'none';
    container.appendChild(this.root);
  }

  open(spec: WindowSpec): void {
    if (this.windows.has(spec.id)) {
      this.focus(spec.id);
      return;
    }

    const rect = this.clampRect(spec.defaultRect);

    const win = document.createElement('div');
    win.className = 'win98-window';
    win.dataset.id = spec.id;
    win.style.position = 'absolute';
    win.style.left = `${rect.x}px`;
    win.style.top = `${rect.y}px`;
    win.style.width = `${rect.w}px`;
    win.style.height = `${rect.h}px`;
    win.style.pointerEvents = 'auto';
    win.style.zIndex = String(this.nextZIndex());

    const titlebar = document.createElement('div');
    titlebar.className = 'win98-titlebar';
    titlebar.style.touchAction = 'none';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'win98-titlebar-icon';
    if (spec.icon) {
      iconSpan.appendChild(spec.icon);
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'win98-titlebar-title';
    titleSpan.textContent = spec.title;

    const buttons = document.createElement('div');
    buttons.className = 'win98-titlebar-buttons';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'win98-btn-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close(spec.id);
    });

    buttons.appendChild(closeBtn);
    titlebar.appendChild(iconSpan);
    titlebar.appendChild(titleSpan);
    titlebar.appendChild(buttons);

    const menubar = document.createElement('div');
    menubar.className = 'win98-menubar';

    const body = document.createElement('div');
    body.className = 'win98-body';

    win.appendChild(titlebar);
    win.appendChild(menubar);
    win.appendChild(body);

    this.setupDrag(win, titlebar);
    this.setupFocus(win, spec.id);

    this.root.appendChild(win);
    this.windows.set(spec.id, win);
    this.specs.set(spec.id, spec);

    spec.mount(body);
  }

  close(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;

    const body = win.querySelector('.win98-body') as HTMLElement | null;
    const spec = this.findSpec(id);
    if (body && spec?.unmount) {
      spec.unmount(body);
    }

    win.remove();
    this.windows.delete(id);
    this.specs.delete(id);
  }

  focus(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    win.style.zIndex = String(this.nextZIndex());
  }

  isOpen(id: string): boolean {
    return this.windows.has(id);
  }

  listOpen(): string[] {
    return Array.from(this.windows.keys());
  }

  private nextZIndex(): number {
    this.zIndex += 1;
    return this.zIndex;
  }

  private clampRect(rect: { x: number; y: number; w: number; h: number }) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const minW = 120;
    const minH = 80;
    const w = Math.max(minW, Math.min(rect.w, vw));
    const h = Math.max(minH, Math.min(rect.h, vh));
    const x = Math.max(0, Math.min(rect.x, vw - w));
    const y = Math.max(0, Math.min(rect.y, vh - h));
    return { x, y, w, h };
  }

  private setupDrag(win: HTMLElement, titlebar: HTMLElement): void {
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let dragging = false;

    titlebar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = win.offsetLeft;
      initialTop = win.offsetTop;
      titlebar.setPointerCapture(e.pointerId);
    });

    titlebar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      win.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    });

    titlebar.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      titlebar.releasePointerCapture(e.pointerId);

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = initialLeft + dx;
      const newTop = initialTop + dy;

      const clamped = this.clampRect({
        x: newLeft,
        y: newTop,
        w: win.offsetWidth,
        h: win.offsetHeight,
      });

      win.style.transform = '';
      win.style.left = `${clamped.x}px`;
      win.style.top = `${clamped.y}px`;
    });

    titlebar.addEventListener('pointercancel', () => {
      if (!dragging) return;
      dragging = false;
      win.style.transform = '';
    });
  }

  private setupFocus(win: HTMLElement, id: string): void {
    win.addEventListener('pointerdown', () => {
      this.focus(id);
    });
  }

  private findSpec(id: string): WindowSpec | undefined {
    return this.specs.get(id);
  }
}
