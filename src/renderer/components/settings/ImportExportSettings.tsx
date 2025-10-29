import React, { useState } from 'react';
import { showToast } from '../ToastContainer.js';

const ImportExportSettings: React.FC = () => {
  const [importText, setImportText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');

  const handleExport = async () => {
    try {
      const text = await window.electronAPI.exportToText();
      await navigator.clipboard.writeText(text);

      setStatusMessage('프로필 데이터가 클립보드에 복사되었습니다');
      setStatusType('success');
      setTimeout(() => {
        setStatusMessage('');
        setStatusType('');
      }, 3000);
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Export 실패', 'error');
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      setStatusMessage('데이터를 입력하세요');
      setStatusType('error');
      setTimeout(() => {
        setStatusMessage('');
        setStatusType('');
      }, 3000);
      return;
    }

    try {
      const result = await window.electronAPI.importFromText(importText);

      if (result.success) {
        setStatusMessage(result.message);
        setStatusType('success');
        setImportText('');

        setTimeout(() => {
          setStatusMessage('');
          setStatusType('');
        }, 5000);
      } else {
        setStatusMessage(result.message);
        setStatusType('error');
        setTimeout(() => {
          setStatusMessage('');
          setStatusType('');
        }, 5000);
      }
    } catch (error) {
      console.error('Import failed:', error);
      setStatusMessage('Import 실패');
      setStatusType('error');
      setTimeout(() => {
        setStatusMessage('');
        setStatusType('');
      }, 3000);
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">프로필 Import/Export</h2>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '24px' }}>
        프로필 데이터를 텍스트(JSON)로 내보내거나 가져올 수 있습니다. (OTP 정보는 제외됩니다)
      </p>

      {/* Import 섹션 */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Import</h3>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
          Export한 JSON 데이터를 아래 입력란에 붙여넣고 가져오기 버튼을 클릭하세요.
        </p>

        <div className="form-group">
          <textarea
            rows={12}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d0d0d0',
              borderRadius: '6px',
              fontFamily: "'Monaco', 'Menlo', monospace",
              fontSize: '12px',
              resize: 'vertical',
            }}
            placeholder={`[
  {
    "alias": "example",
    "profileName": "example-profile",
    "roleArn": "arn:aws:iam::123456789012:role/YourRole",
    "samlUrl": "https://your-idp.com/saml",
    "idp": "arn:aws:iam::123456789012:saml-provider/YourIDP"
  }
]`}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" onClick={handleImport}>
            가져오기
          </button>
          <button className="btn-secondary" onClick={() => setImportText('')}>
            지우기
          </button>
        </div>
      </div>

      {/* Export 섹션 */}
      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Export</h3>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
          현재 저장된 프로필 데이터를 클립보드에 복사합니다.
        </p>
        <button className="btn-primary" onClick={handleExport}>
          클립보드에 복사
        </button>

        {statusMessage && (
          <div className={`status ${statusType}`} style={{ marginTop: '16px' }}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportExportSettings;
