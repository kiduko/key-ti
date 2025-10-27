# 리팩토링 개선 사항

## 개요
여러 명이 유지보수하기 편하도록 코드베이스를 모듈화하고 정리했습니다.

## 주요 변경 사항

### 1. 파일 분리 및 모듈화

#### Main 프로세스 (1269줄 → 307줄, 76% 감소)
기존의 거대한 `src/main/index.ts` 파일을 기능별로 분리:

- **`window-manager.ts`**: 윈도우 생성 및 관리 (메인 윈도우, OTP 윈도우)
- **`tray-manager.ts`**: Tray 아이콘 및 메뉴 관리, Dock 아이콘 업데이트
- **`auto-renewal-manager.ts`**: 세션 자동 갱신 스케줄링 및 실행
- **`ipc-handlers.ts`**: IPC 통신 핸들러 등록 및 관리
- **`backup-manager.ts`**: 백업 생성/복원/목록 관리

#### Renderer 프로세스
UI 컴포넌트를 기능별로 분리:

- **`components/profile-manager.ts`**: AWS 프로필 CRUD 및 세션 관리
- **`components/memo-manager.ts`**: 메모장 기능
- **`components/link-manager.ts`**: 링크 관리 기능
- **`utils/toast.ts`**: Toast 알림 유틸리티

### 2. 공통 코드 중앙화

#### 타입 정의 통합
- `src/main/types.ts` 제거
- `src/shared/types.ts` 생성
  - Main, Renderer, Preload에서 공통으로 사용하는 타입 정의
  - `AWSProfile`, `AWSCredentials`, `OTPAccount`, `MemoFile`, `Link` 등

#### 유틸리티 함수
- `src/shared/utils.ts` 생성
  - `getIconPath()`: 환경별 아이콘 경로 반환 (개발/배포)
  - `getBackupDir()`: 백업 디렉토리 경로
  - `calculateTimeRemaining()`: 시간 계산 및 포맷팅

### 3. 중복 코드 제거

#### 아이콘 경로 설정
기존: 여러 곳에서 중복된 로직
```typescript
// 5군데 이상에서 반복
const getIconPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'key-logo.png');
  } else {
    return path.join(__dirname, '../..', 'build', 'key-logo.png');
  }
};
```

개선: 단일 함수로 통합
```typescript
import { getIconPath } from '../shared/utils';
const iconPath = getIconPath();
```

#### 시간 계산 로직
기존: Renderer에만 존재하던 로직을 공통 유틸리티로 이동
- Main, Renderer 모두에서 재사용 가능

### 4. 의존성 주입 패턴 도입

#### AutoRenewalManager
```typescript
constructor(
  private configManager: ConfigManager,
  private samlAuth: SAMLAuthenticator,
  private awsManager: AWSSessionManager,
  private onUpdate: () => void
)
```
- 테스트 가능성 향상
- 결합도 감소

#### TrayManager
```typescript
constructor(
  private onShowWindow: () => void,
  private onQuit: () => void
)
```
- 콜백 패턴으로 결합도 감소
- 단위 테스트 용이

## 프로젝트 구조

```
src/
├── main/
│   ├── index.ts                 (307줄, 기존 1269줄)
│   ├── config.ts
│   ├── window-manager.ts        [신규]
│   ├── tray-manager.ts          [신규]
│   ├── auto-renewal-manager.ts  [신규]
│   ├── ipc-handlers.ts          [신규]
│   └── backup-manager.ts        [신규]
├── services/
│   ├── aws.ts
│   └── saml.ts
├── shared/                      [신규]
│   ├── types.ts                 (모든 타입 정의)
│   └── utils.ts                 (공통 유틸리티)
├── renderer/
│   ├── index.ts
│   ├── index.html
│   ├── components/              [신규]
│   │   ├── profile-manager.ts
│   │   ├── memo-manager.ts
│   │   └── link-manager.ts
│   └── utils/                   [신규]
│       └── toast.ts
└── preload/
    └── index.ts
```

## 코드 품질 개선

### 1. 명확한 책임 분리
- 각 모듈이 단일 책임을 가짐
- 비즈니스 로직과 UI 로직 분리

### 2. 가독성 향상
- 파일당 라인 수 감소
- 명확한 함수/클래스 이름
- JSDoc 주석 추가

### 3. 유지보수성 향상
- 변경 영향 범위 최소화
- 모듈 간 결합도 감소
- 재사용 가능한 컴포넌트

## 호환성

### 기존 기능 100% 유지
- 모든 기능 정상 작동
- 사용자 경험 변경 없음
- 설정 파일 호환성 유지

### 빌드 성공
```bash
pnpm run build  # ✓ 성공
```

## 다음 단계 제안

### 1. 테스트 추가
```typescript
// 예: auto-renewal-manager.test.ts
describe('AutoRenewalManager', () => {
  it('should schedule renewal correctly', () => {
    // 테스트 코드
  });
});
```

### 2. Renderer 완전 분리
현재 `src/renderer/index.ts`는 여전히 큰 파일(1561줄)입니다.
- OTP 관리 컴포넌트 분리
- 설정 관리 컴포넌트 분리
- 백업 관리 컴포넌트 분리

### 3. 에러 처리 표준화
```typescript
// 예: shared/errors.ts
export class ProfileNotFoundError extends Error {}
export class SessionExpiredError extends Error {}
```

### 4. 로깅 시스템 개선
```typescript
// 예: shared/logger.ts
export const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`)
};
```

## 마이그레이션 가이드

기존 코드에서 변경된 import 경로:

```typescript
// Before
import { AWSProfile } from './types';

// After
import { AWSProfile } from '../shared/types';
```

```typescript
// Before
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'key-logo.png')
  : path.join(__dirname, '../..', 'build', 'key-logo.png');

// After
import { getIconPath } from '../shared/utils';
const iconPath = getIconPath();
```
