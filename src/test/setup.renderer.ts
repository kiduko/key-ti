import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// React Testing Library cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Electron API for Renderer Process
global.window = global.window || {};

// Mock electronAPI (used by hooks)
(global.window as any).electronAPI = {
  getOTPAccounts: vi.fn(() => Promise.resolve([])),
  generateOTPCode: vi.fn(() => Promise.resolve({ success: true, token: '123456', timeRemaining: 30 })),
  showOTPWindow: vi.fn(() => Promise.resolve()),
  deleteOTPAccount: vi.fn(() => Promise.resolve()),
  getProfiles: vi.fn(() => Promise.resolve([])),
  getSessions: vi.fn(() => Promise.resolve([])),
  getConfig: vi.fn(() => Promise.resolve({})),
};

// Mock electron.ipcRenderer for compatibility
(global.window as any).electron = {
  ipcRenderer: {
    invoke: vi.fn((channel: string, ...args: any[]) => {
      // Default mock responses for common IPC calls
      const mockResponses: Record<string, any> = {
        'get-profiles': [],
        'get-otp-accounts': [],
        'get-sessions': [],
        'get-config': {},
      };
      return Promise.resolve(mockResponses[channel] || null);
    }),
    on: vi.fn((channel: string, callback: Function) => {
      // Store callback for potential later invocation
      return () => {}; // Return unsubscribe function
    }),
    send: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

global.localStorage = localStorageMock as any;

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

global.console = {
  ...console,
  error: vi.fn((...args) => {
    // Suppress specific error messages
    const message = args[0];
    if (typeof message === 'string' && message.includes('Failed to load OTP accounts')) {
      return;
    }
    originalError(...args);
  }),
  warn: vi.fn((...args) => {
    originalWarn(...args);
  }),
};
