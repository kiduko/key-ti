// 공통 유틸리티 함수
import { app } from 'electron';
import * as path from 'path';
import * as os from 'os';

/**
 * 아이콘 경로를 환경에 맞게 반환
 */
export function getIconPath(filename: string = 'key-logo.png'): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename);
  } else {
    // 개발 환경에서는 프로젝트 루트의 build 디렉토리 사용
    return path.join(process.cwd(), 'build', filename);
  }
}

/**
 * 백업 디렉토리 경로 반환 (없으면 생성)
 */
export function getBackupDir(): string {
  const homeDir = os.homedir();
  const backupDir = path.join(homeDir, '.key-ti');
  return backupDir;
}

/**
 * 시간 계산 및 포맷팅
 */
export function calculateTimeRemaining(expirationStr: string): {
  seconds: number;
  text: string;
  className: string;
} {
  const expiration = new Date(expirationStr);
  const now = new Date();
  const timeRemainingSeconds = Math.floor((expiration.getTime() - now.getTime()) / 1000);

  if (timeRemainingSeconds <= 0) {
    return {
      seconds: 0,
      text: '만료됨',
      className: 'time-expired'
    };
  }

  const hours = Math.floor(timeRemainingSeconds / 3600);
  const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
  const seconds = timeRemainingSeconds % 60;

  let className = 'time-normal';
  if (timeRemainingSeconds < 300) {
    className = 'time-critical';
  } else if (timeRemainingSeconds < 3600) {
    className = 'time-warning';
  }

  return {
    seconds: timeRemainingSeconds,
    text: `${hours}시간 ${minutes}분 ${seconds}초`,
    className
  };
}
