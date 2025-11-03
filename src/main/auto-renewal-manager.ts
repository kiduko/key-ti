// 세션 자동 갱신 관리
import { BrowserWindow } from 'electron';
import { ConfigManager } from './config.js';
import { SAMLAuthenticator } from '../services/saml.js';
import { AWSSessionManager } from '../services/aws.js';

export class AutoRenewalManager {
  private renewalTimers = new Map<string, NodeJS.Timeout>();
  private renewalRetryCount = new Map<string, number>();

  constructor(
    private configManager: ConfigManager,
    private samlAuth: SAMLAuthenticator,
    private awsManager: AWSSessionManager,
    private onUpdate: () => void
  ) {}

  /**
   * 세션 자동 갱신 스케줄링
   */
  schedule(alias: string, expirationDate: Date): void {
    const autoRefreshSettings = this.configManager.getAutoRefreshSettings();

    // 기존 타이머가 있으면 먼저 취소
    const existingTimer = this.renewalTimers.get(alias);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.renewalTimers.delete(alias);
    }

    if (!autoRefreshSettings.enabled) {
      console.log(`Auto-renewal disabled for ${alias}, cancelled existing timer`);
      return;
    }

    const now = new Date().getTime();
    const expiration = expirationDate.getTime();
    const minutesBeforeExpiration = expiration - (autoRefreshSettings.timing * 60 * 1000);
    const timeUntilRenewal = minutesBeforeExpiration - now;

    console.log(`Auto-renewal scheduled for ${alias}: ${new Date(minutesBeforeExpiration).toLocaleString()} (${autoRefreshSettings.timing}분 전)`);

    if (timeUntilRenewal <= 0) {
      console.log(`Session for ${alias} expires soon, renewing immediately`);
      this.renew(alias);
      return;
    }

    const timer = setTimeout(() => {
      this.renew(alias);
    }, timeUntilRenewal);

    this.renewalTimers.set(alias, timer);
  }

  /**
   * 세션 자동 갱신 실행 (재시도 로직 포함)
   */
  async renew(alias: string, retryAttempt: number = 0): Promise<void> {
    const maxRetries = 3;
    const retryDelayMs = 10000;

    console.log(`Auto-renewing session for ${alias} (attempt ${retryAttempt + 1}/${maxRetries})`);

    try {
      const profiles = this.configManager.getProfiles();
      const profile = profiles.find(p => p.alias === alias);

      if (!profile) {
        console.log(`Profile ${alias} not found, skipping auto-renewal`);
        return;
      }

      const activeProfiles = this.configManager.getActiveProfiles();
      if (!activeProfiles.includes(alias)) {
        console.log(`Profile ${alias} is not active, skipping auto-renewal`);
        return;
      }

      const autoRefreshSettings = this.configManager.getAutoRefreshSettings();
      const silentMode = autoRefreshSettings.silent;

      console.log(`Opening browser for auto-renewal: ${alias} (silent: ${silentMode})`);
      const samlAssertion = await this.samlAuth.authenticate(profile.samlUrl, { silent: silentMode });

      const sessionDuration = process.env.KEY_TI_SESSION_DURATION
        ? parseInt(process.env.KEY_TI_SESSION_DURATION)
        : 43200;

      const credentials = await this.awsManager.assumeRoleWithSAML(
        profile.roleArn,
        profile.idp,
        samlAssertion,
        sessionDuration
      );

      await this.awsManager.saveCredentialsToAWSConfig(profile.profileName, credentials);

      this.configManager.updateProfile(alias, {
        ...profile,
        lastRefresh: new Date().toISOString(),
        expiration: credentials.expiration.toISOString()
      });

      this.schedule(alias, credentials.expiration);
      this.onUpdate();
      this.renewalRetryCount.delete(alias);

      console.log(`Auto-renewal successful for ${alias}, next expiration: ${credentials.expiration.toISOString()}`);

      this.notifyRenderer(alias, silentMode);
    } catch (error) {
      console.error(`Auto-renewal failed for ${alias} (attempt ${retryAttempt + 1}):`, error);

      if (retryAttempt < maxRetries - 1) {
        console.log(`Retrying auto-renewal for ${alias} in ${retryDelayMs / 1000} seconds...`);
        setTimeout(() => {
          this.renew(alias, retryAttempt + 1);
        }, retryDelayMs);
      } else {
        console.error(`Auto-renewal failed for ${alias} after ${maxRetries} attempts`);
        this.renewalRetryCount.delete(alias);
        this.notifyRendererError(alias);
      }
    }
  }

  /**
   * 타이머 취소
   */
  cancel(alias: string): void {
    const timer = this.renewalTimers.get(alias);
    if (timer) {
      clearTimeout(timer);
      this.renewalTimers.delete(alias);
      console.log(`Auto-renewal cancelled for ${alias}`);
    }
  }

  /**
   * 모든 타이머 정리
   */
  clearAll(): void {
    this.renewalTimers.forEach((timer, alias) => {
      clearTimeout(timer);
      console.log(`Cleared renewal timer for ${alias}`);
    });
    this.renewalTimers.clear();
  }

  private notifyRenderer(alias: string, silentMode: boolean): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        if (typeof window.loadProfiles === 'function') {
          window.loadProfiles();
        }
      `);

      if (!silentMode) {
        mainWindow.webContents.executeJavaScript(`
          window.showStatus('세션이 자동으로 갱신되었습니다: ${alias}', 'success');
        `);
      }
    }
  }

  private notifyRendererError(alias: string): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        window.showStatus('세션 자동 갱신 실패: ${alias}. 수동으로 갱신해주세요.', 'error');
      `);
    }
  }
}
