import React from 'react';

interface HeaderProps {
  appVersion: string;
}

const Header: React.FC<HeaderProps> = ({ appVersion }) => {
  return (
    <header>
      <img src="../key-logo.png" alt="Logo" className="logo" />
      <div className="header-text">
        <h1>
          Key-ti{' '}
          <span style={{ fontSize: '12px', opacity: 0.7 }}>
            {appVersion}
          </span>
        </h1>
        <p className="subtitle">SAML 기반 AWS 세션 자동 갱신</p>
      </div>
    </header>
  );
};

export default Header;
