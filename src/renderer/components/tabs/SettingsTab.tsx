import React, { useState } from 'react';
import AutoRefreshSettings from '../settings/AutoRefreshSettings.js';
import BackupSettings from '../settings/BackupSettings.js';
import ImportExportSettings from '../settings/ImportExportSettings.js';

type SettingsSubTab = 'autoRefresh' | 'backup' | 'importExport';

const SettingsTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('autoRefresh');

  return (
    <div style={{ display: 'flex', height: '100%', padding: 0 }}>
      <div style={{ width: '140px', borderRight: '1px solid #e0e0e0', padding: '12px 0', background: '#f9f9f9' }}>
        <button
          className={`settings-subtab ${activeSubTab === 'autoRefresh' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('autoRefresh')}
        >
          자동 갱신
        </button>
        <button
          className={`settings-subtab ${activeSubTab === 'backup' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('backup')}
        >
          백업
        </button>
        <button
          className={`settings-subtab ${activeSubTab === 'importExport' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('importExport')}
        >
          Import/Export
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {activeSubTab === 'autoRefresh' && <AutoRefreshSettings />}
        {activeSubTab === 'backup' && <BackupSettings />}
        {activeSubTab === 'importExport' && <ImportExportSettings />}
      </div>
    </div>
  );
};

export default SettingsTab;
