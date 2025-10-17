import { STSClient, AssumeRoleWithSAMLCommand } from '@aws-sdk/client-sts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { AWSCredentials } from './types';

export class AWSSessionManager {
  private stsClient: STSClient;

  constructor() {
    this.stsClient = new STSClient({ region: 'us-east-1' });
  }

  async assumeRoleWithSAML(
    roleArn: string,
    principalArn: string,
    samlAssertion: string,
    sessionDuration: number = 3600
  ): Promise<AWSCredentials> {
    const command = new AssumeRoleWithSAMLCommand({
      RoleArn: roleArn,
      PrincipalArn: principalArn,
      SAMLAssertion: samlAssertion,
      DurationSeconds: sessionDuration
    });

    const response = await this.stsClient.send(command);

    if (!response.Credentials) {
      throw new Error('Failed to get credentials from STS');
    }

    return {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken!,
      expiration: response.Credentials.Expiration!
    };
  }

  async saveCredentialsToAWSConfig(
    profileName: string,
    credentials: AWSCredentials
  ): Promise<void> {
    const awsDir = path.join(os.homedir(), '.aws');
    const credentialsFile = path.join(awsDir, 'credentials');

    // .aws 디렉토리가 없으면 생성
    if (!fs.existsSync(awsDir)) {
      fs.mkdirSync(awsDir, { recursive: true });
    }

    // 기존 credentials 파일 읽기
    let credentialsContent = '';
    if (fs.existsSync(credentialsFile)) {
      credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
    } else {
      // 새로 파일을 만들 때 Key-ti 마커 추가
      credentialsContent = '# Managed by Key-ti\n\n';
    }

    // 파일에 Key-ti 마커가 없으면 추가
    if (!credentialsContent.includes('# Managed by Key-ti')) {
      credentialsContent = '# Managed by Key-ti\n\n' + credentialsContent;
    }

    // 프로필 섹션 업데이트 또는 추가
    const profileSection = `[${profileName}]`;
    const newProfileContent = `${profileSection}
aws_access_key_id = ${credentials.accessKeyId}
aws_secret_access_key = ${credentials.secretAccessKey}
aws_session_token = ${credentials.sessionToken}
# Expires at: ${credentials.expiration.toISOString()}
`;

    // 기존 프로필이 있는지 확인
    const profileRegex = new RegExp(
      `\\[${profileName}\\][\\s\\S]*?(?=\\n\\[|$)`,
      'g'
    );

    if (profileRegex.test(credentialsContent)) {
      // 기존 프로필 업데이트
      credentialsContent = credentialsContent.replace(
        profileRegex,
        newProfileContent.trim()
      );
    } else {
      // 새 프로필 추가
      if (credentialsContent && !credentialsContent.endsWith('\n\n')) {
        credentialsContent += '\n\n';
      }
      credentialsContent += newProfileContent;
    }

    // 파일에 저장
    fs.writeFileSync(credentialsFile, credentialsContent);
  }

  async exportCredentialsAsEnv(credentials: AWSCredentials): Promise<string> {
    return `export AWS_ACCESS_KEY_ID="${credentials.accessKeyId}"
export AWS_SECRET_ACCESS_KEY="${credentials.secretAccessKey}"
export AWS_SESSION_TOKEN="${credentials.sessionToken}"
# Expires at: ${credentials.expiration.toISOString()}`;
  }

  // AWS credentials 파일에서 프로필이 존재하는지 확인
  checkProfileExists(profileName: string): boolean {
    const awsDir = path.join(os.homedir(), '.aws');
    const credentialsFile = path.join(awsDir, 'credentials');

    if (!fs.existsSync(credentialsFile)) {
      return false;
    }

    const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
    const profileSection = `[${profileName}]`;

    return credentialsContent.includes(profileSection);
  }

  // AWS credentials 파일에서 세션 토큰이 있는지 확인 (임시 세션인지)
  checkSessionTokenExists(profileName: string): boolean {
    const awsDir = path.join(os.homedir(), '.aws');
    const credentialsFile = path.join(awsDir, 'credentials');

    if (!fs.existsSync(credentialsFile)) {
      return false;
    }

    const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
    const profileSection = `[${profileName}]`;
    const profileIndex = credentialsContent.indexOf(profileSection);

    if (profileIndex === -1) {
      return false;
    }

    // 해당 프로필 섹션의 내용만 추출
    const nextProfileIndex = credentialsContent.indexOf('[', profileIndex + 1);
    const profileContent = nextProfileIndex === -1
      ? credentialsContent.substring(profileIndex)
      : credentialsContent.substring(profileIndex, nextProfileIndex);

    return profileContent.includes('aws_session_token');
  }

  // AWS credentials 파일에서 프로필 삭제
  removeCredentialsFromAWSConfig(profileName: string): void {
    const awsDir = path.join(os.homedir(), '.aws');
    const credentialsFile = path.join(awsDir, 'credentials');

    if (!fs.existsSync(credentialsFile)) {
      console.log('AWS credentials file does not exist');
      return;
    }

    let credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
    const profileSection = `[${profileName}]`;
    const profileIndex = credentialsContent.indexOf(profileSection);

    if (profileIndex === -1) {
      console.log(`Profile ${profileName} not found in credentials file`);
      return;
    }

    // 해당 프로필 섹션의 시작과 끝 찾기
    const nextProfileIndex = credentialsContent.indexOf('\n[', profileIndex + 1);

    if (nextProfileIndex === -1) {
      // 마지막 프로필인 경우
      credentialsContent = credentialsContent.substring(0, profileIndex).trim();
    } else {
      // 중간 프로필인 경우
      credentialsContent =
        credentialsContent.substring(0, profileIndex) +
        credentialsContent.substring(nextProfileIndex + 1);
    }

    // 파일에 저장
    fs.writeFileSync(credentialsFile, credentialsContent.trim() + '\n');
    console.log(`Removed profile ${profileName} from AWS credentials file`);
  }

  // AWS credentials 파일에서 프로필 정보 읽기
  getCredentialsFromFile(profileName: string): { accessKeyId: string; secretAccessKey: string; sessionToken: string } | null {
    const awsDir = path.join(os.homedir(), '.aws');
    const credentialsFile = path.join(awsDir, 'credentials');

    if (!fs.existsSync(credentialsFile)) {
      return null;
    }

    const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
    const profileSection = `[${profileName}]`;
    const profileIndex = credentialsContent.indexOf(profileSection);

    if (profileIndex === -1) {
      return null;
    }

    // 해당 프로필 섹션의 내용만 추출
    const nextProfileIndex = credentialsContent.indexOf('\n[', profileIndex + 1);
    const profileContent = nextProfileIndex === -1
      ? credentialsContent.substring(profileIndex)
      : credentialsContent.substring(profileIndex, nextProfileIndex);

    // credentials 파싱
    const accessKeyMatch = profileContent.match(/aws_access_key_id\s*=\s*(.+)/);
    const secretKeyMatch = profileContent.match(/aws_secret_access_key\s*=\s*(.+)/);
    const sessionTokenMatch = profileContent.match(/aws_session_token\s*=\s*(.+)/);

    if (!accessKeyMatch || !secretKeyMatch || !sessionTokenMatch) {
      return null;
    }

    return {
      accessKeyId: accessKeyMatch[1].trim(),
      secretAccessKey: secretKeyMatch[1].trim(),
      sessionToken: sessionTokenMatch[1].trim()
    };
  }

  // 앱 시작 시 기존 AWS credentials 확인 및 백업
  checkAndBackupExistingCredentials(): { hasExisting: boolean; backupPath?: string } {
    const awsDir = path.join(os.homedir(), '.aws');
    const credentialsFile = path.join(awsDir, 'credentials');

    // credentials 파일이 없으면 스킵
    if (!fs.existsSync(credentialsFile)) {
      return { hasExisting: false };
    }

    const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');

    // 빈 파일이면 스킵
    if (credentialsContent.trim().length === 0) {
      return { hasExisting: false };
    }

    // Key-ti 마커가 있으면 Key-ti가 관리하는 파일이므로 백업 불필요
    if (credentialsContent.includes('# Managed by Key-ti')) {
      return { hasExisting: false };
    }

    // 백업 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(awsDir, `credentials.backup-keyti-${timestamp}`);

    fs.writeFileSync(backupPath, credentialsContent);

    return {
      hasExisting: true,
      backupPath
    };
  }

  // AWS 콘솔 로그인 URL 생성
  async generateConsoleUrl(profileName: string): Promise<string> {
    const credentials = this.getCredentialsFromFile(profileName);

    if (!credentials) {
      throw new Error('Credentials not found in ~/.aws/credentials');
    }

    // 세션 정보를 JSON으로 인코딩
    const sessionJson = JSON.stringify({
      sessionId: credentials.accessKeyId,
      sessionKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken
    });

    // AWS federation endpoint로 임시 로그인 토큰 요청
    const getSigninTokenUrl =
      `https://signin.aws.amazon.com/federation?Action=getSigninToken&SessionDuration=43200&Session=${encodeURIComponent(sessionJson)}`;

    return new Promise((resolve, reject) => {
      https.get(getSigninTokenUrl, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const signinToken = response.SigninToken;

            // 콘솔 로그인 URL 생성
            const consoleUrl =
              `https://signin.aws.amazon.com/federation?Action=login&Issuer=aws-session-manager&Destination=${encodeURIComponent('https://console.aws.amazon.com/')}&SigninToken=${signinToken}`;

            resolve(consoleUrl);
          } catch (error) {
            reject(new Error('Failed to parse signin token response'));
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }
}
