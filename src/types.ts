export interface AWSProfile {
  alias: string;
  profileName: string;
  roleArn: string;
  samlUrl: string;
  idp: string;
  lastRefresh?: string;
  expiration?: string;
  isActive?: boolean; // 세션이 활성화되어 있는지
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

export interface ConfigData {
  profiles: AWSProfile[];
  activeProfiles?: string[]; // 여러 개의 활성 프로필
  autoRefresh?: AutoRefreshSettings; // 자동 갱신 설정
}
