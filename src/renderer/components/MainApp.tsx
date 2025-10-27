import React, { useState, useEffect } from 'react';
import Header from './Header';
import Tabs from './Tabs';
import SessionsTab from './tabs/SessionsTab';
import OTPTab from './tabs/OTPTab';
import MemoTab from './tabs/MemoTab';
import LinksTab from './tabs/LinksTab';
import SettingsTab from './tabs/SettingsTab';
import ToastContainer from './ToastContainer';

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
