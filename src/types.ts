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

export interface ConfigData {
  profiles: AWSProfile[];
  activeProfiles?: string[]; // 여러 개의 활성 프로필
}
