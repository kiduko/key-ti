# 테스트 가이드

## Electron 앱 테스트 구조

Electron 앱은 3가지 프로세스로 구성되어 각각 다른 환경에서 테스트해야 합니다:

### 1. **Renderer Process** (React UI)
- 환경: `happy-dom` (브라우저 환경 시뮬레이션)
- 도구: React Testing Library
- 위치: `src/renderer/**/__tests__/`
- 실행: `pnpm test:renderer`

### 2. **Main Process** (Node.js/Electron)
- 환경: `node` (Node.js 환경)
- 도구: Vitest + Electron mocks
- 위치: `src/main/**/__tests__/`, `src/services/**/__tests__/`
- 실행: `pnpm test:main`

### 3. **Integration/E2E**
- 도구: Playwright 또는 Spectron
- 실제 Electron 앱 실행 및 테스트

## 테스트 명령어

```bash
# 모든 테스트 실행 (watch 모드 없이 1회 실행)
pnpm test

# Watch 모드로 테스트 실행 (파일 변경 감지)
pnpm test:watch

# Renderer 프로세스만 테스트
pnpm test:renderer

# Main 프로세스만 테스트
pnpm test:main

# UI로 테스트 실행 (브라우저에서 확인)
pnpm test:ui

# 커버리지 리포트 생성
pnpm test:coverage
```

## 왜 watch 모드를 기본으로 비활성화했나?

1. **CI/CD 환경**: 지속적 통합 환경에서는 1회 실행 후 종료되어야 함
2. **명확한 종료**: 테스트가 끝나면 자동으로 프로세스 종료
3. **선택적 watch**: 개발 중에는 `pnpm test:watch` 사용

## 테스트 작성 예시

### Renderer Process (React Component)

```typescript
// src/renderer/components/__tests__/MyComponent.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent.js';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Main Process (Node.js Logic)

```typescript
// src/main/__tests__/config.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ConfigManager } from '../config.js';

describe('ConfigManager', () => {
  it('should load config', async () => {
    const config = new ConfigManager();
    await config.load();
    expect(config.get('version')).toBeTruthy();
  });
});
```

### Shared Utilities

```typescript
// src/shared/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest';
import { calculateTimeRemaining } from '../utils.js';

describe('Utils', () => {
  it('should calculate time correctly', () => {
    const future = new Date(Date.now() + 3600000);
    const result = calculateTimeRemaining(future.toISOString());
    expect(result.seconds).toBeGreaterThan(3500);
  });
});
```

## 설정 파일

- `vitest.config.ts`: 전체 테스트 기본 설정 (공유 테스트용)
- `vitest.config.renderer.ts`: Renderer 프로세스 전용 (React, happy-dom)
- `vitest.config.main.ts`: Main 프로세스 전용 (Node.js)
- `src/test/setup.renderer.ts`: Renderer 테스트 초기 설정 (Electron IPC mock)
- `src/test/setup.main.ts`: Main 테스트 초기 설정 (Electron API mock)

## 모킹 (Mocking)

### Electron IPC (Renderer에서)

```typescript
// 자동으로 모킹됨 (setup.renderer.ts)
window.electron.ipcRenderer.invoke('get-profiles');
```

### Electron App (Main에서)

```typescript
// 자동으로 모킹됨 (setup.main.ts)
import { app } from 'electron';
app.getPath('userData'); // '/tmp/test-user-data' 반환
```

## 디렉토리 구조

```
src/
├── main/
│   ├── __tests__/          # Main process 테스트
│   ├── config.ts
│   └── ...
├── renderer/
│   ├── components/
│   │   └── __tests__/      # Component 테스트
│   ├── hooks/
│   │   └── __tests__/      # Hook 테스트
│   └── utils/
│       └── __tests__/      # Utility 테스트
├── services/
│   └── __tests__/          # Service 테스트
├── shared/
│   └── __tests__/          # 공유 유틸 테스트
└── test/
    ├── setup.ts
    ├── setup.renderer.ts
    ├── setup.main.ts
    └── example.test.ts
```

## ESM 관련 주의사항

모든 import에 `.js` 확장자 필수:

```typescript
// ✅ 올바른 방법
import { foo } from './bar.js';
import MyComponent from '../MyComponent.js';

// ❌ 잘못된 방법
import { foo } from './bar';
import MyComponent from '../MyComponent';
```
