import React, { useState, useEffect } from 'react';
import { OTPAccount } from '../../types';
import { showToast } from '../ToastContainer';

interface OTPModalProps {
  account: OTPAccount | null;
  onClose: () => void;
  onSave: () => void;
}

const OTPModal: React.FC<OTPModalProps> = ({ account, onClose, onSave }) => {
  const [formData, setFormData] = useState<OTPAccount>({
    id: Date.now().toString(),
    name: '',
    issuer: '',
    secret: '',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  useEffect(() => {
    if (account) {
      setFormData(account);
    }
  }, [account]);

  const parseOTPAuthURI = (uri: string): Partial<OTPAccount> | null => {
    try {
      if (!uri.startsWith('otpauth://totp/')) return null;

      const url = new URL(uri);
      const secret = url.searchParams.get('secret');
      if (!secret) return null;

      const pathParts = decodeURIComponent(url.pathname.substring(1)).split(':');
      let name = pathParts[pathParts.length - 1];
      let issuer = url.searchParams.get('issuer') || (pathParts.length > 1 ? pathParts[0] : '');

      return {
        name,
        issuer: issuer || undefined,
        secret: secret.toUpperCase(),
        algorithm: (url.searchParams.get('algorithm')?.toUpperCase() || 'SHA1') as 'SHA1' | 'SHA256' | 'SHA512',
        digits: parseInt(url.searchParams.get('digits') || '6'),
        period: parseInt(url.searchParams.get('period') || '30')
      };
    } catch (error) {
      return null;
    }
  };

  const handleSecretChange = (value: string) => {
    if (value.startsWith('otpauth://totp/')) {
      const parsed = parseOTPAuthURI(value);
      if (parsed) {
        setFormData(prev => ({
          ...prev,
          ...parsed,
          id: prev.id,
        }));
        showToast('OTP URI가 파싱되었습니다', 'success');
        return;
      }
    }

    setFormData({ ...formData, secret: value.replace(/\s/g, '').toUpperCase() });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (account) {
        await window.electronAPI.updateOTPAccount(account.id, formData);
        showToast('OTP 계정이 수정되었습니다', 'success');
      } else {
        await window.electronAPI.addOTPAccount(formData);
        showToast('OTP 계정이 추가되었습니다', 'success');
      }
      onSave();
    } catch (error) {
      showToast('저장 실패', 'error');
    }
  };

  return (
    <div className="modal active">
      <div className="modal-content">
        <div className="modal-header">{account ? 'OTP 계정 수정' : 'OTP 계정 추가'}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>계정 이름</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="예: Google, GitHub, AWS"
            />
          </div>

          <div className="form-group">
            <label>발급자 (선택)</label>
            <input
              type="text"
              value={formData.issuer || ''}
              onChange={(e) => setFormData({ ...formData, issuer: e.target.value || undefined })}
              placeholder="예: Google"
            />
          </div>

          <div className="form-group">
            <label>Secret Key 또는 OTP URI</label>
            <input
              type="text"
              value={formData.secret}
              onChange={(e) => handleSecretChange(e.target.value)}
              required
              placeholder="OF2V INST NBFH O3T2... 또는 otpauth://totp/..."
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              • Secret key (공백 포함 가능, 자동으로 제거됨)<br />
              • otpauth:// URI 붙여넣기 시 모든 필드 자동 입력
            </small>
          </div>

          <div className="form-group">
            <label>알고리즘</label>
            <select
              value={formData.algorithm}
              onChange={(e) => setFormData({ ...formData, algorithm: e.target.value as any })}
            >
              <option value="SHA1">SHA1 (기본)</option>
              <option value="SHA256">SHA256</option>
              <option value="SHA512">SHA512</option>
            </select>
          </div>

          <div className="form-group">
            <label>자릿수</label>
            <select
              value={formData.digits}
              onChange={(e) => setFormData({ ...formData, digits: parseInt(e.target.value) })}
            >
              <option value="6">6자리 (기본)</option>
              <option value="8">8자리</option>
            </select>
          </div>

          <div className="form-group">
            <label>갱신 주기 (초)</label>
            <select
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: parseInt(e.target.value) })}
            >
              <option value="30">30초 (기본)</option>
              <option value="60">60초</option>
            </select>
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

export default OTPModal;
