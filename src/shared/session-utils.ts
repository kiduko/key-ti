// SessionData 인터페이스는 claude-usage.ts에 정의되어 있지만
// 순환 참조를 피하기 위해 여기서는 최소한의 타입만 정의
interface SessionData {
  timestamp: string;
  [key: string]: any; // 나머지 속성들
}

/**
 * 현재 시간과 연결된 세션 체인을 찾습니다.
 * 5시간 미만 간격으로 연결된 세션들의 체인을 반환합니다.
 *
 * @param sessions 전체 세션 배열
 * @param now 현재 시간 (기본값: new Date())
 * @returns 연결된 세션 체인 배열
 */
export function findCurrentSessionChain(sessions: SessionData[], now: Date = new Date()): SessionData[] {
  const currentChainSessions: SessionData[] = [];

  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    const sessionTime = new Date(session.timestamp);

    // 미래 세션은 무시
    if (sessionTime > now) {
      continue;
    }

    if (currentChainSessions.length === 0) {
      // 첫 세션 추가 (현재 시간 이전의 가장 최근 세션)
      currentChainSessions.unshift(session);
    } else {
      // 이전 세션과의 갭 계산
      const nextSession = currentChainSessions[0];
      const nextTime = new Date(nextSession.timestamp);
      const gap = (nextTime.getTime() - sessionTime.getTime()) / (1000 * 60 * 60);

      // 5시간 미만 갭이면 체인에 추가
      if (gap < 5) {
        currentChainSessions.unshift(session);
      } else {
        // 5시간 이상 갭이면 체인 중단
        break;
      }
    }
  }

  return currentChainSessions;
}

/**
 * 다음 주간 리셋 시간을 계산합니다.
 * 매주 월요일 UTC 06:00 (한국 시간 오후 3시)
 *
 * @param now 현재 시간 (기본값: new Date())
 * @returns 다음 리셋 시간
 */
export function calculateNextWeeklyReset(now: Date = new Date()): Date {
  const nextMonday = new Date(now);

  const currentDay = now.getUTCDay();
  const currentHour = now.getUTCHours();

  let daysUntilMonday: number;
  if (currentDay === 1 && currentHour < 6) {
    // 월요일이지만 아직 06:00 전이면 오늘
    daysUntilMonday = 0;
  } else if (currentDay === 0) {
    // 일요일이면 1일 후
    daysUntilMonday = 1;
  } else if (currentDay === 1) {
    // 월요일 06:00 이후면 다음 주 월요일
    daysUntilMonday = 7;
  } else {
    // 화~토요일
    daysUntilMonday = (8 - currentDay) % 7;
  }

  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(6, 0, 0, 0);

  return nextMonday;
}

/**
 * 밀리초 차이를 "X시간 X분 후" 형식으로 포맷팅합니다.
 *
 * @param diffMs 밀리초 단위 시간 차이
 * @returns 포맷된 문자열 (예: "2시간 30분 후", "만료됨")
 */
export function formatTimeUntilReset(diffMs: number): string {
  if (diffMs <= 0) {
    return '만료됨';
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}시간 ${minutes}분 후`;
}

/**
 * 긴 시간 차이를 "X일 X시간 후" 또는 "X시간 X분 후" 형식으로 포맷팅합니다.
 *
 * @param diffMs 밀리초 단위 시간 차이
 * @returns 포맷된 문자열
 */
export function formatLongDuration(diffMs: number): string {
  if (diffMs <= 0) {
    return '0분 후';
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}일 ${hours}시간 후`;
  }
  if (hours > 0) {
    return `${hours}시간 ${minutes}분 후`;
  }
  return `${minutes}분 후`;
}

/**
 * 시간 텍스트를 축약 형식으로 변환합니다.
 * 예: "2시간 30분 후" → "2h30m"
 *
 * @param timeText 포맷된 시간 텍스트
 * @returns 축약된 문자열
 */
export function formatTimeUntilResetAbbrev(timeText: string): string {
  return timeText
    .replace('시간', 'h')
    .replace('분 후', 'm')
    .replace(' ', '');
}
