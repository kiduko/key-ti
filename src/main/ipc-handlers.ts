// IPC 핸들러 등록
import { ipcMain, app, shell } from 'electron';
import { ConfigManager } from './config.js';
import { SAMLAuthenticator } from '../services/saml.js';
import { AWSSessionManager } from '../services/aws.js';
import { WindowManager } from './window-manager.js';
import { AutoRenewalManager } from './auto-renewal-manager.js';
import { BackupManager } from './backup-manager.js';
import { AWSProfile, OTPAccount } from '../shared/types.js';
import otplib from 'otplib';
import * as claudeUsage from '../services/claude-usage.js';
const { authenticator } = otplib;

export function registerIPCHandlers(
  configManager: ConfigManager,
  samlAuth: SAMLAuthenticator,
  awsManager: AWSSessionManager,
  windowManager: WindowManager,
  autoRenewalManager: AutoRenewalManager,
  backupManager: BackupManager,
  onTrayUpdate: () => void,
  onClaudeSessionUpdate?: () => void
) {
  // 앱 버전
  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  // 프로필 관리
  ipcMain.handle('get-profiles', async () => {
    return configManager.getProfiles();
  });

  ipcMain.handle('add-profile', async (event, profile: AWSProfile) => {
    console.log('IPC: add-profile called with:', profile);
    configManager.addProfile(profile);
    return { success: true };
  });

  ipcMain.handle('update-profile', async (event, alias: string, profile: AWSProfile) => {
    console.log('IPC: update-profile called with:', alias, profile);
    configManager.updateProfile(alias, profile);
    return { success: true };
  });

  ipcMain.handle('delete-profile', async (event, alias: string) => {
    configManager.deleteProfile(alias);
    return { success: true };
  });

  // 세션 검증
  ipcMain.handle('validate-sessions', async () => {
    console.log('Main: Validating active sessions...');

    const profiles = configManager.getProfiles();
    const activeProfiles = configManager.getActiveProfiles();

    for (const alias of activeProfiles) {
      const profile = profiles.find(p => p.alias === alias);

      if (!profile) {
        console.log(`Main: Profile ${alias} not found, removing from active`);
        configManager.removeActiveProfile(alias);
        continue;
      }

      const hasSession = awsManager.checkSessionTokenExists(profile.profileName);

      if (!hasSession) {
        console.log(`Main: No session token found for ${alias}, removing from active`);
        configManager.removeActiveProfile(alias);
        continue;
      }

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

  // 프로필 활성화
  ipcMain.handle('activate-profile', async (event, alias: string) => {
    try {
      console.log('Main: Activating profile:', alias);
      const profiles = configManager.getProfiles();
      const profile = profiles.find(p => p.alias === alias);

      if (!profile) {
        console.error('Main: Profile not found:', alias);
        return { success: false, message: '프로필을 찾을 수 없습니다' };
      }

      // 중복 체크
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

      const isRefresh = profile.isActive;

      // 유효한 세션 확인
      if (!isRefresh) {
        const hasValidSession = awsManager.checkSessionTokenExists(profile.profileName);

        if (hasValidSession && profile.expiration) {
          const expiration = new Date(profile.expiration);
          const now = new Date();

          if (expiration > now) {
            console.log('Main: Valid session already exists, skipping SAML authentication');
            configManager.setActiveProfile(alias);
            onTrayUpdate();

            const expirationTime = expiration.toLocaleString('ko-KR');
            return {
              success: true,
              message: `기존 세션이 활성화되었습니다 (만료: ${expirationTime})`
            };
          }
        }
      }

      console.log(isRefresh ? 'Main: Refreshing session...' : 'Main: Starting new session...');

      const samlAssertion = await samlAuth.getSAMLAssertion(profile.samlUrl);
      console.log('Main: SAML assertion received, length:', samlAssertion.length);

      const sessionDuration = process.env.KEY_TI_SESSION_DURATION
        ? parseInt(process.env.KEY_TI_SESSION_DURATION)
        : 43200;

      const credentials = await awsManager.assumeRoleWithSAML(
        profile.roleArn,
        profile.idp,
        samlAssertion,
        sessionDuration
      );

      console.log('Main: Got credentials, expiration:', credentials.expiration);

      await awsManager.saveCredentialsToAWSConfig(profile.profileName, credentials);

      configManager.updateProfile(alias, {
        ...profile,
        lastRefresh: new Date().toISOString(),
        expiration: credentials.expiration.toISOString()
      });

      configManager.setActiveProfile(alias);
      autoRenewalManager.schedule(alias, credentials.expiration);
      onTrayUpdate();

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

  // 프로필 비활성화
  ipcMain.handle('deactivate-profile', async (event, alias: string) => {
    try {
      console.log('Main: Deactivating profile:', alias);

      const profiles = configManager.getProfiles();
      const profile = profiles.find(p => p.alias === alias);

      if (profile) {
        console.log('Main: Removing credentials from ~/.aws/credentials');
        awsManager.removeCredentialsFromAWSConfig(profile.profileName);
      }

      configManager.removeActiveProfile(alias);
      autoRenewalManager.cancel(alias);
      onTrayUpdate();

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

  // Active profile 조회 (레거시)
  ipcMain.handle('get-active-profile', async () => {
    return configManager.getActiveProfile();
  });

  // 콘솔 열기
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

  // URL 열기
  ipcMain.handle('open-url', async (event, url: string) => {
    try {
      await shell.openExternal(url);
    } catch (error) {
      console.error('Main: Failed to open URL:', error);
    }
  });

  // 백업 관련
  ipcMain.handle('get-backup-path', async () => {
    return backupManager.getBackupPath();
  });

  ipcMain.handle('test-backup-path', async () => {
    return backupManager.testBackupPath();
  });

  ipcMain.handle('save-backup', async (event, data: any) => {
    return backupManager.saveBackup(data);
  });

  ipcMain.handle('list-backups', async () => {
    return backupManager.listBackups();
  });

  ipcMain.handle('load-backup', async (event, filename: string) => {
    return backupManager.loadBackup(filename);
  });

  ipcMain.handle('get-auto-backup-settings', async () => {
    return backupManager.getAutoBackupSettings();
  });

  // 자동 갱신 설정
  ipcMain.handle('get-auto-refresh-settings', async () => {
    return configManager.getAutoRefreshSettings();
  });

  ipcMain.handle('set-auto-refresh-settings', async (event, settings) => {
    configManager.setAutoRefreshSettings(settings);

    const activeProfiles = configManager.getActiveProfiles();
    const profiles = configManager.getProfiles();

    // 모든 활성 프로필에 대해 스케줄 재설정
    // schedule() 메서드가 enabled 상태를 체크하여 타이머를 취소하거나 설정함
    activeProfiles.forEach(alias => {
      const profile = profiles.find(p => p.alias === alias);
      if (profile && profile.expiration) {
        autoRenewalManager.schedule(alias, new Date(profile.expiration));
      }
    });

    console.log(`Auto-refresh settings updated: enabled=${settings.enabled}, timing=${settings.timing}, silent=${settings.silent}`);

    return { success: true };
  });

  // Claude 사용량 타이틀 표시 설정
  ipcMain.handle('get-show-claude-usage-in-title', async () => {
    return configManager.getShowClaudeUsageInTitle();
  });

  ipcMain.handle('set-show-claude-usage-in-title', async (event, enabled: boolean) => {
    configManager.setShowClaudeUsageInTitle(enabled);
    // 설정 변경 시 즉시 타이틀 업데이트
    if (onClaudeSessionUpdate) {
      onClaudeSessionUpdate();
    }
    return { success: true };
  });

  // OTP 관리
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

  ipcMain.handle('show-otp-window', async (event, account: OTPAccount) => {
    windowManager.createOTPWindow(account);
    return { success: true };
  });

  ipcMain.handle('close-otp-window', async () => {
    windowManager.closeOTPWindow();
    return { success: true };
  });

  ipcMain.handle('generate-otp-code', async (event, account: OTPAccount) => {
    try {
      let secret = account.secret.replace(/\s/g, '').toUpperCase();

      const paddingNeeded = (8 - (secret.length % 8)) % 8;
      if (paddingNeeded > 0) {
        secret = secret + '='.repeat(paddingNeeded);
      }

      const algo = (account.algorithm || 'sha1').toLowerCase();

      authenticator.options = {
        algorithm: algo as any,
        digits: account.digits || 6,
        step: account.period || 30
      };

      const token = authenticator.generate(secret);
      const timeRemaining = authenticator.timeRemaining();

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

  // 텍스트로 Export/Import
  ipcMain.handle('export-to-text', async () => {
    return configManager.exportToText();
  });

  ipcMain.handle('import-from-text', async (event, text: string) => {
    return configManager.importFromText(text);
  });

  // Claude Code 사용량 분석
  ipcMain.handle('get-claude-usage-stats', async () => {
    try {
      return claudeUsage.getUsageStats();
    } catch (error) {
      console.error('Failed to get Claude usage stats:', error);
      return {
        sessions: [],
        dailyUsages: [],
        monthlyUsages: [],
        totalSessions: 0,
      };
    }
  });

  // Claude Code 일별 5시간 블록 사용량
  ipcMain.handle('get-claude-session-blocks', async (event, date: string) => {
    try {
      const sessions = claudeUsage.getAllSessions();
      return claudeUsage.getSessionBlockUsage(date, sessions);
    } catch (error) {
      console.error('Failed to get Claude session blocks:', error);
      return [];
    }
  });

  // 세션 리셋 시간 계산
  ipcMain.handle('calculate-session-reset', async () => {
    try {
      const sessions = claudeUsage.getAllSessions();
      const sessionInfo = claudeUsage.calculateCurrentSessionReset(sessions);

      if (!sessionInfo) {
        return null;
      }

      // Date 객체를 ISO 문자열로 변환하여 전송
      return {
        resetTime: sessionInfo.resetTime.toISOString(),
        firstSessionTime: sessionInfo.firstSessionTime.toISOString(),
        blockStartTime: sessionInfo.blockStartTime.toISOString(),
      };
    } catch (error) {
      console.error('Failed to calculate session reset:', error);
      return null;
    }
  });

  // 외부 브라우저로 URL 열기
  ipcMain.handle('open-external', async (event, url: string) => {
    try {
      await shell.openExternal(url);
    } catch (error) {
      console.error('Failed to open external URL:', error);
      throw error;
    }
  });
}
