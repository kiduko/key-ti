import React, { useState, useEffect } from 'react';
import { showToast } from '../ToastContainer.js';

const DisplaySettings: React.FC = () => {
  const [showClaudeUsageInTitle, setShowClaudeUsageInTitle] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const enabled = await window.electronAPI.getShowClaudeUsageInTitle();
      setShowClaudeUsageInTitle(enabled);

      // 설정이 켜져있으면 즉시 타이틀 업데이트
      if (enabled) {
        await window.electronAPI.setShowClaudeUsageInTitle(true);
      }
    } catch (error) {
      console.error('Failed to load display settings:', error);
    }
  };

  const handleToggleClaudeUsage = async (checked: boolean) => {
    try {
      setShowClaudeUsageInTitle(checked);
      await window.electronAPI.setShowClaudeUsageInTitle(checked);
      showToast('디스플레이 설정이 저장되었습니다', 'success');
    } catch (error) {
      showToast('설정 저장 실패', 'error');
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">디스플레이 설정</h2>

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showClaudeUsageInTitle}
            onChange={(e) => handleToggleClaudeUsage(e.target.checked)}
            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>타이틀에 Claude 사용량 표시</div>
            <small style={{ color: '#666', fontSize: '12px' }}>
              앱 타이틀에 현재 세션의 Claude Code 사용 비용을 표시합니다 (1분마다 갱신)
            </small>
          </div>
        </label>
      </div>
    </div>
  );
};

export default DisplaySettings;
