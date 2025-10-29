import React, { useState, useEffect } from 'react';
import { AutoRefreshSettings as AutoRefreshSettingsType } from '../../types.js';
import { showToast } from '../ToastContainer.js';

const AutoRefreshSettings: React.FC = () => {
  const [settings, setSettings] = useState<AutoRefreshSettingsType>({
    enabled: true,
    timing: 13,
    silent: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await window.electronAPI.getAutoRefreshSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load auto refresh settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.setAutoRefreshSettings(settings);
      showToast('자동 갱신 설정이 저장되었습니다', 'success');
    } catch (error) {
      showToast('설정 저장 실패', 'error');
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">자동 갱신 설정</h2>

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>자동 갱신 활성화</div>
            <small style={{ color: '#666', fontSize: '12px' }}>
              활성 세션이 만료되기 전에 자동으로 갱신합니다
            </small>
          </div>
        </label>
      </div>

      <div className="form-group">
        <label>갱신 타이밍 (만료 전 몇 분)</label>
        <select value={settings.timing} onChange={(e) => setSettings({ ...settings, timing: parseInt(e.target.value) })}>
          <option value="5">5분 전</option>
          <option value="10">10분 전</option>
          <option value="13">13분 전</option>
          <option value="15">15분 전</option>
          <option value="20">20분 전</option>
          <option value="30">30분 전</option>
        </select>
        <small style={{ color: '#666', fontSize: '12px' }}>• 세션 만료 전 자동 갱신 시도 시점</small>
      </div>

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.silent}
            onChange={(e) => setSettings({ ...settings, silent: e.target.checked })}
            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>조용한 모드 (Silent)</div>
            <small style={{ color: '#666', fontSize: '12px' }}>
              자동 갱신 시 브라우저 창을 숨기고 알림을 최소화합니다
            </small>
          </div>
        </label>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
        <button className="btn-primary" onClick={handleSave}>
          설정 저장
        </button>
      </div>
    </div>
  );
};

export default AutoRefreshSettings;
