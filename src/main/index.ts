import { app, BrowserWindow, nativeImage, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from './config';
import { SAMLAuthenticator } from '../services/saml';
import { AWSSessionManager } from '../services/aws';
import { WindowManager } from './window-manager';
import { TrayManager } from './tray-manager';
import { AutoRenewalManager } from './auto-renewal-manager';
import { BackupManager } from './backup-manager';
import { registerIPCHandlers } from './ipc-handlers';
import { getIconPath, getBackupDir } from '../shared/utils';

// 전역 변수
let isQuitting = false;
let isUpdating = false;

// 관리자 인스턴스
let configManager: ConfigManager;
let samlAuth: SAMLAuthenticator;
let awsManager: AWSSessionManager;
let windowManager: WindowManager;
let trayManager: TrayManager;
let autoRenewalManager: AutoRenewalManager;
let backupManager: BackupManager;

/**
 * Tray 업데이트 헬퍼
 */
function updateTray() {
  const activeProfiles = configManager.getActiveProfiles();
  const profiles = configManager.getProfiles();
  trayManager.update(activeProfiles, profiles);
}

/**
 * 메인 윈도우 표시
 */
function showMainWindow() {
  const mainWindow = windowManager.getMainWindow();
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
}

/**
 * 앱 종료
 */
function quitApp() {
  isQuitting = true;
  app.quit();
}

/**
 * 메인 윈도우 생성
 */
function createWindow() {
  const mainWindow = windowManager.createMainWindow();

  // Dock 아이콘 설정
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = getIconPath();
    const dockIcon = nativeImage.createFromPath(iconPath);
    app.dock.setIcon(dockIcon);
  }

  // 창 닫기 버튼 클릭 시 숨기기
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // 윈도우가 준비되면 기존 AWS credentials 확인 및 첫 실행 체크
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      checkExistingCredentials();
      checkFirstRun();
    }, 1000);
  });
}

/**
 * 기존 AWS credentials 확인 및 백업
 */
function checkExistingCredentials() {
  try {
    const result = awsManager.checkAndBackupExistingCredentials();

    if (result.hasExisting && result.backupPath) {
      const mainWindow = windowManager.getMainWindow();
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

/**
 * 첫 실행 시 Import 다이얼로그 표시
 */
function checkFirstRun() {
  try {
    const profiles = configManager.getProfiles();

    // 프로필이 없으면 첫 실행으로 간주
    if (profiles.length === 0) {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        setTimeout(() => {
          mainWindow.webContents.executeJavaScript(`
            window.showFirstRunImportDialog?.();
          `);
        }, 500);
      }
    }
  } catch (error) {
    console.error('Error checking first run:', error);
  }
}

/**
 * 자동 업데이트 설정
 */
function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log('Development mode - auto update disabled');
    return;
  }

  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info.version);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available');
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto updater error:', error);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
}

/**
 * 앱 초기화
 */
app.whenReady().then(() => {
  // 관리자 인스턴스 생성
  configManager = new ConfigManager();
  samlAuth = new SAMLAuthenticator();
  awsManager = new AWSSessionManager();
  windowManager = new WindowManager();
  backupManager = new BackupManager();

  autoRenewalManager = new AutoRenewalManager(
    configManager,
    samlAuth,
    awsManager,
    updateTray
  );

  trayManager = new TrayManager(showMainWindow, quitApp);

  // Dock 표시
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
  }

  // Tray 및 Window 생성
  trayManager.create();
  createWindow();
  updateTray();

  // IPC 핸들러 등록
  registerIPCHandlers(
    configManager,
    samlAuth,
    awsManager,
    windowManager,
    autoRenewalManager,
    backupManager,
    updateTray
  );

  // 자동 업데이트 설정
  setupAutoUpdater();

  // 기존 활성 프로필 자동 갱신 스케줄링
  const activeProfiles = configManager.getActiveProfiles();
  const allProfiles = configManager.getProfiles();

  activeProfiles.forEach(alias => {
    const profile = allProfiles.find(p => p.alias === alias);
    if (profile && profile.expiration) {
      const expirationDate = new Date(profile.expiration);
      autoRenewalManager.schedule(alias, expirationDate);
      console.log(`Scheduled auto-renewal for existing active profile: ${alias}`);
    }
  });

  app.on('activate', () => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow === null || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

/**
 * 모든 창이 닫혀도 앱 유지
 */
app.on('window-all-closed', () => {
  // 아무것도 하지 않음 (Dock과 Tray에 남아있음)
});

/**
 * 앱 종료 전 정리 작업
 */
app.on('before-quit', async (event) => {
  if (isUpdating) {
    return;
  }

  if (isQuitting) {
    return;
  }

  event.preventDefault();
  isQuitting = true;

  console.log('App quitting - starting cleanup...');

  // 자동 백업 실행
  try {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      const getBackupData = async () => {
        return await mainWindow.webContents.executeJavaScript(`
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
      };

      await backupManager.performAutoBackup(getBackupData);
    }
  } catch (error) {
    console.error('Auto backup failed:', error);
  }

  // 모든 활성 세션 로그아웃
  const activeProfiles = configManager.getActiveProfiles();
  const profiles = configManager.getProfiles();

  activeProfiles.forEach(alias => {
    const profile = profiles.find(p => p.alias === alias);
    if (profile) {
      console.log(`Main: Cleaning up session for ${alias} on app quit`);
      awsManager.removeCredentialsFromAWSConfig(profile.profileName);
    }
  });

  activeProfiles.forEach(alias => {
    configManager.removeActiveProfile(alias);
  });

  // 모든 타이머 정리
  autoRenewalManager.clearAll();

  // Tray 정리
  trayManager.destroy();

  // Dock 배지 제거
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setBadge('');
  }

  // 모든 윈도우 닫기
  windowManager.destroyAll();

  console.log('Cleanup completed - exiting app...');

  // 정리 완료 후 프로세스 종료
  app.exit(0);
});
