import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface SessionData {
  timestamp: string;
  modelId: string;
  usage: TokenUsage;
  cost: number;
  totalTokens: number;
}

export interface DailyUsage {
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

export interface MonthlyUsage {
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

export interface ModelUsage {
  modelId: string;
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}

// Claude 모델별 가격 (per 1M tokens, USD)
// Prompt caching: cache writes = base input price * 1.25, cache reads = base input price * 0.1
const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-sonnet-4-5': {
    input: 3.00,
    output: 15.00,
    cacheWrite: 3.75,  // 3.00 * 1.25
    cacheRead: 0.30,   // 3.00 * 0.1
  },
  'claude-sonnet-4': {
    input: 3.00,
    output: 15.00,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  'claude-sonnet-3-5': {
    input: 3.00,
    output: 15.00,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  'claude-opus-4': {
    input: 15.00,
    output: 75.00,
    cacheWrite: 18.75,  // 15.00 * 1.25
    cacheRead: 1.50,    // 15.00 * 0.1
  },
  'claude-haiku-4-5': {
    input: 1.00,
    output: 5.00,
    cacheWrite: 1.25,   // 1.00 * 1.25
    cacheRead: 0.10,    // 1.00 * 0.1
  },
  'claude-haiku-3-5': {
    input: 0.80,
    output: 4.00,
    cacheWrite: 1.00,   // 0.80 * 1.25
    cacheRead: 0.08,    // 0.80 * 0.1
  },
  'claude-haiku-3': {
    input: 0.25,
    output: 1.25,
    cacheWrite: 0.3125, // 0.25 * 1.25
    cacheRead: 0.025,   // 0.25 * 0.1
  },
};

function getClaudeDataPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.claude', 'projects');
}

function getModelPricing(modelId: string) {
  // 모델 ID에서 기본 모델명 추출
  const modelKey = Object.keys(MODEL_PRICING).find(key => modelId.includes(key));
  return modelKey ? MODEL_PRICING[modelKey] : MODEL_PRICING['claude-sonnet-4-5'];
}

/**
 * 모든 토큰 타입의 합계를 계산합니다 (ccusage의 getTotalTokens 참고)
 */
function getTotalTokens(usage: TokenUsage): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheCreationTokens +
    usage.cacheReadTokens
  );
}

/**
 * 세션 배열의 토큰 및 비용 합계를 계산합니다 (ccusage의 calculateTotals 참고)
 */
interface TokenTotals {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}

function calculateTotals(sessions: SessionData[]): TokenTotals {
  return sessions.reduce(
    (acc, session) => ({
      totalInputTokens: acc.totalInputTokens + session.usage.inputTokens,
      totalOutputTokens: acc.totalOutputTokens + session.usage.outputTokens,
      totalCacheCreationTokens: acc.totalCacheCreationTokens + session.usage.cacheCreationTokens,
      totalCacheReadTokens: acc.totalCacheReadTokens + session.usage.cacheReadTokens,
      totalTokens: acc.totalTokens + session.totalTokens,
      totalCost: acc.totalCost + session.cost,
    }),
    {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      totalTokens: 0,
      totalCost: 0,
    }
  );
}

function calculateCost(usage: TokenUsage, modelId: string): number {
  const pricing = getModelPricing(modelId);

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheWriteCost = (usage.cacheCreationTokens / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * pricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

export function parseJSONL(filePath: string, globalSeenHashes: Set<string>): SessionData[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    const sessions: SessionData[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line);

        // Claude Code 세션 데이터 파싱 - assistant 메시지의 usage 필드 확인
        if (data.type === 'assistant' && data.message?.usage) {
          const messageId = data.message.id;
          const requestId = data.requestId;

          // ccusage 방식: messageId:requestId로 유니크 해시 생성
          // ID가 없는 경우에도 포함 (중복 체크만 안함)
          if (messageId && requestId) {
            const uniqueHash = `${messageId}:${requestId}`;

            // 전역 중복 제거 (ID가 있는 경우만)
            if (globalSeenHashes.has(uniqueHash)) {
              continue;
            }

            globalSeenHashes.add(uniqueHash);
          }

          const usageData = data.message.usage;

          // ccusage 방식: 토큰 값을 직접 사용 (누적값 계산 안함)
          const usage: TokenUsage = {
            inputTokens: usageData.input_tokens || 0,
            outputTokens: usageData.output_tokens || 0,
            cacheCreationTokens: usageData.cache_creation_input_tokens || 0,
            cacheReadTokens: usageData.cache_read_input_tokens || 0,
          };

          const modelId = data.message.model || 'claude-sonnet-4-5';
          const cost = calculateCost(usage, modelId);
          const totalTokens = getTotalTokens(usage);

          sessions.push({
            timestamp: data.timestamp || new Date().toISOString(),
            modelId,
            usage,
            cost,
            totalTokens,
          });
        }
      } catch (err) {
        // 개별 라인 파싱 실패는 무시
        console.warn('Failed to parse line:', err);
      }
    }

    return sessions;
  } catch (error) {
    console.error('Error reading JSONL file:', error);
    return [];
  }
}

export function getAllSessions(): SessionData[] {
  const dataPath = getClaudeDataPath();

  if (!fs.existsSync(dataPath)) {
    return [];
  }

  const allSessions: SessionData[] = [];
  const globalSeenHashes = new Set<string>();

  try {
    // 모든 프로젝트 디렉토리를 탐색
    const projectDirs = fs.readdirSync(dataPath);

    for (const projectDir of projectDirs) {
      const projectPath = path.join(dataPath, projectDir);

      // 디렉토리인지 확인
      if (!fs.statSync(projectPath).isDirectory()) {
        continue;
      }

      // 각 프로젝트의 JSONL 파일들을 읽기
      const files = fs.readdirSync(projectPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        const filePath = path.join(projectPath, file);
        const sessions = parseJSONL(filePath, globalSeenHashes);
        allSessions.push(...sessions);
      }
    }

    // 타임스탬프 기준 정렬
    allSessions.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return allSessions;
  } catch (error) {
    console.error('Error reading sessions:', error);
    return [];
  }
}

export function getDailyUsage(sessions: SessionData[]): DailyUsage[] {
  const dailyModelMap = new Map<string, SessionData[]>(); // key: "date|modelId"

  for (const session of sessions) {
    // 로컬 시간대 기준으로 날짜 계산 (ccusage와 동일)
    const d = new Date(session.timestamp);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const key = `${date}|${session.modelId}`;

    if (!dailyModelMap.has(key)) {
      dailyModelMap.set(key, []);
    }
    dailyModelMap.get(key)!.push(session);
  }

  const dailyUsages: DailyUsage[] = [];

  for (const [key, daySessions] of dailyModelMap.entries()) {
    const [date, modelId] = key.split('|');

    const totals = calculateTotals(daySessions);

    dailyUsages.push({
      date,
      modelId,
      sessions: daySessions,
      ...totals,
    });
  }

  return dailyUsages.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return a.modelId.localeCompare(b.modelId);
  });
}

export function getMonthlyUsage(dailyUsages: DailyUsage[]): MonthlyUsage[] {
  const monthlyModelMap = new Map<string, DailyUsage[]>(); // key: "month|modelId"

  for (const daily of dailyUsages) {
    const month = daily.date.substring(0, 7); // YYYY-MM
    const key = `${month}|${daily.modelId}`;

    if (!monthlyModelMap.has(key)) {
      monthlyModelMap.set(key, []);
    }
    monthlyModelMap.get(key)!.push(daily);
  }

  const monthlyUsages: MonthlyUsage[] = [];

  for (const [key, monthDailies] of monthlyModelMap.entries()) {
    const [month, modelId] = key.split('|');

    // DailyUsage 배열을 SessionData 배열로 변환하여 totals 계산
    const allSessions = monthDailies.flatMap(daily => daily.sessions);
    const totals = calculateTotals(allSessions);

    monthlyUsages.push({
      month,
      modelId,
      dailyUsages: monthDailies,
      ...totals,
    });
  }

  return monthlyUsages.sort((a, b) => {
    const monthCompare = b.month.localeCompare(a.month);
    if (monthCompare !== 0) return monthCompare;
    return a.modelId.localeCompare(b.modelId);
  });
}

export function getModelUsage(sessions: SessionData[]): ModelUsage[] {
  const modelMap = new Map<string, SessionData[]>();

  for (const session of sessions) {
    if (!modelMap.has(session.modelId)) {
      modelMap.set(session.modelId, []);
    }
    modelMap.get(session.modelId)!.push(session);
  }

  const modelUsages: ModelUsage[] = [];

  for (const [modelId, modelSessions] of modelMap.entries()) {
    const totals = calculateTotals(modelSessions);

    modelUsages.push({
      modelId,
      sessionCount: modelSessions.length,
      ...totals,
    });
  }

  return modelUsages.sort((a, b) => b.totalCost - a.totalCost);
}

export function getUsageStats() {
  const sessions = getAllSessions();
  const dailyUsages = getDailyUsage(sessions);
  const monthlyUsages = getMonthlyUsage(dailyUsages);
  const modelUsages = getModelUsage(sessions);

  return {
    sessions,
    dailyUsages,
    monthlyUsages,
    modelUsages,
    totalSessions: sessions.length,
  };
}
