// 공통 타입 정의 (Main, Renderer, Preload에서 모두 사용)

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

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

export interface AutoRefreshSettings {
  enabled: boolean;
  timing: number;
  silent: boolean;
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

export interface ConfigData {
  profiles: AWSProfile[];
  activeProfiles?: string[];
  autoRefresh?: AutoRefreshSettings;
  otpAccounts?: OTPAccount[];
  showClaudeUsageInTitle?: boolean;
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
