import type { WindowSpec } from '../window-manager';

export interface App extends WindowSpec {
  label: string;
}

export const apps: Record<string, App> = {};

export function registerApp(app: App) {
  apps[app.id] = app;
}

export function listApps(): App[] {
  return Object.values(apps);
}

export function getApp(id: string): App | undefined {
  return apps[id];
}
