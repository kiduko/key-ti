import React, { useState, useEffect } from 'react';
import { AWSProfile, OTPAccount } from '../../types';
import { showToast } from '../ToastContainer';

interface ProfileModalProps {
  profile: AWSProfile | null;
  otpAccounts: OTPAccount[];
  onClose: () => void;
  onSave: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ profile, otpAccounts, onClose, onSave }) => {
  const [formData, setFormData] = useState<AWSProfile>({
    alias: '',
    profileName: '',
    roleArn: '',
    samlUrl: '',
    idp: '',
    otpAccountId: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (profile) {
        await window.electronAPI.updateProfile(profile.alias, formData);
        showToast('프로필이 수정되었습니다', 'success');
      } else {
        await window.electronAPI.addProfile(formData);
        showToast('프로필이 추가되었습니다', 'success');
      }
      onSave();
    } catch (error) {
      showToast('저장 실패', 'error');
    }
  };

  return (
    <div className="modal active">
      <div className="modal-content">
        <div className="modal-header">{profile ? '프로필 수정' : '프로필 추가'}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Alias</label>
            <input
              type="text"
              value={formData.alias}
              onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
              required
              placeholder="예: production"
              disabled={!!profile}
            />
          </div>

          <div className="form-group">
            <label>Profile Name</label>
            <input
              type="text"
              value={formData.profileName}
              onChange={(e) => setFormData({ ...formData, profileName: e.target.value })}
              required
              placeholder="예: prod-account"
            />
          </div>

          <div className="form-group">
            <label>Role ARN</label>
            <input
              type="text"
              value={formData.roleArn}
              onChange={(e) => setFormData({ ...formData, roleArn: e.target.value })}
              required
              placeholder="arn:aws:iam::123456789012:role/YourRole"
            />
          </div>

          <div className="form-group">
            <label>SAML URL</label>
            <input
              type="text"
              value={formData.samlUrl}
              onChange={(e) => setFormData({ ...formData, samlUrl: e.target.value })}
              required
              placeholder="https://your-idp.com/saml"
            />
          </div>

          <div className="form-group">
            <label>IDP (Principal ARN)</label>
            <input
              type="text"
              value={formData.idp}
              onChange={(e) => setFormData({ ...formData, idp: e.target.value })}
              required
              placeholder="arn:aws:iam::123456789012:saml-provider/YourIDP"
            />
          </div>

          <div className="form-group">
            <label>연결할 OTP 계정 (선택)</label>
            <select
              value={formData.otpAccountId || ''}
              onChange={(e) => setFormData({ ...formData, otpAccountId: e.target.value || undefined })}
            >
              <option value="">연결 안 함</option>
              {otpAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} {account.issuer && `(${account.issuer})`}
                </option>
              ))}
            </select>
            <small style={{ color: '#666', fontSize: '12px' }}>로그인 시 OTP 코드 자동 표시</small>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
