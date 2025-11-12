export interface AWSProfile {
  alias: string;
  profileName: string;
  roleArn: string;
  samlUrl: string;
  idp: string;
  lastRefresh?: string;
  expiration?: string;
  isActive?: boolean;
  otpAccountId?: string;
}

export interface OTPAccount {
  id: string;
  name: string;
  issuer?: string;
  secret: string;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  digits?: number;
  period?: number;
}

export interface MemoFile {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Link {
  name: string;
  url: string;
}

export interface BackupSettings {
  type: 'none' | 'local';
  localPath: string;
  autoBackup: boolean;
}

export interface AutoRefreshSettings {
  enabled: boolean;
  timing: number;
  silent: boolean;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getProfiles: () => Promise<AWSProfile[]>;
  addProfile: (profile: AWSProfile) => Promise<void>;
  updateProfile: (alias: string, profile: AWSProfile) => Promise<void>;
  deleteProfile: (alias: string) => Promise<void>;
  activateProfile: (alias: string) => Promise<{ success: boolean; message: string }>;
  deactivateProfile: (alias: string) => Promise<{ success: boolean; message: string }>;
  getActiveProfile: () => Promise<string | undefined>;
  validateSessions: () => Promise<{ success: boolean }>;
  openConsole: (alias: string) => Promise<{ success: boolean; message: string }>;
  openUrl: (url: string) => Promise<void>;
  getBackupPath: () => Promise<string>;
  testBackupPath: () => Promise<{ success: boolean; message?: string }>;
  saveBackup: (data: any) => Promise<{ success: boolean; filename?: string; message?: string }>;
  listBackups: () => Promise<{ success: boolean; backups: any[] }>;
  loadBackup: (filename: string) => Promise<{ success: boolean; data?: any; message?: string }>;
  getAutoBackupSettings: () => Promise<{ enabled: boolean; type: string }>;
  getAutoRefreshSettings: () => Promise<AutoRefreshSettings>;
  setAutoRefreshSettings: (settings: AutoRefreshSettings) => Promise<{ success: boolean }>;
  onUpdateAvailable: (callback: (version: string) => void) => void;
  getOTPAccounts: () => Promise<OTPAccount[]>;
  addOTPAccount: (account: OTPAccount) => Promise<{ success: boolean }>;
  updateOTPAccount: (id: string, account: OTPAccount) => Promise<{ success: boolean }>;
  deleteOTPAccount: (id: string) => Promise<{ success: boolean }>;
  generateOTPCode: (account: OTPAccount) => Promise<{ success: boolean; token?: string; timeRemaining?: number; error?: string }>;
  showOTPWindow: (account: OTPAccount) => Promise<{ success: boolean }>;
  closeOTPWindow: () => Promise<{ success: boolean }>;
  exportToText: () => Promise<string>;
  importFromText: (text: string) => Promise<{ success: boolean; message: string; count: number }>;
  getClaudeUsageStats: () => Promise<{
    sessions: Array<{
      timestamp: string;
      modelId: string;
      usage: {
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
      };
      cost: number;
      totalTokens: number;
    }>;
    dailyUsages: Array<{
      date: string;
      modelId: string;
      sessions: any[];
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCacheCreationTokens: number;
      totalCacheReadTokens: number;
      totalTokens: number;
      totalCost: number;
    }>;
    monthlyUsages: Array<{
      month: string;
      modelId: string;
      dailyUsages: any[];
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCacheCreationTokens: number;
      totalCacheReadTokens: number;
      totalTokens: number;
      totalCost: number;
    }>;
    modelUsages: Array<{
      modelId: string;
      sessionCount: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCacheCreationTokens: number;
      totalCacheReadTokens: number;
      totalTokens: number;
      totalCost: number;
    }>;
    totalSessions: number;
  }>;
  getClaudeSessionBlocks: (date: string) => Promise<Array<{
    date: string;
    blockStart: number;
    blockLabel: string;
    sessions: any[];
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheCreationTokens: number;
    totalCacheReadTokens: number;
    totalTokens: number;
    totalCost: number;
    chainLength: number;
    firstSessionTime: string;
  }>>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
