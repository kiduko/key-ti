import React, { useState, useEffect } from 'react';
import Header from './Header.js';
import Tabs from './Tabs.js';
import SessionsTab from './tabs/SessionsTab.js';
import OTPTab from './tabs/OTPTab.js';
import MemoTab from './tabs/MemoTab.js';
import LinksTab from './tabs/LinksTab.js';
import SettingsTab from './tabs/SettingsTab.js';
import ToastContainer from './ToastContainer.js';

type TabType = 'sessions' | 'otp' | 'memo' | 'links' | 'settings';

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    // 앱 버전 가져오기
    window.electronAPI.getAppVersion().then(setAppVersion);

    // 세션 검증
    window.electronAPI.validateSessions();
  }, []);

  return (
    <div className="container">
      <Header appVersion={appVersion} />
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="tab-content active">
        {activeTab === 'sessions' && <SessionsTab />}
        {activeTab === 'otp' && <OTPTab />}
        {activeTab === 'memo' && <MemoTab />}
        {activeTab === 'links' && <LinksTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>

      <ToastContainer />
    </div>
  );
};

export default MainApp;
