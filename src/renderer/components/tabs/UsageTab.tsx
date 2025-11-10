import React, { useState, useEffect } from 'react';
import PageHeader from '../common/PageHeader.js';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

interface SessionData {
  timestamp: string;
  modelId: string;
  usage: TokenUsage;
  cost: number;
  totalTokens: number;
}

interface DailyUsage {
  date: string;
  modelId: string;
  sessions: SessionData[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}

interface MonthlyUsage {
  month: string;
  modelId: string;
  dailyUsages: DailyUsage[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}

interface ModelUsage {
  modelId: string;
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}

interface UsageStats {
  sessions: SessionData[];
  dailyUsages: DailyUsage[];
  monthlyUsages: MonthlyUsage[];
  modelUsages: ModelUsage[];
  totalSessions: number;
}

type ViewMode = 'daily' | 'monthly';

const UsageTab: React.FC = () => {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [nextResetTime, setNextResetTime] = useState<Date | null>(null);
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');
  const [nextWeeklyReset, setNextWeeklyReset] = useState<Date | null>(null);
  const [timeUntilWeeklyReset, setTimeUntilWeeklyReset] = useState<string>('');
  const [sessionUsagePercent, setSessionUsagePercent] = useState<number>(0);
  const [weeklyUsagePercent, setWeeklyUsagePercent] = useState<number>(0);

  useEffect(() => {
    loadUsageStats();
    calculateNextReset();
    calculateNextWeeklyReset();

    // 1분마다 리셋 타이머 업데이트
    const timer = setInterval(() => {
      updateTimeUntilReset();
      updateTimeUntilWeeklyReset();
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // stats가 변경되면 퍼센트 계산
    if (stats && nextResetTime && nextWeeklyReset) {
      const now = new Date();
      const sessionStart = new Date(nextResetTime.getTime() - 5 * 60 * 60 * 1000);

      const currentSessionSessions = stats.sessions
        .filter(s => {
          const sessionTime = new Date(s.timestamp);
          return sessionTime >= sessionStart && sessionTime <= now;
        });

      const currentSessionTokens = currentSessionSessions.reduce((sum, s) => sum + s.totalTokens, 0);

      const weekStart = new Date(nextWeeklyReset.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weeklySessions = stats.sessions
        .filter(s => {
          const sessionTime = new Date(s.timestamp);
          return sessionTime >= weekStart && sessionTime <= now;
        });

      const weeklyTokens = weeklySessions.reduce((sum, s) => sum + s.totalTokens, 0);

      console.log('=== Token Usage Debug ===');
      console.log('Current session sessions count:', currentSessionSessions.length);
      console.log('Current session tokens:', currentSessionTokens);
      console.log('Weekly sessions count:', weeklySessions.length);
      console.log('Weekly tokens:', weeklyTokens);

      // 개별 세션 토큰 값들 확인 (88,000의 40%인 35,200 근처 값 찾기)
      console.log('Current session individual tokens:');
      currentSessionSessions.forEach((s, i) => {
        console.log(`  Session ${i+1}: ${s.totalTokens} (input: ${s.usage.inputTokens}, output: ${s.usage.outputTokens})`);
      });

      // 세션당 평균 토큰
      const avgTokensPerSession = currentSessionSessions.length > 0
        ? currentSessionTokens / currentSessionSessions.length
        : 0;
      console.log('Average tokens per session:', avgTokensPerSession);

      // 88,000 토큰 단위로 계산 (Claude의 세션당 기준)
      const TOKEN_UNIT = 88_000;

      // 현재 사용량을 88k 단위로 변환
      const sessionUnits = currentSessionTokens / TOKEN_UNIT;
      const weeklyUnits = weeklyTokens / TOKEN_UNIT;

      console.log('Session units (88k):', sessionUnits.toFixed(1));
      console.log('Weekly units (88k):', weeklyUnits.toFixed(1));

      // 88k 단위 기준 리미트 (현재 사용량의 percentage에서 역산)
      // 세션: 159.9 units = 37% → 100% = 432.2 units
      // 주간: 543.5 units = 9% → 100% = 6038.9 units
      const SESSION_LIMIT_UNITS = 432.2;
      const WEEKLY_LIMIT_UNITS = 6038.9;

      const sessionPercent = Math.min(100, Math.round((sessionUnits / SESSION_LIMIT_UNITS) * 100));
      const weeklyPercent = Math.min(100, Math.round((weeklyUnits / WEEKLY_LIMIT_UNITS) * 100));

      console.log('SESSION_LIMIT:', (SESSION_LIMIT_UNITS * TOKEN_UNIT).toLocaleString(), '(', SESSION_LIMIT_UNITS, 'units )');
      console.log('WEEKLY_LIMIT:', (WEEKLY_LIMIT_UNITS * TOKEN_UNIT).toLocaleString(), '(', WEEKLY_LIMIT_UNITS, 'units )');
      console.log('Session percent:', sessionPercent);
      console.log('Weekly percent:', weeklyPercent);

      setSessionUsagePercent(sessionPercent);
      setWeeklyUsagePercent(weeklyPercent);
    }
  }, [stats, nextResetTime, nextWeeklyReset]);

  useEffect(() => {
    if (nextResetTime) {
      updateTimeUntilReset();
    }
  }, [nextResetTime]);

  useEffect(() => {
    if (nextWeeklyReset) {
      updateTimeUntilWeeklyReset();
    }
  }, [nextWeeklyReset]);

  const loadUsageStats = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getClaudeUsageStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDateExpanded = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const toggleMonthExpanded = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  };

  const calculateNextReset = () => {
    const now = new Date();
    const currentHourUTC = now.getUTCHours();

    // 5시간 주기: 00:00, 05:00, 10:00, 15:00, 20:00 (UTC 기준)
    const resetHours = [0, 5, 10, 15, 20];

    // 다음 리셋 시간 찾기
    let nextReset = new Date(now);
    let foundNextReset = false;

    for (const hour of resetHours) {
      if (currentHourUTC < hour) {
        nextReset.setUTCHours(hour, 0, 0, 0);
        foundNextReset = true;
        break;
      }
    }

    // 오늘 중에 다음 리셋이 없으면 내일 00:00 UTC
    if (!foundNextReset) {
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
      nextReset.setUTCHours(0, 0, 0, 0);
    }

    setNextResetTime(nextReset);
  };

  const calculateNextWeeklyReset = () => {
    const now = new Date();

    // 다음 월요일 UTC 06:00 (한국 시간 오후 3시) 찾기
    let nextMonday = new Date(now);

    // 현재 요일 (0=일요일, 1=월요일, ...)
    const currentDay = now.getUTCDay();
    const currentHour = now.getUTCHours();

    // 월요일까지 남은 일수 계산
    let daysUntilMonday;
    if (currentDay === 1 && currentHour < 6) {
      // 월요일이고 아직 06:00 UTC 전이면 오늘
      daysUntilMonday = 0;
    } else if (currentDay === 0) {
      // 일요일이면 내일
      daysUntilMonday = 1;
    } else if (currentDay === 1) {
      // 월요일이고 이미 06:00 UTC 지났으면 다음주
      daysUntilMonday = 7;
    } else {
      // 다음 월요일까지 남은 일수 (화요일=6일, 수요일=5일, ...)
      daysUntilMonday = (8 - currentDay) % 7;
    }

    nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(6, 0, 0, 0);

    setNextWeeklyReset(nextMonday);
  };

  const updateTimeUntilReset = () => {
    if (!nextResetTime) {
      calculateNextReset();
      return;
    }

    const now = new Date();
    const diff = nextResetTime.getTime() - now.getTime();

    if (diff <= 0) {
      // 리셋 시간이 지났으면 다시 계산
      calculateNextReset();
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    setTimeUntilReset(`${hours}시간 ${minutes}분 후`);
  };

  const updateTimeUntilWeeklyReset = () => {
    if (!nextWeeklyReset) {
      calculateNextWeeklyReset();
      return;
    }

    const now = new Date();
    const diff = nextWeeklyReset.getTime() - now.getTime();

    if (diff <= 0) {
      // 리셋 시간이 지났으면 다시 계산
      calculateNextWeeklyReset();
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      setTimeUntilWeeklyReset(`${days}일 ${hours}시간 후`);
    } else if (hours > 0) {
      setTimeUntilWeeklyReset(`${hours}시간 ${minutes}분 후`);
    } else {
      setTimeUntilWeeklyReset(`${minutes}분 후`);
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(3)}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatMonth = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    return `${year}년 ${month}월`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className="tab-content active">
        <PageHeader title="Claude 사용량 분석" />
        <div className="loading-message">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <div className="tab-content active">
        <PageHeader title="Claude 사용량 분석" />
        <div className="empty-state">
          <p>Claude Code 사용 데이터가 없습니다.</p>
          <p className="hint">~/.claude/projects/ 경로에 세션 데이터가 저장됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content active">
      <PageHeader title="Claude 사용량 분석" />

      <div className="usage-controls">
        <button
          className={`view-mode-btn ${viewMode === 'daily' ? 'active' : ''}`}
          onClick={() => setViewMode('daily')}
        >
          일별 통계
        </button>
        <button
          className={`view-mode-btn ${viewMode === 'monthly' ? 'active' : ''}`}
          onClick={() => setViewMode('monthly')}
        >
          월별 통계
        </button>
        <div className="reset-timers">
          {nextResetTime && timeUntilReset && (
            <div className="reset-timer">
              <span className="reset-label">세션 리셋:</span>
              <span className="reset-time">{nextResetTime.toLocaleString('ko-KR', {
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
              <span className="reset-countdown">({timeUntilReset})</span>
            </div>
          )}
          {nextWeeklyReset && timeUntilWeeklyReset && (
            <div className="reset-timer">
              <span className="reset-label">주간 리셋:</span>
              <span className="reset-time">{nextWeeklyReset.toLocaleString('ko-KR', {
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
              <span className="reset-countdown">({timeUntilWeeklyReset})</span>
            </div>
          )}
        </div>
        <button className="refresh-btn" onClick={loadUsageStats}>
          새로고침
        </button>
      </div>

      {viewMode === 'daily' && (
        <div className="usage-table-container">
          <table className="usage-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>모델</th>
                <th>세션 수</th>
                <th>입력 토큰</th>
                <th>출력 토큰</th>
                <th>캐시 생성</th>
                <th>캐시 읽기</th>
                <th>총 토큰</th>
                <th>비용</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const dailyGroups = new Map<string, DailyUsage[]>();
                stats.dailyUsages.forEach(daily => {
                  if (!dailyGroups.has(daily.date)) {
                    dailyGroups.set(daily.date, []);
                  }
                  dailyGroups.get(daily.date)!.push(daily);
                });

                const rows: JSX.Element[] = [];
                Array.from(dailyGroups.entries()).forEach(([date, dailies]) => {
                  // 날짜별 합계 계산
                  const dateTotal = dailies.reduce((acc, d) => ({
                    sessions: acc.sessions + d.sessions.length,
                    inputTokens: acc.inputTokens + d.totalInputTokens,
                    outputTokens: acc.outputTokens + d.totalOutputTokens,
                    cacheCreation: acc.cacheCreation + d.totalCacheCreationTokens,
                    cacheRead: acc.cacheRead + d.totalCacheReadTokens,
                    totalTokens: acc.totalTokens + d.totalTokens,
                    cost: acc.cost + d.totalCost,
                  }), { sessions: 0, inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0, totalTokens: 0, cost: 0 });

                  const isExpanded = expandedDates.has(date);

                  // 날짜별 합계 행 (클릭 가능)
                  rows.push(
                    <tr
                      key={`${date}-total`}
                      className="date-total-row clickable"
                      onClick={() => toggleDateExpanded(date)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td colSpan={2}>
                        <strong>
                          {isExpanded ? '▼ ' : '▶ '}
                          {formatDate(date)}
                        </strong>
                      </td>
                      <td>{dateTotal.sessions}</td>
                      <td>{formatNumber(dateTotal.inputTokens)}</td>
                      <td>{formatNumber(dateTotal.outputTokens)}</td>
                      <td>{formatNumber(dateTotal.cacheCreation)}</td>
                      <td>{formatNumber(dateTotal.cacheRead)}</td>
                      <td>{formatNumber(dateTotal.totalTokens)}</td>
                      <td style={{ textAlign: 'right' }}><strong>{formatCost(dateTotal.cost)}</strong></td>
                    </tr>
                  );

                  // 확장된 경우에만 모델별 상세 데이터 표시
                  if (isExpanded) {
                    dailies.forEach((daily, idx) => {
                      rows.push(
                        <tr key={`${daily.date}-${daily.modelId}-${idx}`} className="model-detail-row">
                          <td></td>
                          <td className="model-id">{daily.modelId}</td>
                          <td>{daily.sessions.length}</td>
                          <td>{formatNumber(daily.totalInputTokens)}</td>
                          <td>{formatNumber(daily.totalOutputTokens)}</td>
                          <td>{formatNumber(daily.totalCacheCreationTokens)}</td>
                          <td>{formatNumber(daily.totalCacheReadTokens)}</td>
                          <td>{formatNumber(daily.totalTokens)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCost(daily.totalCost)}</td>
                        </tr>
                      );
                    });
                  }
                });

                return rows;
              })()}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><strong>전체 합계</strong></td>
                <td>{stats.totalSessions}</td>
                <td>
                  {formatNumber(
                    stats.dailyUsages.reduce((sum, d) => sum + d.totalInputTokens, 0)
                  )}
                </td>
                <td>
                  {formatNumber(
                    stats.dailyUsages.reduce((sum, d) => sum + d.totalOutputTokens, 0)
                  )}
                </td>
                <td>
                  {formatNumber(
                    stats.dailyUsages.reduce((sum, d) => sum + d.totalCacheCreationTokens, 0)
                  )}
                </td>
                <td>
                  {formatNumber(
                    stats.dailyUsages.reduce((sum, d) => sum + d.totalCacheReadTokens, 0)
                  )}
                </td>
                <td>
                  {formatNumber(
                    stats.dailyUsages.reduce((sum, d) => sum + d.totalTokens, 0)
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>
                    {formatCost(
                      stats.dailyUsages.reduce((sum, d) => sum + d.totalCost, 0)
                    )}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {viewMode === 'monthly' && (
        <div className="usage-table-container">
          <table className="usage-table">
            <thead>
              <tr>
                <th>월</th>
                <th>모델</th>
                <th>일 수</th>
                <th>입력 토큰</th>
                <th>출력 토큰</th>
                <th>캐시 생성</th>
                <th>캐시 읽기</th>
                <th>총 토큰</th>
                <th>비용</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const monthlyGroups = new Map<string, MonthlyUsage[]>();
                stats.monthlyUsages.forEach(monthly => {
                  if (!monthlyGroups.has(monthly.month)) {
                    monthlyGroups.set(monthly.month, []);
                  }
                  monthlyGroups.get(monthly.month)!.push(monthly);
                });

                const rows: JSX.Element[] = [];
                Array.from(monthlyGroups.entries()).forEach(([month, monthlies]) => {
                  // 월별 합계 계산
                  const monthTotal = monthlies.reduce((acc, m) => ({
                    days: acc.days + m.dailyUsages.length,
                    inputTokens: acc.inputTokens + m.totalInputTokens,
                    outputTokens: acc.outputTokens + m.totalOutputTokens,
                    cacheCreation: acc.cacheCreation + m.totalCacheCreationTokens,
                    cacheRead: acc.cacheRead + m.totalCacheReadTokens,
                    totalTokens: acc.totalTokens + m.totalTokens,
                    cost: acc.cost + m.totalCost,
                  }), { days: 0, inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0, totalTokens: 0, cost: 0 });

                  const isExpanded = expandedMonths.has(month);

                  // 월별 합계 행 (클릭 가능)
                  rows.push(
                    <tr
                      key={`${month}-total`}
                      className="date-total-row clickable"
                      onClick={() => toggleMonthExpanded(month)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td colSpan={2}>
                        <strong>
                          {isExpanded ? '▼ ' : '▶ '}
                          {formatMonth(month)}
                        </strong>
                      </td>
                      <td>{monthTotal.days}</td>
                      <td>{formatNumber(monthTotal.inputTokens)}</td>
                      <td>{formatNumber(monthTotal.outputTokens)}</td>
                      <td>{formatNumber(monthTotal.cacheCreation)}</td>
                      <td>{formatNumber(monthTotal.cacheRead)}</td>
                      <td>{formatNumber(monthTotal.totalTokens)}</td>
                      <td style={{ textAlign: 'right' }}><strong>{formatCost(monthTotal.cost)}</strong></td>
                    </tr>
                  );

                  // 확장된 경우에만 모델별 상세 데이터 표시
                  if (isExpanded) {
                    monthlies.forEach((monthly, idx) => {
                      rows.push(
                        <tr key={`${monthly.month}-${monthly.modelId}-${idx}`} className="model-detail-row">
                          <td></td>
                          <td className="model-id">{monthly.modelId}</td>
                          <td>{monthly.dailyUsages.length}</td>
                          <td>{formatNumber(monthly.totalInputTokens)}</td>
                          <td>{formatNumber(monthly.totalOutputTokens)}</td>
                          <td>{formatNumber(monthly.totalCacheCreationTokens)}</td>
                          <td>{formatNumber(monthly.totalCacheReadTokens)}</td>
                          <td>{formatNumber(monthly.totalTokens)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCost(monthly.totalCost)}</td>
                        </tr>
                      );
                    });
                  }
                });

                return rows;
              })()}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><strong>전체 합계</strong></td>
                <td>{stats.dailyUsages.length}</td>
                <td>
                  {formatNumber(
                    stats.monthlyUsages.reduce((sum, m) => sum + m.totalInputTokens, 0)
                  )}
                </td>
                <td>
                  {formatNumber(
                    stats.monthlyUsages.reduce((sum, m) => sum + m.totalOutputTokens, 0)
                  )}
                </td>
                <td>
                  {formatNumber(
                    stats.monthlyUsages.reduce((sum, m) => sum + m.totalCacheCreationTokens, 0)
                  )}
                </td>
                <td>
                  {formatNumber(
                    stats.monthlyUsages.reduce((sum, m) => sum + m.totalCacheReadTokens, 0)
                  )}
                </td>
                <td>
                  {formatNumber(
                    stats.monthlyUsages.reduce((sum, m) => sum + m.totalTokens, 0)
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>
                    {formatCost(
                      stats.monthlyUsages.reduce((sum, m) => sum + m.totalCost, 0)
                    )}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsageTab;
