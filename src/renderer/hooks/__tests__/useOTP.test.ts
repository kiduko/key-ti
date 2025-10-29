import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOTP } from '../useOTP.js';

describe('useOTP Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize and load OTP accounts', async () => {
    const { result } = renderHook(() => useOTP());

    // Initially loading
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have empty accounts after loading
    expect(result.current.otpAccounts).toEqual([]);
  });

  it('should handle empty OTP accounts list', async () => {
    const { result } = renderHook(() => useOTP());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(Array.isArray(result.current.otpAccounts)).toBe(true);
    expect(result.current.otpAccounts.length).toBe(0);
  });

  it('should provide all required methods', () => {
    const { result } = renderHook(() => useOTP());

    expect(result.current.loadOTPAccounts).toBeDefined();
    expect(result.current.generateOTP).toBeDefined();
    expect(result.current.copyOTP).toBeDefined();
    expect(result.current.showOTPWindow).toBeDefined();
    expect(result.current.deleteOTP).toBeDefined();
  });
});
