import { app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ConfigManager } from './config';
import { SAMLAuthenticator } from './saml';
import { AWSSessionManager } from './aws';
import { AWSProfile, OTPAccount } from './types';
import { authenticator } from 'otplib';

let mainWindow: BrowserWindow | null = null;
let otpWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isUpdating = false; // 업데이트 설치 중 플래그
let configManager: ConfigManager;
let samlAuth: SAMLAuthenticator;
let awsManager: AWSSessionManager;

// 프로필별 자동 갱신 타이머 관리
const renewalTimers = new Map<string, NodeJS.Timeout>();
const renewalRetryCount = new Map<string, number>();

// 세션 자동 갱신 스케줄링
function scheduleAutoRenewal(alias: string, expirationDate: Date) {
  // 자동 갱신 설정 확인
  const autoRefreshSettings = configManager.getAutoRefreshSettings();

  // 자동 갱신이 비활성화되어 있으면 스케줄링 하지 않음
  if (!autoRefreshSettings.enabled) {
    console.log(`Auto-renewal disabled for ${alias}, skipping scheduling`);
    return;
  }

  // 기존 타이머가 있으면 취소
  const existingTimer = renewalTimers.get(alias);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const now = new Date().getTime();
  const expiration = expirationDate.getTime();
  const minutesBeforeExpiration = expiration - (autoRefreshSettings.timing * 60 * 1000);
  const timeUntilRenewal = minutesBeforeExpiration - now;

  console.log(`Auto-renewal scheduled for ${alias}: ${new Date(minutesBeforeExpiration).toLocaleString()} (${autoRefreshSettings.timing}분 전)`);

  // 이미 설정된 시간 이내로 남았다면 즉시 갱신
  if (timeUntilRenewal <= 0) {
    console.log(`Session for ${alias} expires soon, renewing immediately`);
    autoRenewSession(alias);
    return;
  }

  // 타이머 설정
  const timer = setTimeout(() => {
    autoRenewSession(alias);
  }, timeUntilRenewal);

  renewalTimers.set(alias, timer);
}

// 세션 자동 갱신 실행 (재시도 로직 포함)
async function autoRenewSession(alias: string, retryAttempt: number = 0) {
  const maxRetries = 3;
  const retryDelayMs = 10000; // 10초

  console.log(`Auto-renewing session for ${alias} (attempt ${retryAttempt + 1}/${maxRetries})`);

  try {
    const profiles = configManager.getProfiles();
    const profile = profiles.find(p => p.alias === alias);

    if (!profile) {
      console.log(`Profile ${alias} not found, skipping auto-renewal`);
      return;
    }

    // 활성 프로필인지 확인
    const activeProfiles = configManager.getActiveProfiles();
    if (!activeProfiles.includes(alias)) {
      console.log(`Profile ${alias} is not active, skipping auto-renewal`);
      return;
    }

    // 자동 갱신 설정에 따라 silent 모드 결정
    const autoRefreshSettings = configManager.getAutoRefreshSettings();
    const silentMode = autoRefreshSettings.silent;

    console.log(`Opening browser for auto-renewal: ${alias} (silent: ${silentMode})`);
    const samlAssertion = await samlAuth.authenticate(profile.samlUrl, { silent: silentMode });

    const sessionDuration = process.env.KEY_TI_SESSION_DURATION
      ? parseInt(process.env.KEY_TI_SESSION_DURATION)
      : 43200;

    const credentials = await awsManager.assumeRoleWithSAML(
      profile.roleArn,
      profile.idp,
      samlAssertion,
      sessionDuration
    );

    await awsManager.saveCredentialsToAWSConfig(profile.profileName, credentials);

    configManager.updateProfile(alias, {
      ...profile,
      lastRefresh: new Date().toISOString(),
      expiration: credentials.expiration.toISOString()
    });

    // 다음 갱신 스케줄링
    scheduleAutoRenewal(alias, credentials.expiration);

    // Tray 업데이트
    updateTray();

    // 성공 시 재시도 카운트 초기화
    renewalRetryCount.delete(alias);

    console.log(`Auto-renewal successful for ${alias}, next expiration: ${credentials.expiration.toISOString()}`);

    // 사용자에게 알림 및 UI 업데이트 (silent 모드가 아닐 때만)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        if (typeof window.loadProfiles === 'function') {
          window.loadProfiles();
        }
      `);

      // silent 모드가 아닐 때만 알림 표시
      if (!silentMode) {
        mainWindow.webContents.executeJavaScript(`
          window.showStatus('세션이 자동으로 갱신되었습니다: ${alias}', 'success');
        `);
      }
    }
  } catch (error) {
    console.error(`Auto-renewal failed for ${alias} (attempt ${retryAttempt + 1}):`, error);

    // 재시도 가능한 경우
    if (retryAttempt < maxRetries - 1) {
      console.log(`Retrying auto-renewal for ${alias} in ${retryDelayMs / 1000} seconds...`);

      setTimeout(() => {
        autoRenewSession(alias, retryAttempt + 1);
      }, retryDelayMs);
    } else {
      // 최대 재시도 횟수 초과 시 사용자에게 알림
      console.error(`Auto-renewal failed for ${alias} after ${maxRetries} attempts`);
      renewalRetryCount.delete(alias);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
          window.showStatus('세션 자동 갱신 실패: ${alias}. 수동으로 갱신해주세요.', 'error');
        `);
      }
    }
  }
}

// 타이머 취소
function cancelAutoRenewal(alias: string) {
  const timer = renewalTimers.get(alias);
  if (timer) {
    clearTimeout(timer);
    renewalTimers.delete(alias);
    console.log(`Auto-renewal cancelled for ${alias}`);
  }
}

// Dock 아이콘 업데이트 (활성 세션 여부에 따라)
function updateDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) {
    return;
  }

  const activeProfiles = configManager.getActiveProfiles();
  const hasActiveSessions = activeProfiles.length > 0;

  const getIconPath = () => {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'key-logo.png');
    } else {
      return path.join(__dirname, '..', 'build', 'key-logo.png');
    }
  };

  const iconPath = getIconPath();
  let dockIcon = nativeImage.createFromPath(iconPath);

  // 활성 세션이 있으면 녹색 배지 추가
  if (hasActiveSessions) {
    // 배지로 활성 세션 수 표시
    app.dock.setBadge(activeProfiles.length.toString());
  } else {
    // 배지 제거
    app.dock.setBadge('');
  }

  app.dock.setIcon(dockIcon);
}

function createWindow() {
  // 로고 아이콘 경로 (개발 vs 배포)
  const getIconPath = () => {
    if (app.isPackaged) {
      // 배포 환경: Resources/key-logo.png
      return path.join(process.resourcesPath, 'key-logo.png');
    } else {
      // 개발 환경: build/key-logo.png
      return path.join(__dirname, '..', 'build', 'key-logo.png');
    }
  };

  const iconPath = getIconPath();

  // Dock 아이콘 설정
  if (process.platform === 'darwin' && app.dock) {
    const dockIcon = nativeImage.createFromPath(iconPath);
    app.dock.setIcon(dockIcon);
  }

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#f5f5f7',
    title: 'Key-ti',
    icon: iconPath
  });

  // 모든 데스크톱 공간에서 보이도록
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  // DevTools 열기 (필요시 주석 해제)
  // mainWindow.webContents.openDevTools();

  // 창 닫기 버튼 클릭 시 숨기기만 하고 앱은 계속 실행
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
  });
}

function createTray() {
  // 로고 아이콘 경로 (개발 vs 배포)
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'key-logo.png')
    : path.join(__dirname, '..', 'build', 'key-logo.png');

  const icon = nativeImage.createFromPath(iconPath);

  // 16x16 크기로 리사이즈 (macOS menu bar 표준 크기)
  const resizedIcon = icon.resize({ width: 16, height: 16 });
  resizedIcon.setTemplateImage(true); // 다크모드 자동 대응

  tray = new Tray(resizedIcon);
  updateTray();

  // Tray 아이콘 클릭 시 창 표시
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

function updateTray() {
  if (!tray) return;

  const activeProfiles = configManager.getActiveProfiles();
  const profiles = configManager.getProfiles();

  // Dock 아이콘도 함께 업데이트
  updateDockIcon();

  // 활성 세션 수 항상 표시 (통일성)
  const titleText = `${activeProfiles.length}`;

  tray.setTitle(titleText);
  tray.setToolTip(`Key-ti - ${activeProfiles.length}개 활성 세션`);

  const menuItems: any[] = [];

  // 활성 세션 정보 표시
  if (activeProfiles.length > 0) {
    menuItems.push({
      label: `활성 세션 (${activeProfiles.length}개)`,
      enabled: false
    });

    activeProfiles.forEach(alias => {
      const profile = profiles.find(p => p.alias === alias);
      if (profile) {
        let expirationText = '';
        if (profile.expiration) {
          const expiration = new Date(profile.expiration);
          const now = new Date();
          const remainingMinutes = Math.floor((expiration.getTime() - now.getTime()) / 60000);
          expirationText = remainingMinutes > 0 ? ` (${remainingMinutes}분 남음)` : ' (만료됨)';
        }
        menuItems.push({
          label: `  ${profile.alias} - ${profile.profileName}${expirationText}`,
          enabled: false
        });
      }
    });

    menuItems.push({ type: 'separator' });
  }

  // 기본 메뉴
  menuItems.push({
    label: 'Key-ti 열기',
    click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    }
  });

  menuItems.push({ type: 'separator' });

  menuItems.push({
    label: '종료',
    click: () => {
      isQuitting = true;
      app.quit();
    }
  });

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

// 기존 AWS credentials 확인 및 백업
function checkExistingCredentials() {
  try {
    const result = awsManager.checkAndBackupExistingCredentials();

    if (result.hasExisting && result.backupPath) {
      // 렌더러 프로세스에 메시지 전송
      if (mainWindow && !mainWindow.isDestroyed()) {
        const message = `Key-ti가 만들지 않은 AWS credentials를 발견하여 백업했습니다.\\n백업 위치: ${result.backupPath}`;
        mainWindow.webContents.executeJavaScript(`
          window.showStatus('${message}', 'info');
        `);
      }

      console.log(`Backed up existing AWS credentials to: ${result.backupPath}`);
    }
  } catch (error) {
    console.error('Error checking existing credentials:', error);
  }
}

// 자동 업데이트 설정
// TODO: 코드 서명 추가 후 자동 업데이트 활성화
// - Apple Developer Program 가입 필요 ($99/year)
// - electron-builder에 코드 서명 인증서 설정
// - 현재는 GitHub Releases 페이지로 수동 업데이트 안내
function setupAutoUpdater() {
  // 개발 모드에서는 업데이트 체크 안함
  if (!app.isPackaged) {
    console.log('Development mode - auto update disabled');
    return;
  }

  // 자동 다운로드 비활성화 (사용자에게 먼저 알림)
  autoUpdater.autoDownload = false;

  // 업데이트 확인
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  // 업데이트 사용 가능
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);

    // renderer에 업데이트 정보 전달 (팝업 대신 인라인 표시)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info.version);
    }
  });

  // 업데이트 없음
  autoUpdater.on('update-not-available', () => {
    console.log('No updates available');
  });

  // 에러 처리
  autoUpdater.on('error', (error) => {
    console.error('Auto updater error:', error);
    // 에러 발생 시 조용히 무시 (사용자에게 알리지 않음)
  });

  // 앱 시작 5초 후 업데이트 확인
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
}

app.whenReady().then(() => {
  configManager = new ConfigManager();
  samlAuth = new SAMLAuthenticator();
  awsManager = new AWSSessionManager();

  // Dock에 명시적으로 표시
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
  }

  createTray();
  createWindow();

  // 초기 Dock 아이콘 상태 설정
  updateDockIcon();

  // 윈도우가 준비되면 기존 AWS credentials 확인
  if (mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        checkExistingCredentials();
      }, 1000);
    });
  }

  // 자동 업데이트 설정
  setupAutoUpdater();

  // 기존 활성 프로필들의 자동 갱신 스케줄링
  const activeProfiles = configManager.getActiveProfiles();
  const allProfiles = configManager.getProfiles();

  activeProfiles.forEach(alias => {
    const profile = allProfiles.find(p => p.alias === alias);
    if (profile && profile.expiration) {
      const expirationDate = new Date(profile.expiration);
      scheduleAutoRenewal(alias, expirationDate);
      console.log(`Scheduled auto-renewal for existing active profile: ${alias}`);
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // 창이 모두 닫혀도 앱은 계속 실행 (Dock과 Tray에 남아있음)
  // 아무것도 하지 않음
});

app.on('before-quit', async (event) => {
  // 업데이트 설치 중이면 백업 스킵하고 바로 종료
  if (isUpdating) {
    return;
  }

  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;

    // 자동 백업 확인 및 실행
    try {
      const backupDir = getBackupDir();
      const settingsPath = path.join(backupDir, 'backup-settings.json');

      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

        if (settings.autoBackup && settings.type === 'local') {
          console.log('Auto backup starting...');

          // 윈도우가 있으면 백업 데이터 요청
          if (mainWindow && !mainWindow.isDestroyed()) {
            const backupData = await mainWindow.webContents.executeJavaScript(`
              (async () => {
                const profiles = await window.electronAPI.getProfiles();
                const otpAccounts = await window.electronAPI.getOTPAccounts();
                const memos = localStorage.getItem('memos');
                const links = localStorage.getItem('links');
                const settings = localStorage.getItem('backupSettings');

                return {
                  profiles: profiles,
                  otpAccounts: otpAccounts,
                  memos: memos ? JSON.parse(memos) : [],
                  links: links ? JSON.parse(links) : [],
                  backupSettings: settings ? JSON.parse(settings) : null,
                  timestamp: new Date().toISOString()
                };
              })()
            `);

            const timestamp = Date.now();
            const filename = `backup-auto-${timestamp}.json`;
            const filepath = path.join(backupDir, filename);
            fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf8');
            console.log('Auto backup completed:', filename);
          }
        }
      }
    } catch (error) {
      console.error('Auto backup failed:', error);
    }

    // 모든 활성 세션 로그아웃 처리
    const activeProfiles = configManager.getActiveProfiles();
    const profiles = configManager.getProfiles();

    activeProfiles.forEach(alias => {
      const profile = profiles.find(p => p.alias === alias);
      if (profile) {
        console.log(`Main: Cleaning up session for ${alias} on app quit`);
        awsManager.removeCredentialsFromAWSConfig(profile.profileName);
      }
    });

    // 백업 및 로그아웃 완료 후 앱 종료
    app.quit();
    return;
  }

  // 이미 isQuitting이 true인 경우 (두 번째 호출)
  // 모든 활성 세션 로그아웃 처리
  const activeProfiles = configManager.getActiveProfiles();
  const profiles = configManager.getProfiles();

  activeProfiles.forEach(alias => {
    const profile = profiles.find(p => p.alias === alias);
    if (profile) {
      console.log(`Main: Cleaning up session for ${alias} on app quit`);
      awsManager.removeCredentialsFromAWSConfig(profile.profileName);
    }
  });

  // 모든 활성 프로필 제거
  activeProfiles.forEach(alias => {
    configManager.removeActiveProfile(alias);
  });
});

// IPC Handlers
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

ipcMain.handle('get-profiles', async () => {
  return configManager.getProfiles();
});

ipcMain.handle('validate-sessions', async () => {
  console.log('Main: Validating active sessions...');

  const profiles = configManager.getProfiles();
  const activeProfiles = configManager.getActiveProfiles();

  // 각 활성 프로필의 실제 세션 존재 여부 확인
  for (const alias of activeProfiles) {
    const profile = profiles.find(p => p.alias === alias);

    if (!profile) {
      console.log(`Main: Profile ${alias} not found, removing from active`);
      configManager.removeActiveProfile(alias);
      continue;
    }

    // AWS credentials 파일에서 세션 토큰 존재 여부 확인
    const hasSession = awsManager.checkSessionTokenExists(profile.profileName);

    if (!hasSession) {
      console.log(`Main: No session token found for ${alias}, removing from active`);
      configManager.removeActiveProfile(alias);
      continue;
    }

    // 만료 시간 확인
    if (profile.expiration) {
      const expiration = new Date(profile.expiration);
      const now = new Date();

      if (expiration < now) {
        console.log(`Main: Session expired for ${alias}, removing from active`);
        configManager.removeActiveProfile(alias);
      }
    }
  }

  console.log('Main: Session validation complete');
  return { success: true };
});

ipcMain.handle('add-profile', async (event, profile: AWSProfile) => {
  console.log('IPC: add-profile called with:', profile);
  configManager.addProfile(profile);
  const profiles = configManager.getProfiles();
  console.log('Current profiles after add:', profiles);
  return { success: true };
});

ipcMain.handle('update-profile', async (event, alias: string, profile: AWSProfile) => {
  console.log('IPC: update-profile called with:', alias, profile);
  configManager.updateProfile(alias, profile);
  const profiles = configManager.getProfiles();
  console.log('Current profiles after update:', profiles);
  return { success: true };
});

ipcMain.handle('delete-profile', async (event, alias: string) => {
  configManager.deleteProfile(alias);
  return { success: true };
});

ipcMain.handle('get-active-profile', async () => {
  return configManager.getActiveProfile();
});

ipcMain.handle('activate-profile', async (event, alias: string) => {
  try {
    console.log('Main: Activating profile:', alias);
    const profiles = configManager.getProfiles();
    const profile = profiles.find(p => p.alias === alias);

    if (!profile) {
      console.error('Main: Profile not found:', alias);
      return { success: false, message: '프로필을 찾을 수 없습니다' };
    }

    // 중복된 프로필 이름으로 활성화된 세션이 있는지 체크
    const activeProfiles = configManager.getActiveProfiles();
    const duplicateProfile = profiles.find(
      p => p.alias !== alias &&
      p.profileName === profile.profileName &&
      activeProfiles.includes(p.alias)
    );

    if (duplicateProfile) {
      console.error('Main: Duplicate profile name already active:', duplicateProfile.alias);
      return {
        success: false,
        message: `프로필 이름 "${profile.profileName}"이(가) 이미 활성화되어 있습니다 (${duplicateProfile.alias})`
      };
    }

    console.log('Main: Profile found:', profile);

    // 이미 활성화된 세션인지 확인 (갱신 요청인지)
    const isRefresh = profile.isActive;

    // 유효한 세션이 이미 있는지 확인 (로그인 요청인 경우만)
    if (!isRefresh) {
      const hasValidSession = awsManager.checkSessionTokenExists(profile.profileName);

      if (hasValidSession && profile.expiration) {
        const expiration = new Date(profile.expiration);
        const now = new Date();

        if (expiration > now) {
          console.log('Main: Valid session already exists, skipping SAML authentication');

          // 활성 상태만 업데이트
          configManager.setActiveProfile(alias);

          // Menu Bar 업데이트
          updateTray();

          const expirationTime = expiration.toLocaleString('ko-KR');
          return {
            success: true,
            message: `기존 세션이 활성화되었습니다 (만료: ${expirationTime})`
          };
        }
      }
    }

    // 갱신이거나 새로운 로그인
    console.log(isRefresh ? 'Main: Refreshing session...' : 'Main: Starting new session...');

    // SAML 인증 수행
    const samlAssertion = await samlAuth.getSAMLAssertion(profile.samlUrl);

    console.log('Main: SAML assertion received, length:', samlAssertion.length);
    console.log('Main: Calling AWS STS AssumeRoleWithSAML...');

    // AWS STS로 임시 자격 증명 획득
    // SAMLAssertion은 이미 base64이므로 그대로 전달
    // 테스트용으로 세션 시간을 줄이려면 환경 변수 설정: export KEY_TI_SESSION_DURATION=300 (5분)
    const sessionDuration = process.env.KEY_TI_SESSION_DURATION
      ? parseInt(process.env.KEY_TI_SESSION_DURATION)
      : 43200; // 기본값: 12시간

    const credentials = await awsManager.assumeRoleWithSAML(
      profile.roleArn,
      profile.idp,
      samlAssertion,
      sessionDuration
    );

    console.log('Main: Got credentials, expiration:', credentials.expiration);

    // AWS credentials 파일에 저장
    await awsManager.saveCredentialsToAWSConfig(profile.profileName, credentials);

    console.log('Main: Credentials saved to ~/.aws/credentials');

    // 프로필에 만료 시간 저장
    configManager.updateProfile(alias, {
      ...profile,
      lastRefresh: new Date().toISOString(),
      expiration: credentials.expiration.toISOString()
    });

    // 활성 프로필로 설정
    configManager.setActiveProfile(alias);

    // 자동 갱신 스케줄링 (만료 10분 전)
    scheduleAutoRenewal(alias, credentials.expiration);

    // Tray 업데이트
    updateTray();

    const expirationTime = credentials.expiration.toLocaleString('ko-KR');
    return {
      success: true,
      message: isRefresh ? `세션이 갱신되었습니다 (만료: ${expirationTime})` : `세션이 활성화되었습니다 (만료: ${expirationTime})`
    };
  } catch (error) {
    console.error('Main: Profile activation failed:', error);
    return {
      success: false,
      message: `세션 활성화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    };
  }
});

ipcMain.handle('deactivate-profile', async (event, alias: string) => {
  try {
    console.log('Main: Deactivating profile:', alias);

    // 프로필 정보 가져오기
    const profiles = configManager.getProfiles();
    const profile = profiles.find(p => p.alias === alias);

    if (profile) {
      // AWS credentials 파일에서 삭제
      console.log('Main: Removing credentials from ~/.aws/credentials');
      awsManager.removeCredentialsFromAWSConfig(profile.profileName);
    }

    // ConfigManager에서 활성 프로필 제거
    configManager.removeActiveProfile(alias);

    // 자동 갱신 타이머 취소
    cancelAutoRenewal(alias);

    // Tray 업데이트
    updateTray();

    console.log('Main: Profile deactivated successfully');

    return {
      success: true,
      message: '세션이 로그아웃되었습니다'
    };
  } catch (error) {
    console.error('Main: Profile deactivation failed:', error);
    return {
      success: false,
      message: `로그아웃 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    };
  }
});

ipcMain.handle('open-console', async (event, alias: string) => {
  try {
    console.log('Main: Opening AWS console for:', alias);

    const profiles = configManager.getProfiles();
    const profile = profiles.find(p => p.alias === alias);

    if (!profile) {
      return { success: false, message: '프로필을 찾을 수 없습니다' };
    }

    const consoleUrl = await awsManager.generateConsoleUrl(profile.profileName);
    await shell.openExternal(consoleUrl);

    return { success: true, message: 'AWS 콘솔을 브라우저에서 열었습니다' };
  } catch (error) {
    console.error('Main: Failed to open console:', error);
    return {
      success: false,
      message: `콘솔 열기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    };
  }
});

ipcMain.handle('open-url', async (event, url: string) => {
  try {
    await shell.openExternal(url);
  } catch (error) {
    console.error('Main: Failed to open URL:', error);
  }
});

// ========== 백업 관련 IPC 핸들러 ==========
function getBackupDir(): string {
  const homeDir = os.homedir();
  const backupDir = path.join(homeDir, '.key-ti');

  // 디렉토리가 없으면 생성
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  return backupDir;
}

ipcMain.handle('get-backup-path', async () => {
  return getBackupDir();
});

ipcMain.handle('test-backup-path', async () => {
  try {
    const backupDir = getBackupDir();

    // 쓰기 권한 테스트
    const testFile = path.join(backupDir, '.test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('save-backup', async (event, data: any) => {
  try {
    const backupDir = getBackupDir();

    // 설정만 저장하는 경우
    if (data._settingsOnly) {
      const settingsPath = path.join(backupDir, 'backup-settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(data.settings, null, 2), 'utf8');
      return { success: true, filename: 'backup-settings.json' };
    }

    // 일반 백업
    const timestamp = Date.now();
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');

    return { success: true, filename };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('list-backups', async () => {
  try {
    const backupDir = getBackupDir();

    if (!fs.existsSync(backupDir)) {
      return { success: true, backups: [] };
    }

    const files = fs.readdirSync(backupDir);
    const backups = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(filename => {
        const filepath = path.join(backupDir, filename);
        const stats = fs.statSync(filepath);
        return {
          filename,
          timestamp: stats.mtime.toISOString(),
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { success: true, backups };
  } catch (error: any) {
    return { success: false, backups: [] };
  }
});

ipcMain.handle('load-backup', async (event, filename: string) => {
  try {
    const backupDir = getBackupDir();
    const filepath = path.join(backupDir, filename);

    if (!fs.existsSync(filepath)) {
      return { success: false, message: '백업 파일을 찾을 수 없습니다' };
    }

    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    return { success: true, data };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-auto-backup-settings', async () => {
  try {
    const backupDir = getBackupDir();
    const settingsPath = path.join(backupDir, 'backup-settings.json');

    if (!fs.existsSync(settingsPath)) {
      return { enabled: false, type: 'none' };
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return { enabled: settings.autoBackup || false, type: settings.type || 'none' };
  } catch (error: any) {
    return { enabled: false, type: 'none' };
  }
});

// 자동 갱신 설정 관리
ipcMain.handle('get-auto-refresh-settings', async () => {
  return configManager.getAutoRefreshSettings();
});

ipcMain.handle('set-auto-refresh-settings', async (event, settings) => {
  configManager.setAutoRefreshSettings(settings);

  // 설정 변경 후 모든 활성 세션의 타이머 재스케줄링
  const activeProfiles = configManager.getActiveProfiles();
  const profiles = configManager.getProfiles();

  activeProfiles.forEach(alias => {
    const profile = profiles.find(p => p.alias === alias);
    if (profile && profile.expiration) {
      // 기존 타이머 취소 후 새 설정으로 재스케줄링
      scheduleAutoRenewal(alias, new Date(profile.expiration));
    }
  });

  return { success: true };
});

// OTP 관련 IPC 핸들러
ipcMain.handle('get-otp-accounts', async () => {
  return configManager.getOTPAccounts();
});

ipcMain.handle('add-otp-account', async (event, account: OTPAccount) => {
  configManager.addOTPAccount(account);
  return { success: true };
});

ipcMain.handle('update-otp-account', async (event, id: string, account: OTPAccount) => {
  configManager.updateOTPAccount(id, account);
  return { success: true };
});

ipcMain.handle('delete-otp-account', async (event, id: string) => {
  configManager.deleteOTPAccount(id);
  return { success: true };
});

// OTP 창 생성 함수
function createOTPWindow(account: OTPAccount) {
  // 기존 OTP 창이 있으면 닫기
  if (otpWindow && !otpWindow.isDestroyed()) {
    otpWindow.close();
  }

  // 메인 창 위치 가져오기
  let x = 100;
  let y = 100;

  if (mainWindow && !mainWindow.isDestroyed()) {
    const mainBounds = mainWindow.getBounds();
    // 메인 창 오른쪽에 약간 떨어진 위치
    x = mainBounds.x + mainBounds.width + 20;
    y = mainBounds.y;
  }

  otpWindow = new BrowserWindow({
    width: 300,
    height: 380,
    x: x,
    y: y,
    frame: false,
    resizable: false,
    transparent: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#667eea'
  });

  // HTML 컨텐츠 직접 생성
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 30px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          box-sizing: border-box;
        }
        .close-btn {
          position: absolute;
          top: 15px;
          right: 15px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: rotate(90deg);
        }
        .title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
          opacity: 0.9;
          text-align: center;
        }
        .issuer {
          font-size: 12px;
          opacity: 0.7;
          margin-bottom: 30px;
          text-align: center;
        }
        .code {
          font-size: 52px;
          font-weight: 700;
          letter-spacing: 8px;
          margin: 30px 0;
          font-family: Monaco, monospace;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          user-select: none;
          transition: transform 0.2s;
        }
        .code:hover {
          transform: scale(1.05);
          opacity: 0.9;
        }
        .code:active {
          transform: scale(0.98);
        }
        .timer {
          font-size: 28px;
          font-weight: 600;
          margin-top: 15px;
          opacity: 0.9;
        }
        .hint {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 30px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <button class="close-btn" onclick="window.close()">×</button>
      <div class="title">${account.name}</div>
      <div class="issuer">${account.issuer || ''}</div>
      <div class="code" id="code">------</div>
      <div class="timer" id="timer">30s</div>
      <div class="hint">클릭하여 복사</div>

      <script>
        const { ipcRenderer } = require('electron');
        const account = ${JSON.stringify(account)};

        async function updateOTP() {
          const result = await ipcRenderer.invoke('generate-otp-code', account);
          if (result.success) {
            document.getElementById('code').textContent = result.token || '------';
            document.getElementById('timer').textContent = result.timeRemaining + 's';
          }
        }

        function copyCode() {
          const code = document.getElementById('code').textContent;
          if (code && code !== '------') {
            try {
              // 임시 textarea 생성 방식으로 복사
              const textarea = document.createElement('textarea');
              textarea.value = code;
              textarea.style.position = 'fixed';
              textarea.style.opacity = '0';
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);

              // 복사 성공 시각적 피드백
              const codeEl = document.getElementById('code');
              if (codeEl) {
                codeEl.style.opacity = '0.5';
                setTimeout(() => {
                  codeEl.style.opacity = '1';
                }, 200);
              }
              console.log('Copied:', code);
            } catch (err) {
              console.error('Failed to copy:', err);
            }
          }
        }

        // 클릭 이벤트 리스너 등록
        document.getElementById('code').addEventListener('click', copyCode);

        // 초기 업데이트 및 1초마다 갱신
        updateOTP();
        setInterval(updateOTP, 1000);
      </script>
    </body>
    </html>
  `;

  otpWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

  otpWindow.on('closed', () => {
    otpWindow = null;
  });
}

ipcMain.handle('show-otp-window', async (event, account: OTPAccount) => {
  createOTPWindow(account);
  return { success: true };
});

ipcMain.handle('close-otp-window', async () => {
  if (otpWindow && !otpWindow.isDestroyed()) {
    otpWindow.close();
    otpWindow = null;
  }
  return { success: true };
});

ipcMain.handle('generate-otp-code', async (event, account: OTPAccount) => {
  try {
    // Secret 키 정규화 (공백 제거 및 대문자 변환)
    let secret = account.secret.replace(/\s/g, '').toUpperCase();

    // Base32 패딩 추가 (필요한 경우)
    const paddingNeeded = (8 - (secret.length % 8)) % 8;
    if (paddingNeeded > 0) {
      secret = secret + '='.repeat(paddingNeeded);
    }

    // 옵션 설정
    const algo = (account.algorithm || 'sha1').toLowerCase();

    authenticator.options = {
      algorithm: algo as any,
      digits: account.digits || 6,
      step: account.period || 30
    };

    console.log('=== OTP Generation Debug ===');
    console.log('Original secret:', account.secret);
    console.log('Normalized secret:', secret);
    console.log('Algorithm:', algo);
    console.log('Digits:', account.digits || 6);
    console.log('Period:', account.period || 30);
    console.log('Secret length:', secret.length);
    console.log('Current time:', new Date().toISOString());
    console.log('Unix timestamp:', Math.floor(Date.now() / 1000));

    const token = authenticator.generate(secret);
    const timeRemaining = authenticator.timeRemaining();

    console.log('Generated token:', token);
    console.log('Time remaining:', timeRemaining);
    console.log('Self-validation:', authenticator.check(token, secret) ? 'PASS' : 'FAIL');
    console.log('=========================');

    return {
      success: true,
      token,
      timeRemaining
    };
  } catch (error) {
    console.error('Failed to generate OTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});
