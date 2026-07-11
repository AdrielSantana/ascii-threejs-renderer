export interface DesktopIcon {
  id: string;
  label: string;
  icon: HTMLCanvasElement;
  onOpen: () => void;
}

export class Desktop {
  private container: HTMLElement;
  private grid: HTMLElement;
  private icons: DesktopIcon[] = [];
  private contextMenu: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.style.position = 'relative';

    this.grid = document.createElement('div');
    this.grid.className = 'desktop-grid';
    this.grid.style.position = 'absolute';
    this.grid.style.inset = '0';
    this.grid.style.zIndex = '1';
    this.grid.style.pointerEvents = 'auto';

    container.appendChild(this.grid);

    this.grid.addEventListener('pointerdown', (e) => {
      if (e.target === this.grid) {
        this.hideContextMenu();
      }
    });
  }

  setIcons(icons: DesktopIcon[]): void {
    this.icons = icons;
    this.grid.innerHTML = '';
    this.hideContextMenu();
    void this.icons;

    for (const icon of icons) {
      const cell = this.createCell(icon);
      this.grid.appendChild(cell);
    }
  }

  private createCell(icon: DesktopIcon): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'desktop-icon-cell';
    cell.dataset.id = icon.id;

    const img = document.createElement('img');
    img.className = 'desktop-icon-img';
    img.src = icon.icon.toDataURL('image/png');
    img.alt = icon.label;
    img.width = 32;
    img.height = 32;

    const label = document.createElement('div');
    label.className = 'desktop-icon-label';
    label.textContent = this.wrapLabel(icon.label);

    cell.appendChild(img);
    cell.appendChild(label);

    this.attachPointerHandlers(cell, icon);

    return cell;
  }

  private attachPointerHandlers(cell: HTMLElement, icon: DesktopIcon): void {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let longPressTimer: number | null = null;
    let triggeredLongPress = false;

    const clearLongPress = (): void => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    cell.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      triggeredLongPress = false;
      startX = e.clientX;
      startY = e.clientY;
      startTime = performance.now();

      longPressTimer = window.setTimeout(() => {
        triggeredLongPress = true;
        this.showContextMenu(e.clientX, e.clientY);
      }, 500);
    });

    cell.addEventListener('pointerup', (e) => {
      clearLongPress();
      if (triggeredLongPress) return;

      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      const dt = performance.now() - startTime;

      if (dx <= 8 && dy <= 8 && dt <= 300) {
        icon.onOpen();
      }
    });

    cell.addEventListener('pointercancel', clearLongPress);
    cell.addEventListener('pointerleave', clearLongPress);
  }

  private wrapLabel(label: string): string {
    const words = label.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= 10) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word.length > 10 ? word.slice(0, 10) : word;
      }
    }
    if (current) lines.push(current);

    return lines.slice(0, 2).join('\n');
  }

  private showContextMenu(x: number, y: number): void {
    this.hideContextMenu();

    const menu = document.createElement('div');
    menu.className = 'desktop-context-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const openItem = document.createElement('div');
    openItem.className = 'desktop-context-item';
    openItem.textContent = 'Open';

    const propsItem = document.createElement('div');
    propsItem.className = 'desktop-context-item';
    propsItem.textContent = 'Properties';

    menu.appendChild(openItem);
    menu.appendChild(propsItem);

    this.grid.appendChild(menu);
    this.contextMenu = menu;

    const closeOnPointer = (e: PointerEvent): void => {
      if (!menu.contains(e.target as Node)) {
        this.hideContextMenu();
        document.removeEventListener('pointerdown', closeOnPointer);
      }
    };

    // Defer so the current pointerup does not immediately close it.
    window.setTimeout(() => {
      document.addEventListener('pointerdown', closeOnPointer);
    }, 0);
  }

  private hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }
}
