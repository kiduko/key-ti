import { useState, useEffect, useCallback } from 'react';
import { AWSProfile, OTPAccount } from '../types.js';
import { showToast } from '../components/ToastContainer.js';
import { calculateTimeRemaining, TimeRemaining } from '../utils/time.js';

interface UseProfileReturn {
  profiles: AWSProfile[];
  otpAccounts: OTPAccount[];
  timeRemaining: { [key: string]: TimeRemaining };
  isLoading: boolean;
  loadProfiles: () => Promise<void>;
  loadOTPAccounts: () => Promise<void>;
  activateProfile: (alias: string) => Promise<void>;
  deactivateProfile: (alias: string) => Promise<void>;
  deleteProfile: (alias: string) => Promise<void>;
  openConsole: (alias: string) => Promise<void>;
}

export const useProfile = (): UseProfileReturn => {
  const [profiles, setProfiles] = useState<AWSProfile[]>([]);
  const [otpAccounts, setOTPAccounts] = useState<OTPAccount[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: TimeRemaining }>({});
  const [isLoading, setIsLoading] = useState(false);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await window.electronAPI.getProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      showToast('프로필 로드 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOTPAccounts = useCallback(async () => {
    try {
      const data = await window.electronAPI.getOTPAccounts();
      setOTPAccounts(data);
    } catch (error) {
      console.error('Failed to load OTP accounts:', error);
    }
  }, []);

  const activateProfile = useCallback(async (alias: string) => {
    const profile = profiles.find(p => p.alias === alias);
    let hasOTPWindow = false;

    if (profile && profile.otpAccountId) {
      const otpAccount = otpAccounts.find(a => a.id === profile.otpAccountId);
      if (otpAccount) {
        await window.electronAPI.showOTPWindow(otpAccount);
        hasOTPWindow = true;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    showToast('세션 활성화 중...', 'info');

    try {
      const result = await window.electronAPI.activateProfile(alias);

      if (hasOTPWindow) {
        await window.electronAPI.closeOTPWindow();
      }

      if (result.success) {
        showToast(result.message, 'success');
        await loadProfiles();
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      if (hasOTPWindow) {
        await window.electronAPI.closeOTPWindow();
      }
      showToast('로그인 실패', 'error');
    }
  }, [profiles, otpAccounts, loadProfiles]);

  const deactivateProfile = useCallback(async (alias: string) => {
    const result = await window.electronAPI.deactivateProfile(alias);
    if (result.success) {
      showToast(result.message, 'success');
      await loadProfiles();
    } else {
      showToast(result.message, 'error');
    }
  }, [loadProfiles]);

  const deleteProfile = useCallback(async (alias: string) => {
    if (!confirm(`"${alias}" 프로필을 삭제하시겠습니까?`)) return;

    try {
      await window.electronAPI.deleteProfile(alias);
      showToast('프로필이 삭제되었습니다', 'success');
      await loadProfiles();
    } catch (error) {
      showToast('프로필 삭제 실패', 'error');
    }
  }, [loadProfiles]);

  const openConsole = useCallback(async (alias: string) => {
    const result = await window.electronAPI.openConsole(alias);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    loadOTPAccounts();
    window.electronAPI.validateSessions();
  }, [loadProfiles, loadOTPAccounts]);

  useEffect(() => {
    const interval = setInterval(() => {
      const updated: { [key: string]: TimeRemaining } = {};
      profiles.forEach((profile) => {
        if (profile.expiration) {
          updated[profile.alias] = calculateTimeRemaining(profile.expiration);
        }
      });
      setTimeRemaining(updated);
    }, 1000);

    return () => clearInterval(interval);
  }, [profiles]);

  return {
    profiles,
    otpAccounts,
    timeRemaining,
    isLoading,
    loadProfiles,
    loadOTPAccounts,
    activateProfile,
    deactivateProfile,
    deleteProfile,
    openConsole,
  };
};
