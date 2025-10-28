import React, { useState, useEffect } from 'react';
import { AWSProfile, OTPAccount } from '../../types';
import { showToast } from '../ToastContainer';
import ProfileModal from '../modals/ProfileModal';

const SessionsTab: React.FC = () => {
  const [profiles, setProfiles] = useState<AWSProfile[]>([]);
  const [otpAccounts, setOTPAccounts] = useState<OTPAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AWSProfile | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: { seconds: number; text: string; className: string } }>({});

  const loadProfiles = async () => {
    try {
      const data = await window.electronAPI.getProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const loadOTPAccounts = async () => {
    try {
      const data = await window.electronAPI.getOTPAccounts();
      setOTPAccounts(data);
    } catch (error) {
      console.error('Failed to load OTP accounts:', error);
    }
  };

  const calculateTimeRemaining = (expirationStr: string) => {
    const expiration = new Date(expirationStr);
    const now = new Date();
    const seconds = Math.floor((expiration.getTime() - now.getTime()) / 1000);

    if (seconds <= 0) {
      return { seconds: 0, text: '만료됨', className: 'time-expired' };
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let className = 'time-normal';
    if (seconds < 300) className = 'time-critical';
    else if (seconds < 3600) className = 'time-warning';

    return {
      seconds,
      text: `${hours}시간 ${minutes}분 ${secs}초`,
      className,
    };
  };

  useEffect(() => {
    loadProfiles();
    loadOTPAccounts();
    window.electronAPI.validateSessions();
  }, []);

  useEffect(() => {
    // Update time remaining every second
    const interval = setInterval(() => {
      const updated: any = {};
      profiles.forEach((profile) => {
        if (profile.expiration) {
          updated[profile.alias] = calculateTimeRemaining(profile.expiration);
        }
      });
      setTimeRemaining(updated);
    }, 1000);

    return () => clearInterval(interval);
  }, [profiles]);

  const handleActivateProfile = async (alias: string) => {
    const profile = profiles.find(p => p.alias === alias);
    let hasOTPWindow = false;

    // Show OTP window if profile has OTP account configured
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
  };

  const handleDeactivateProfile = async (alias: string) => {
    const result = await window.electronAPI.deactivateProfile(alias);
    if (result.success) {
      showToast(result.message, 'success');
      await loadProfiles();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleEditProfile = (profile: AWSProfile) => {
    setEditingProfile(profile);
    setIsModalOpen(true);
  };

  const handleDeleteProfile = async (alias: string) => {
    if (!confirm(`"${alias}" 프로필을 삭제하시겠습니까?`)) return;

    try {
      await window.electronAPI.deleteProfile(alias);
      showToast('프로필이 삭제되었습니다', 'success');
      await loadProfiles();
    } catch (error) {
      showToast('프로필 삭제 실패', 'error');
    }
  };

  const handleOpenConsole = async (alias: string) => {
    const result = await window.electronAPI.openConsole(alias);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="section-title">프로필 목록</h2>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          + 프로필 추가
        </button>
      </div>

      <div className="profiles-list">
        {profiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>등록된 프로필이 없습니다</p>
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.alias}
              className={`profile-item ${profile.isActive ? 'active' : ''}`}
            >
              <div className="profile-info">
                <div className="profile-alias">{profile.alias}</div>
                <div className="profile-details">
                  {profile.profileName} | {profile.roleArn}
                  {profile.expiration && timeRemaining[profile.alias] && (
                    <>
                      {' '}| <span className={timeRemaining[profile.alias].className}>
                        {timeRemaining[profile.alias].text}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="profile-actions">
                {profile.isActive ? (
                  <>
                    <button
                      className="btn-success"
                      onClick={() => handleActivateProfile(profile.alias)}
                    >
                      갱신
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDeactivateProfile(profile.alias)}
                    >
                      로그아웃
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleOpenConsole(profile.alias)}
                    >
                      콘솔
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => handleActivateProfile(profile.alias)}
                  >
                    로그인
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => handleEditProfile(profile)}
                >
                  수정
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteProfile(profile.alias)}
                >
                  ✗
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <ProfileModal
          profile={editingProfile}
          otpAccounts={otpAccounts}
          onClose={() => {
            setIsModalOpen(false);
            setEditingProfile(null);
          }}
          onSave={async () => {
            await loadProfiles();
            setIsModalOpen(false);
            setEditingProfile(null);
          }}
        />
      )}
    </div>
  );
};

export default SessionsTab;
