import { app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ConfigManager } from './config';
import { SAMLAuthenticator } from './saml';
import { AWSSessionManager } from './aws';
import { AWSProfile } from './types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let configManager: ConfigManager;
let samlAuth: SAMLAuthenticator;
let awsManager: AWSSessionManager;

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

  // 활성 세션이 1개면 프로필 이름, 2개 이상이면 숫자 표시
  let titleText = '';
  if (activeProfiles.length === 1) {
    const profile = profiles.find(p => p.alias === activeProfiles[0]);
    titleText = profile ? profile.alias : '1';
  } else if (activeProfiles.length > 1) {
    titleText = `${activeProfiles.length}`;
  }

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

  // 윈도우가 준비되면 기존 AWS credentials 확인
  if (mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        checkExistingCredentials();
      }, 1000);
    });
  }

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
                const memos = localStorage.getItem('memos');
                const links = localStorage.getItem('links');
                const settings = localStorage.getItem('backupSettings');

                return {
                  profiles: profiles,
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
    const credentials = await awsManager.assumeRoleWithSAML(
      profile.roleArn,
      profile.idp,
      samlAssertion,
      43200 // 12시간
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
