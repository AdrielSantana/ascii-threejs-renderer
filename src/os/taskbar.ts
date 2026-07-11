export interface TaskbarApp {
  id: string;
  title: string;
  icon: HTMLCanvasElement;
}

export interface StartMenuItem {
  id: string;
  label: string;
  onClick: () => void;
}

export class Taskbar {
  private container: HTMLElement;
  private bar: HTMLElement;
  private startBtn: HTMLButtonElement;
  private appsContainer: HTMLElement;
  private tray: HTMLElement;
  private battery: HTMLElement;
  private clock: HTMLElement;
  private menu: HTMLElement;

  private startItems: StartMenuItem[] = [];
  private runningApps: TaskbarApp[] = [];
  private activeId: string | null = null;
  private onAppTap: ((id: string) => void) | null = null;
  private clockTimer: number | null = null;
  private menuOpen = false;

  constructor(container: HTMLElement, options?: { onAppTap?: (id: string) => void }) {
    this.container = container;
    this.container.style.position = 'relative';
    this.onAppTap = options?.onAppTap ?? null;

    this.bar = document.createElement('div');
    this.bar.className = 'taskbar';

    this.startBtn = document.createElement('button');
    this.startBtn.className = 'taskbar-start';
    this.startBtn.innerHTML = `${this.flagSvg()} Start`;
    this.startBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.toggleStartMenu();
    });

    this.appsContainer = document.createElement('div');
    this.appsContainer.className = 'taskbar-apps';

    this.battery = document.createElement('span');
    this.battery.className = 'taskbar-battery';
    this.battery.innerHTML = this.batterySvg();

    this.clock = document.createElement('span');
    this.clock.className = 'taskbar-clock';
    this.clock.textContent = this.formatTime(new Date());

    this.tray = document.createElement('div');
    this.tray.className = 'taskbar-tray';
    this.tray.appendChild(this.battery);
    this.tray.appendChild(this.clock);

    this.bar.appendChild(this.startBtn);
    this.bar.appendChild(this.appsContainer);
    this.bar.appendChild(this.tray);

    this.menu = document.createElement('div');
    this.menu.className = 'start-menu';
    this.menu.style.position = 'absolute';
    this.menu.style.display = 'none';

    container.appendChild(this.bar);
    container.appendChild(this.menu);

    document.addEventListener('pointerdown', (e) => {
      if (
        this.menuOpen &&
        !this.menu.contains(e.target as Node) &&
        !this.startBtn.contains(e.target as Node)
      ) {
        this.hideStartMenu();
      }
    });
  }

  setStartMenu(items: StartMenuItem[]): void {
    this.startItems = items;
    this.renderMenu();
  }

  setRunningApps(apps: TaskbarApp[], activeId: string | null): void {
    this.runningApps = apps;
    this.activeId = activeId;
    this.renderApps();
  }

  start(): void {
    this.stop();
    this.updateClock();
    this.clockTimer = window.setInterval(() => {
      this.updateClock();
    }, 1000);
  }

  stop(): void {
    if (this.clockTimer !== null) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private renderMenu(): void {
    this.menu.innerHTML = '';

    for (const item of this.startItems) {
      const row = document.createElement('div');
      row.className = 'start-menu-item';
      row.textContent = item.label;
      row.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        item.onClick();
        this.hideStartMenu();
      });
      this.menu.appendChild(row);
    }

    const divider = document.createElement('div');
    divider.className = 'start-menu-divider';
    this.menu.appendChild(divider);

    const shutdown = document.createElement('div');
    shutdown.className = 'start-menu-item start-menu-shutdown';
    shutdown.textContent = 'Shut Down';
    shutdown.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      // eslint-disable-next-line no-console
      console.log('Shut Down');
      this.hideStartMenu();
    });
    this.menu.appendChild(shutdown);
  }

  private renderApps(): void {
    this.appsContainer.innerHTML = '';

    for (const app of this.runningApps) {
      const btn = document.createElement('button');
      btn.className = 'taskbar-app';
      if (app.id === this.activeId) {
        btn.classList.add('taskbar-app-active');
      }

      const img = document.createElement('img');
      img.src = app.icon.toDataURL('image/png');
      img.alt = app.title;
      img.width = 16;
      img.height = 16;

      const label = document.createElement('span');
      label.className = 'taskbar-app-title';
      label.textContent = app.title;

      btn.appendChild(img);
      btn.appendChild(label);

      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.onAppTap?.(app.id);
      });

      this.appsContainer.appendChild(btn);
    }
  }

  private toggleStartMenu(): void {
    if (this.menuOpen) {
      this.hideStartMenu();
    } else {
      this.showStartMenu();
    }
  }

  private showStartMenu(): void {
    const rect = this.startBtn.getBoundingClientRect();
    this.menu.style.left = `${rect.left}px`;
    this.menu.style.top = `${rect.top - 260}px`;
    this.menu.style.display = 'block';
    this.menuOpen = true;
    this.startBtn.classList.add('taskbar-start-active');
  }

  private hideStartMenu(): void {
    this.menu.style.display = 'none';
    this.menuOpen = false;
    this.startBtn.classList.remove('taskbar-start-active');
  }

  private updateClock(): void {
    this.clock.textContent = this.formatTime(new Date());
  }

  private formatTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private flagSvg(): string {
    return `<svg class="taskbar-start-icon" viewBox="0 0 32 32" width="16" height="16" aria-hidden="true">
      <rect x="4" y="4" width="10" height="10" fill="#ff0000"/>
      <rect x="14" y="4" width="10" height="10" fill="#00ff00"/>
      <rect x="4" y="14" width="10" height="10" fill="#0000ff"/>
      <rect x="14" y="14" width="10" height="10" fill="#ffff00"/>
    </svg>`;
  }

  private batterySvg(): string {
    return `<svg class="taskbar-battery-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="1" y="4" width="12" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1"/>
      <rect x="13" y="6" width="2" height="4" fill="currentColor"/>
      <rect x="3" y="6" width="6" height="4" fill="currentColor"/>
    </svg>`;
  }
}
