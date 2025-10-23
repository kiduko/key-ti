export interface AWSProfile {
  alias: string;
  profileName: string;
  roleArn: string;
  samlUrl: string;
  idp: string;
  lastRefresh?: string;
  expiration?: string;
  isActive?: boolean; // 세션이 활성화되어 있는지
  otpAccountId?: string; // 연결된 OTP 계정 ID
}

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

export interface AutoRefreshSettings {
  enabled: boolean; // 자동 갱신 on/off
  timing: number; // 만료 몇 분 전에 갱신할지 (기본값: 13)
  silent: boolean; // 자동 갱신 시 알림 표시 안함
}

export interface OTPAccount {
  id: string; // 고유 ID
  name: string; // 계정 이름 (예: "Google", "GitHub")
  issuer?: string; // 발급자 (예: "Google", "GitHub")
  secret: string; // Base32 인코딩된 secret key
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512'; // 기본값: SHA1
  digits?: number; // OTP 자릿수, 기본값: 6
  period?: number; // 갱신 주기(초), 기본값: 30
}

export interface ConfigData {
  profiles: AWSProfile[];
  activeProfiles?: string[]; // 여러 개의 활성 프로필
  autoRefresh?: AutoRefreshSettings; // 자동 갱신 설정
  otpAccounts?: OTPAccount[]; // OTP 계정 목록
}
