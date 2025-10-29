import { vi } from 'vitest';

// Electron Main Process Mock
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/tmp/test-user-data',
        appData: '/tmp/test-app-data',
        temp: '/tmp',
      };
      return paths[name] || '/tmp';
    }),
    getName: vi.fn(() => 'key-ti'),
    getVersion: vi.fn(() => '0.0.20'),
    on: vi.fn(),
    quit: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
  },
  BrowserWindow: vi.fn(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
    },
    show: vi.fn(),
    close: vi.fn(),
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  Tray: vi.fn(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
  })),
  Menu: {
    buildFromTemplate: vi.fn(),
  },
  nativeImage: {
    createFromPath: vi.fn(),
  },
}));
