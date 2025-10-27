import React, { useState, useEffect } from 'react';
import { OTPAccount } from '../../types';
import { showToast } from '../ToastContainer';
import OTPModal from '../modals/OTPModal';

const OTPTab: React.FC = () => {
  const [otpAccounts, setOTPAccounts] = useState<OTPAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<OTPAccount | null>(null);
  const [otpCodes, setOTPCodes] = useState<{ [key: string]: { token: string; timeRemaining: number } }>({});

  const loadOTPAccounts = async () => {
    try {
      const data = await window.electronAPI.getOTPAccounts();
      setOTPAccounts(data);
    } catch (error) {
      console.error('Failed to load OTP accounts:', error);
    }
  };

  useEffect(() => {
    loadOTPAccounts();
  }, []);

  const handleAddOTP = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const handleEditOTP = (account: OTPAccount) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleDeleteOTP = async (id: string) => {
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
  };

  const handleGenerateOTP = async (account: OTPAccount) => {
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
  };

  const handleCopyOTP = (token: string) => {
    navigator.clipboard.writeText(token).then(() => {
      showToast('OTP 코드가 복사되었습니다', 'success');
    }).catch(() => {
      showToast('복사 실패', 'error');
    });
  };

  const handleShowOTPWindow = async (account: OTPAccount) => {
    try {
      await window.electronAPI.showOTPWindow(account);
    } catch (error) {
      showToast('OTP 창 열기 실패', 'error');
    }
  };

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="section-title">OTP 계정</h2>
        <button className="btn-primary" onClick={handleAddOTP}>
          + OTP 추가
        </button>
      </div>

      <div className="otp-accounts-list">
        {otpAccounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔐</div>
            <p>등록된 OTP 계정이 없습니다</p>
          </div>
        ) : (
          otpAccounts.map((account) => {
            const otpCode = otpCodes[account.id];
            const timeRemaining = otpCode?.timeRemaining || 0;
            const timerClass = timeRemaining < 5 ? 'critical' : timeRemaining < 10 ? 'warning' : '';

            return (
              <div key={account.id} className="otp-account-item" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 상단: 계정 정보 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="otp-account-info">
                    <div className="otp-account-name">{account.name}</div>
                    {account.issuer && (
                      <div className="otp-account-issuer">{account.issuer}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => handleEditOTP(account)}
                    >
                      수정
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteOTP(account.id)}
                    >
                      ✗
                    </button>
                  </div>
                </div>

                {/* 하단: OTP 코드 또는 생성 버튼 */}
                {otpCode ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f7fa', padding: '16px', borderRadius: '8px' }}>
                    <div
                      className="otp-code"
                      onClick={() => handleCopyOTP(otpCode.token)}
                      title="클릭하여 복사"
                      style={{ margin: 0, padding: '8px 16px', background: 'white', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      {otpCode.token}
                    </div>
                    <div className="otp-timer">
                      <div className={`otp-timer-circle ${timerClass}`}>
                        {timeRemaining}s
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => handleGenerateOTP(account)}
                    >
                      OTP 생성
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleShowOTPWindow(account)}
                    >
                      큰 창
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && (
        <OTPModal
          account={editingAccount}
          onClose={() => {
            setIsModalOpen(false);
            setEditingAccount(null);
          }}
          onSave={async () => {
            await loadOTPAccounts();
            setIsModalOpen(false);
            setEditingAccount(null);
          }}
        />
      )}
    </div>
  );
};

export default OTPTab;
