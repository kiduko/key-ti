import { describe, it, expect } from 'vitest';
import { calculateTimeRemaining, getOTPTimerClass } from '../time.js';

describe('Time Utilities', () => {
  describe('calculateTimeRemaining', () => {
    it('should calculate remaining time correctly for 2 hours', () => {
      const futureTime = new Date(Date.now() + 7200000); // 2 hours from now
      const result = calculateTimeRemaining(futureTime.toISOString());

      expect(result.seconds).toBeGreaterThan(7000);
      expect(result.text).toContain('시간');
      expect(result.className).toBe('time-normal');
    });

    it('should handle expired time', () => {
      const pastTime = new Date(Date.now() - 1000);
      const result = calculateTimeRemaining(pastTime.toISOString());

      expect(result.seconds).toBe(0);
      expect(result.text).toBe('만료됨');
      expect(result.className).toBe('time-expired');
    });

    it('should show warning for time < 1 hour', () => {
      const futureTime = new Date(Date.now() + 1800000); // 30 minutes
      const result = calculateTimeRemaining(futureTime.toISOString());

      expect(result.className).toBe('time-warning');
      expect(result.text).toContain('분');
    });

    it('should show critical for time < 5 minutes', () => {
      const futureTime = new Date(Date.now() + 120000); // 2 minutes
      const result = calculateTimeRemaining(futureTime.toISOString());

      expect(result.className).toBe('time-critical');
    });
  });

  describe('getOTPTimerClass', () => {
    it('should return critical class for time < 5 seconds', () => {
      expect(getOTPTimerClass(3)).toBe('critical');
      expect(getOTPTimerClass(4)).toBe('critical');
    });

    it('should return warning class for time < 10 seconds', () => {
      expect(getOTPTimerClass(5)).toBe('warning');
      expect(getOTPTimerClass(9)).toBe('warning');
    });

    it('should return empty string for normal time', () => {
      expect(getOTPTimerClass(10)).toBe('');
      expect(getOTPTimerClass(20)).toBe('');
    });
  });
});
