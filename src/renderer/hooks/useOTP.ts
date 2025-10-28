import { useState, useEffect, useCallback } from 'react';
import { OTPAccount } from '../types';
import { showToast } from '../components/ToastContainer';

interface OTPCode {
  token: string;
  timeRemaining: number;
}

interface UseOTPReturn {
  otpAccounts: OTPAccount[];
  otpCodes: { [key: string]: OTPCode };
  isLoading: boolean;
  loadOTPAccounts: () => Promise<void>;
  generateOTP: (account: OTPAccount) => Promise<void>;
  copyOTP: (token: string) => Promise<void>;
  showOTPWindow: (account: OTPAccount) => Promise<void>;
  deleteOTP: (id: string) => Promise<void>;
}

export const useOTP = (): UseOTPReturn => {
  const [otpAccounts, setOTPAccounts] = useState<OTPAccount[]>([]);
  const [otpCodes, setOTPCodes] = useState<{ [key: string]: OTPCode }>({});
  const [isLoading, setIsLoading] = useState(false);

  const loadOTPAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await window.electronAPI.getOTPAccounts();
      setOTPAccounts(data);
    } catch (error) {
      console.error('Failed to load OTP accounts:', error);
      showToast('OTP 계정 로드 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateOTP = useCallback(async (account: OTPAccount) => {
    try {
      const result = await window.electronAPI.generateOTPCode(account);
      if (result.success && result.token && result.timeRemaining !== undefined) {
        setOTPCodes(prev => ({
          ...prev,
          [account.id]: { token: result.token!, timeRemaining: result.timeRemaining! }
        }));

        const interval = setInterval(async () => {
          const newResult = await window.electronAPI.generateOTPCode(account);
          if (newResult.success && newResult.token && newResult.timeRemaining !== undefined) {
            setOTPCodes(prev => ({
              ...prev,
              [account.id]: { token: newResult.token!, timeRemaining: newResult.timeRemaining! }
            }));
          }
        }, 1000);

        setTimeout(() => clearInterval(interval), 30000);
      } else {
        showToast('OTP 생성 실패: ' + (result.error || '알 수 없는 오류'), 'error');
      }
    } catch (error) {
      showToast('OTP 생성 실패', 'error');
    }
  }, []);

  const copyOTP = useCallback(async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      showToast('OTP 코드가 복사되었습니다', 'success');
    } catch (error) {
      showToast('복사 실패', 'error');
    }
  }, []);

  const showOTPWindow = useCallback(async (account: OTPAccount) => {
    try {
      await window.electronAPI.showOTPWindow(account);
    } catch (error) {
      showToast('OTP 창 열기 실패', 'error');
    }
  }, []);

  const deleteOTP = useCallback(async (id: string) => {
    const account = otpAccounts.find(a => a.id === id);
    if (!account) return;

    if (!confirm(`"${account.name}" OTP 계정을 삭제하시겠습니까?`)) return;

    try {
      await window.electronAPI.deleteOTPAccount(id);
      showToast('OTP 계정이 삭제되었습니다', 'success');
      await loadOTPAccounts();
    } catch (error) {
      showToast('OTP 계정 삭제 실패', 'error');
    }
  }, [otpAccounts, loadOTPAccounts]);

  useEffect(() => {
    loadOTPAccounts();
  }, [loadOTPAccounts]);

  return {
    otpAccounts,
    otpCodes,
    isLoading,
    loadOTPAccounts,
    generateOTP,
    copyOTP,
    showOTPWindow,
    deleteOTP,
  };
};
