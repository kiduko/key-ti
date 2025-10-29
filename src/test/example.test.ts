import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify true is truthy', () => {
    expect(true).toBeTruthy();
  });

  it('should handle string operations', () => {
    const text = 'Hello, Vitest!';
    expect(text).toContain('Vitest');
    expect(text.length).toBeGreaterThan(0);
  });
});
