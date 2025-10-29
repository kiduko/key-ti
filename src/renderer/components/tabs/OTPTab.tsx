import React, { useState } from 'react';
import { OTPAccount } from '../../types.js';
import { useOTP } from '../../hooks/useOTP.js';
import { getOTPTimerClass } from '../../utils/time.js';
import PageHeader from '../common/PageHeader.js';
import EmptyState from '../common/EmptyState.js';
import OTPModal from '../modals/OTPModal.js';

const OTPTab: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<OTPAccount | null>(null);

  const {
    otpAccounts,
    otpCodes,
    loadOTPAccounts,
    generateOTP,
    copyOTP,
    showOTPWindow,
    deleteOTP,
  } = useOTP();

  const handleAddOTP = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const handleEditOTP = (account: OTPAccount) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const handleSaveModal = async () => {
    await loadOTPAccounts();
    handleCloseModal();
  };

  return (
    <div className="section">
      <PageHeader
        title="OTP 계정"
        action={{ label: '+ OTP 추가', onClick: handleAddOTP }}
      />

      <div className="otp-accounts-list">
        {otpAccounts.length === 0 ? (
          <EmptyState icon="🔐" message="등록된 OTP 계정이 없습니다" />
        ) : (
          otpAccounts.map((account) => {
            const otpCode = otpCodes[account.id];
            const timeRemaining = otpCode?.timeRemaining || 0;
            const timerClass = getOTPTimerClass(timeRemaining);

            return (
              <div key={account.id} className="otp-account-item">
                <div className="otp-account-header">
                  <div className="otp-account-info">
                    <div className="otp-account-name">{account.name}</div>
                    {account.issuer && (
                      <div className="otp-account-issuer">{account.issuer}</div>
                    )}
                  </div>
                  <div className="otp-account-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => handleEditOTP(account)}
                    >
                      수정
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => deleteOTP(account.id)}
                    >
                      ✗
                    </button>
                  </div>
                </div>

                {otpCode ? (
                  <div className="otp-code-container">
                    <div
                      className="otp-code"
                      onClick={() => copyOTP(otpCode.token)}
                      title="클릭하여 복사"
                    >
                      {otpCode.token}
                    </div>
                    <div className="otp-timer">
                      <div className={`otp-timer-circle ${timerClass}`}>
                        {timeRemaining}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="otp-buttons">
                    <button
                      className="otp-btn-generate"
                      onClick={() => generateOTP(account)}
                    >
                      OTP 생성
                    </button>
                    <button
                      className="otp-btn-window"
                      onClick={() => showOTPWindow(account)}
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
          onClose={handleCloseModal}
          onSave={handleSaveModal}
        />
      )}
    </div>
  );
};

export default OTPTab;
