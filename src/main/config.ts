import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ConfigData, AWSProfile, AutoRefreshSettings, OTPAccount } from '../shared/types';

export class ConfigManager {
  private config: ConfigData;
  private configFile: string;

  constructor() {
    this.configFile = path.join(app.getPath('userData'), 'config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): ConfigData {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf-8');
        // 빈 파일이나 손상된 JSON 처리
        if (data.trim().length === 0) {
          console.log('Config file is empty, creating new config');
          return { profiles: [] };
        }
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // 손상된 파일 백업 후 삭제
      if (fs.existsSync(this.configFile)) {
        const backupFile = this.configFile + '.backup';
        fs.copyFileSync(this.configFile, backupFile);
        fs.unlinkSync(this.configFile);
        console.log('Corrupted config backed up to:', backupFile);
      }
    }
    return { profiles: [] };
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  getProfiles(): AWSProfile[] {
    return this.config.profiles;
  }

  addProfile(profile: AWSProfile): void {
    console.log('ConfigManager: Adding profile', profile);
    console.log('ConfigManager: Current profiles before add', this.config.profiles);
    this.config.profiles.push(profile);
    console.log('ConfigManager: Current profiles after add', this.config.profiles);
    this.saveConfig();
    console.log('ConfigManager: Config saved to', this.configFile);
  }

  updateProfile(alias: string, profile: AWSProfile): void {
    const index = this.config.profiles.findIndex(p => p.alias === alias);
    if (index !== -1) {
      this.config.profiles[index] = profile;
      this.saveConfig();
    }
  }

  deleteProfile(alias: string): void {
    this.config.profiles = this.config.profiles.filter(p => p.alias !== alias);
    this.saveConfig();
  }

  setActiveProfile(alias: string): void {
    if (!this.config.activeProfiles) {
      this.config.activeProfiles = [];
    }
    if (!this.config.activeProfiles.includes(alias)) {
      this.config.activeProfiles.push(alias);
    }

    // 프로필의 isActive 플래그 설정
    const profile = this.config.profiles.find(p => p.alias === alias);
    if (profile) {
      profile.isActive = true;
    }

    this.saveConfig();
  }

  removeActiveProfile(alias: string): void {
    if (this.config.activeProfiles) {
      this.config.activeProfiles = this.config.activeProfiles.filter(a => a !== alias);
    }

    // 프로필의 isActive 플래그 해제
    const profile = this.config.profiles.find(p => p.alias === alias);
    if (profile) {
      profile.isActive = false;
      profile.lastRefresh = undefined;
      profile.expiration = undefined;
    }

    this.saveConfig();
  }

  getActiveProfiles(): string[] {
    return this.config.activeProfiles || [];
  }

  // 호환성을 위한 레거시 메서드
  getActiveProfile(): string | undefined {
    const actives = this.getActiveProfiles();
    return actives.length > 0 ? actives[0] : undefined;
  }

  // 자동 갱신 설정 관리
  getAutoRefreshSettings(): AutoRefreshSettings {
    return this.config.autoRefresh || {
      enabled: true,
      timing: 13,
      silent: true
    };
  }

  setAutoRefreshSettings(settings: AutoRefreshSettings): void {
    this.config.autoRefresh = settings;
    this.saveConfig();
  }

  // OTP 계정 관리
  getOTPAccounts(): OTPAccount[] {
    return this.config.otpAccounts || [];
  }

  addOTPAccount(account: OTPAccount): void {
    if (!this.config.otpAccounts) {
      this.config.otpAccounts = [];
    }
    this.config.otpAccounts.push(account);
    this.saveConfig();
  }

  updateOTPAccount(id: string, account: OTPAccount): void {
    if (!this.config.otpAccounts) return;
    const index = this.config.otpAccounts.findIndex(a => a.id === id);
    if (index !== -1) {
      this.config.otpAccounts[index] = account;
      this.saveConfig();
    }
  }

  deleteOTPAccount(id: string): void {
    if (!this.config.otpAccounts) return;
    this.config.otpAccounts = this.config.otpAccounts.filter(a => a.id !== id);
    this.saveConfig();
  }

  // 텍스트로 Export (OTP 제외)
  exportToText(): string {
    const profiles = this.config.profiles.map(profile => {
      const { otpAccountId, isActive, lastRefresh, expiration, ...rest } = profile;
      return rest;
    });
    return JSON.stringify(profiles, null, 2);
  }

  // 텍스트에서 Import
  importFromText(text: string): { success: boolean; message: string; count: number } {
    try {
      const profiles = JSON.parse(text) as AWSProfile[];

      // 유효성 검증
      if (!Array.isArray(profiles)) {
        return { success: false, message: '올바른 프로필 배열이 아닙니다', count: 0 };
      }

      for (const profile of profiles) {
        if (!profile.alias || !profile.profileName || !profile.roleArn || !profile.samlUrl || !profile.idp) {
          return { success: false, message: '필수 필드가 누락된 프로필이 있습니다', count: 0 };
        }
      }

      // 기존 프로필에 추가 (중복 체크)
      let addedCount = 0;
      for (const profile of profiles) {
        const exists = this.config.profiles.some(p => p.alias === profile.alias);
        if (!exists) {
          // isActive, lastRefresh, expiration 초기화
          this.config.profiles.push({
            ...profile,
            isActive: false,
            lastRefresh: undefined,
            expiration: undefined,
            otpAccountId: undefined
          });
          addedCount++;
        }
      }

      this.saveConfig();
      return { success: true, message: `${addedCount}개의 프로필을 불러왔습니다`, count: addedCount };
    } catch (error) {
      console.error('Failed to import from text:', error);
      return { success: false, message: '잘못된 형식입니다', count: 0 };
    }
  }
}
