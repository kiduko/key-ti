import React, { useState, useEffect } from 'react';
import { BackupSettings as BackupSettingsType } from '../../types.js';
import { showToast } from '../ToastContainer.js';

const BackupSettings: React.FC = () => {
  const [settings, setSettings] = useState<BackupSettingsType>({
    type: 'none',
    localPath: '',
    autoBackup: false,
  });
  const [backupPath, setBackupPath] = useState('');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const path = await window.electronAPI.getBackupPath();
      setBackupPath(path);

      const saved = localStorage.getItem('backupSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...parsed, localPath: path });
      } else {
        setSettings({ type: 'none', localPath: path, autoBackup: false });
      }
    } catch (error) {
      console.error('Failed to load backup settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      localStorage.setItem('backupSettings', JSON.stringify(settings));

      if (settings.type === 'local') {
        await window.electronAPI.saveBackup({
          _settingsOnly: true,
          settings: settings,
        });
      }

      showToast('백업 설정이 저장되었습니다', 'success');
    } catch (error) {
      showToast('설정 저장 실패', 'error');
    }
  };

  const handleBackupNow = async () => {
    if (settings.type === 'none') {
      showToast('백업 위치를 먼저 선택하고 설정을 저장하세요', 'error');
      return;
    }

    try {
      const profiles = await window.electronAPI.getProfiles();
      const otpAccounts = await window.electronAPI.getOTPAccounts();
      const memosData = localStorage.getItem('memos');
      const linksData = localStorage.getItem('links');
      const settingsData = localStorage.getItem('backupSettings');

      const backupData = {
        profiles: profiles,
        otpAccounts: otpAccounts,
        memos: memosData ? JSON.parse(memosData) : [],
        links: linksData ? JSON.parse(linksData) : [],
        backupSettings: settingsData ? JSON.parse(settingsData) : null,
        timestamp: new Date().toISOString(),
      };

      const result = await window.electronAPI.saveBackup(backupData);

      if (result.success) {
        showToast(`백업 완료: ${result.filename}`, 'success');
      } else {
        showToast('백업 실패: ' + result.message, 'error');
      }
    } catch (error) {
      showToast('백업 실패', 'error');
    }
  };

  const handleRestoreBackup = async () => {
    try {
      const result = await window.electronAPI.listBackups();
      if (result.success) {
        setBackups(result.backups);
        setIsRestoreModalOpen(true);
      } else {
        showToast('백업 목록 불러오기 실패', 'error');
      }
    } catch (error) {
      showToast('백업 목록 불러오기 실패', 'error');
    }
  };

  const handleSelectBackup = async (filename: string) => {
    if (!confirm('선택한 백업으로 복원하시겠습니까? 현재 데이터는 덮어씌워집니다.')) {
      return;
    }

    try {
      const result = await window.electronAPI.loadBackup(filename);
      if (result.success && result.data) {
        const data = result.data;

        if (data.memos) localStorage.setItem('memos', JSON.stringify(data.memos));
        if (data.links) localStorage.setItem('links', JSON.stringify(data.links));
        if (data.backupSettings) localStorage.setItem('backupSettings', JSON.stringify(data.backupSettings));

        showToast('백업이 복원되었습니다. 페이지를 새로고침하세요.', 'success');
        setIsRestoreModalOpen(false);

        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast('백업 복원 실패: ' + result.message, 'error');
      }
    } catch (error) {
      showToast('백업 복원 실패', 'error');
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">백업 설정</h2>

      <div className="form-group">
        <label>백업 위치</label>
        <select value={settings.type} onChange={(e) => setSettings({ ...settings, type: e.target.value as any })}>
          <option value="none">백업 안 함</option>
          <option value="local">로컬 폴더 (~/.key-ti)</option>
        </select>
      </div>

      {settings.type === 'local' && (
        <div style={{ marginBottom: '20px' }}>
          <div className="form-group">
            <label>백업 폴더 경로</label>
            <input
              type="text"
              value={settings.localPath}
              readOnly
              style={{ background: '#f5f5f5', color: '#666' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              • 프로필, 메모, 링크 데이터가 저장됩니다
            </small>
          </div>
        </div>
      )}

      <div className="form-group" style={{ marginTop: '20px' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>종료 시 자동으로 백업</div>
            <small style={{ color: '#666', fontSize: '12px' }}>
              백업 위치가 '로컬 폴더'로 설정되어 있어야 동작합니다
            </small>
          </div>
          <input
            type="checkbox"
            checked={settings.autoBackup}
            onChange={(e) => setSettings({ ...settings, autoBackup: e.target.checked })}
            style={{ cursor: 'pointer', width: '18px', height: '18px', flexShrink: 0 }}
          />
        </label>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
        <button className="btn-primary" onClick={handleSaveSettings}>
          설정 저장
        </button>
        <button className="btn-success" onClick={handleBackupNow}>
          지금 백업
        </button>
        <button className="btn-secondary" onClick={handleRestoreBackup}>
          백업 복원
        </button>
      </div>

      {/* 백업 복원 모달 */}
      {isRestoreModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <div className="modal-header">백업 복원</div>

            <div style={{ margin: '20px 0' }}>
              {backups.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#999' }}>백업 파일이 없습니다</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {backups.map((backup, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => handleSelectBackup(backup.filename)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f5f5';
                        e.currentTarget.style.borderColor = '#2c3e50';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = '#e0e0e0';
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{backup.filename}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {new Date(backup.timestamp).toLocaleString('ko-KR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsRestoreModalOpen(false)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupSettings;
