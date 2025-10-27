import React from 'react';

type TabType = 'sessions' | 'otp' | 'memo' | 'links' | 'settings';

interface TabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'sessions' as TabType, label: '세션 관리' },
    { id: 'otp' as TabType, label: 'OTP' },
    { id: 'memo' as TabType, label: '메모장' },
    { id: 'links' as TabType, label: '링크' },
    { id: 'settings' as TabType, label: '설정' },
  ];

  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
