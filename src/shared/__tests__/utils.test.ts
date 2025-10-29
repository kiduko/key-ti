import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron module before importing utils
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/tmp/test-user-data',
        home: '/tmp/home',
      };
      return paths[name] || '/tmp';
    }),
  },
}));

// Import after mocking
const { calculateTimeRemaining, getBackupDir } = await import('../utils.js');

describe('Shared Utilities', () => {
  describe('calculateTimeRemaining', () => {
    it('should calculate remaining time correctly', () => {
      const futureTime = new Date(Date.now() + 7200000); // 2 hours from now
      const result = calculateTimeRemaining(futureTime.toISOString());

      expect(result.seconds).toBeGreaterThan(7000);
      expect(result.text).toContain('시간');
      expect(result.className).toBe('time-normal');
    });

    it('should return expired status for past time', () => {
      const pastTime = new Date(Date.now() - 1000);
      const result = calculateTimeRemaining(pastTime.toISOString());

      expect(result.seconds).toBe(0);
      expect(result.text).toBe('만료됨');
      expect(result.className).toBe('time-expired');
    });

    it('should show warning class for time < 1 hour', () => {
      const futureTime = new Date(Date.now() + 1800000); // 30 minutes
      const result = calculateTimeRemaining(futureTime.toISOString());

      expect(result.className).toBe('time-warning');
    });

    it('should show critical class for time < 5 minutes', () => {
      const futureTime = new Date(Date.now() + 120000); // 2 minutes
      const result = calculateTimeRemaining(futureTime.toISOString());

      expect(result.className).toBe('time-critical');
    });
  });

  describe('getBackupDir', () => {
    it('should return backup directory path', () => {
      const result = getBackupDir();

      expect(result).toBeTruthy();
      expect(result).toContain('.key-ti');
    });
  });
});
