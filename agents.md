# Key-ti Development Guide

> AWS SAML 세션 자동 갱신 도구 - 개발자 가이드

## 프로젝트 개요

Key-ti는 AWS SAML 기반 인증을 사용하는 환경에서 세션을 자동으로 관리하고 갱신하는 Electron 기반 macOS 애플리케이션입니다.

### 핵심 기능
- AWS SAML 인증을 통한 임시 자격 증명 발급
- 세션 만료 13분 전 자동 갱신
- 백그라운드 Silent 모드 (포커스 안 뺏김)
- 실패 시 자동 재시도 (10초 간격, 최대 3회)
- 실시간 세션 타이머 표시
- 로컬/클라우드 백업 지원

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Main Process                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   config.ts  │  │   saml.ts    │  │    aws.ts    │     │
│  │ (설정 관리)   │  │ (SAML 인증)  │  │  (AWS STS)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│           │                │                  │             │
│           └────────────────┴──────────────────┘             │
│                          main.ts                            │
│                    (자동 갱신 로직)                          │
└─────────────────────────────────────────────────────────────┘
                             │
                    IPC Communication
                             │
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│                      renderer.ts                             │
│              (UI, 타이머, 프로필 관리)                        │
└─────────────────────────────────────────────────────────────┘
```

## 디렉토리 구조

```
piongate/
├── src/
│   ├── main.ts              # 메인 프로세스 (자동 갱신 로직)
│   ├── renderer.ts          # 렌더러 프로세스 (UI)
│   ├── renderer.html        # UI 템플릿
│   ├── preload.ts           # IPC 브리지
│   ├── config.ts            # 설정 파일 관리
│   ├── saml.ts              # SAML 인증 처리
│   ├── aws.ts               # AWS STS 통신
│   └── types.ts             # TypeScript 타입 정의
├── scripts/
│   ├── release.sh           # 로컬 릴리즈 스크립트
│   ├── post-dist.sh         # 빌드 후처리
│   └── install.sh           # 사용자 설치 스크립트
├── build/
│   └── key-logo.png         # 앱 아이콘
├── .github/workflows/
│   └── release.yml          # GitHub Actions 릴리즈
└── release/                 # 빌드 산출물
```

## 핵심 컴포넌트

### 1. 자동 갱신 시스템 (main.ts)

#### 타이머 관리
```typescript
const renewalTimers = new Map<string, NodeJS.Timeout>();
const renewalRetryCount = new Map<string, number>();
```

#### 주요 함수
- `scheduleAutoRenewal(alias, expirationDate)` - 세션 만료 13분 전 타이머 설정
- `autoRenewSession(alias, retryAttempt)` - 자동 갱신 실행 (재시도 로직 포함)
- `cancelAutoRenewal(alias)` - 타이머 취소
- `updateDockIcon()` - Dock 아이콘 배지 업데이트

#### 갱신 프로세스
1. 만료 13분 전 타이머 트리거
2. Silent 모드로 SAML 인증 (포커스 안 뺏김)
3. AWS STS로 새 자격 증명 발급
4. ~/.aws/credentials 업데이트
5. 다음 갱신 스케줄링
6. UI 자동 새로고침

#### 실패 처리
- 실패 시 10초 대기 후 재시도
- 최대 3회까지 재시도
- 모두 실패 시 사용자에게 토스트 알림

### 2. SAML 인증 (saml.ts)

#### Silent 모드
```typescript
async authenticate(samlUrl: string, options?: { silent?: boolean })
```

**일반 모드**: 창 표시, 포커스 가능, 태스크바 표시
**Silent 모드**: 창 숨김, 포커스 불가, 태스크바 숨김

#### SAML 응답 추출
- `onBeforeRequest` - POST 데이터에서 SAMLResponse 가로채기
- `did-finish-load` - 페이지에서 hidden input 추출
- `did-navigate` - 리다이렉트 감지

### 3. AWS 세션 관리 (aws.ts)

#### 주요 메서드
- `assumeRoleWithSAML()` - AWS STS로 임시 자격 증명 발급
- `saveCredentialsToAWSConfig()` - ~/.aws/credentials 파일 업데이트
- `removeCredentialsFromAWSConfig()` - 프로필 삭제
- `generateConsoleUrl()` - AWS 콘솔 로그인 URL 생성
- `checkAndBackupExistingCredentials()` - 기존 credentials 백업

#### 세션 시간 설정
환경 변수로 세션 시간 조절 가능:
```bash
export KEY_TI_SESSION_DURATION=300  # 5분 (테스트용)
export KEY_TI_SESSION_DURATION=43200 # 12시간 (기본값)
```

### 4. UI 타이머 (renderer.ts)

#### 시간 계산 헬퍼
```typescript
function calculateTimeRemaining(expirationStr: string): {
  seconds: number;
  text: string;
  className: string;
}
```

- 5분 미만: `time-critical` (빨간색)
- 5분~1시간: `time-warning` (노란색)
- 1시간 이상: `time-normal` (파란색)

#### 실시간 업데이트
```typescript
timerInterval = setInterval(() => {
  // 1초마다 모든 타이머 업데이트
}, 1000);
```

### 5. Dock/Tray 아이콘

#### Dock 배지
```typescript
app.dock.setBadge(activeProfiles.length.toString());
```

#### Tray 타이틀
```typescript
tray.setTitle(`${activeProfiles.length}`);
```

활성 세션 수를 실시간으로 표시 (0 포함)

## IPC 통신

### Main → Renderer
```typescript
// UI 자동 새로고침
mainWindow.webContents.executeJavaScript(`
  if (typeof window.loadProfiles === 'function') {
    window.loadProfiles();
  }
  window.showStatus('세션이 자동으로 갱신되었습니다', 'success');
`);
```

### Renderer → Main
```typescript
ipcMain.handle('activate-profile', async (event, alias) => {
  // 세션 활성화 로직
  scheduleAutoRenewal(alias, credentials.expiration);
});

ipcMain.handle('deactivate-profile', async (event, alias) => {
  // 세션 비활성화 로직
  cancelAutoRenewal(alias);
});
```

## 설정 파일

### 위치
- macOS: `~/Library/Application Support/key-ti/`
- 설정 파일: `config.json`
- 백업 파일: `backup-*.json`
- 백업 설정: `backup-settings.json`

### config.json 구조
```json
{
  "profiles": [
    {
      "alias": "dev",
      "profileName": "my-dev-profile",
      "roleArn": "arn:aws:iam::123456789012:role/DevRole",
      "samlUrl": "https://sso.example.com/...",
      "idp": "arn:aws:iam::123456789012:saml-provider/...",
      "lastRefresh": "2025-10-17T07:00:00.000Z",
      "expiration": "2025-10-17T19:00:00.000Z"
    }
  ],
  "activeProfiles": ["dev"]
}
```

## 빌드 및 배포

### 로컬 개발
```bash
npm install
npm run build
npm start
```

### 테스트 (짧은 세션)
```bash
export KEY_TI_SESSION_DURATION=60  # 1분
npm start
```

### 로컬 릴리즈
```bash
./scripts/release.sh
# 자동으로 버전 0.0.1 증가
# release/ 폴더에 distribution.zip 생성
```

### GitHub Actions 릴리즈
1. GitHub → Actions → Release 워크플로우 실행
2. 자동으로 버전 증가 (patch +1)
3. 빌드 후 GitHub Releases에 업로드
4. `Key-ti-x.x.x-distribution.zip` 생성

### 설치
```bash
# distribution.zip 다운로드 후
unzip Key-ti-x.x.x-distribution.zip
cd Key-ti-x.x.x
./install.sh
```

## 주요 이슈 및 제한사항

### 1. 코드 서명 미지원
**현재 상태**: 수동 업데이트만 가능
**원인**: Apple Developer Program 미가입 (코드 서명 불가)
**해결 방법**:
- Apple Developer Program 가입 ($99/year)
- 인증서 발급 및 electron-builder 설정
- 자동 업데이트 재활성화

**TODO 위치**: `src/main.ts:196-199`

### 2. 리전 고정
**현재 상태**: `us-east-1` 하드코딩
**위치**: `src/aws.ts:12`
**영향**: STS는 글로벌 서비스라 대부분 동작하지만 일부 제약 가능
**개선 방안**: 프로필별 리전 설정 UI 추가

### 3. 자동 갱신 설정 UI 없음
**현재 상태**: 자동 갱신이 모든 활성 세션에 자동 적용
**개선 방안**:
- 설정 탭에 자동 갱신 on/off 토글
- 프로필별 자동 갱신 설정
- 갱신 타이밍 조절 (5분/10분/15분)

## 디버깅

### 로그 확인
```bash
# 개발자 도구 열기
# src/main.ts:192 주석 해제
mainWindow.webContents.openDevTools();
```

### 콘솔 로그
- `Auto-renewal scheduled for {alias}` - 갱신 예약
- `Auto-renewing session for {alias} (attempt X/3)` - 갱신 시도
- `Auto-renewal successful for {alias}` - 갱신 성공
- `Auto-renewal failed for {alias}` - 갱신 실패

### 타이머 확인
```typescript
console.log(renewalTimers); // 현재 활성 타이머
console.log(configManager.getActiveProfiles()); // 활성 프로필
```

## 테스트 가이드

### 자동 갱신 테스트
```bash
# 1분 세션으로 설정
export KEY_TI_SESSION_DURATION=60
npm start

# 세션 활성화 후 47초 후(13초 전) 자동 갱신 시작
# 총 3회까지 재시도 확인
```

### Silent 모드 테스트
- 자동 갱신 시 브라우저 창이 보이지 않아야 함
- 다른 앱 작업 중 포커스 안 뺏겨야 함
- 태스크바에 표시 안 되어야 함

### UI 타이머 테스트
- 1초마다 카운트다운 확인
- 색상 변경 확인 (1시간/5분 기준)
- 만료 시 "만료됨" 표시 확인

## 기여 가이드

### 코드 스타일
- TypeScript strict 모드
- async/await 사용 (Promise 체이닝 최소화)
- 명확한 함수명 (동사 + 명사)
- 주석: 복잡한 로직에만 (코드가 설명되도록 작성)

### 커밋 메시지
```
feat: 새로운 기능
fix: 버그 수정
refactor: 리팩토링
docs: 문서 수정
chore: 빌드/설정 변경
```

### PR 체크리스트
- [ ] 빌드 성공 (`npm run build`)
- [ ] 기능 테스트 완료
- [ ] 관련 이슈에 연결
- [ ] 주요 변경사항 문서화

## 참고 링크

- [Electron 공식 문서](https://www.electronjs.org/docs)
- [electron-updater](https://www.electron.build/auto-update)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [GitHub Issues](https://github.com/kiduko/key-ti/issues)

## 연락처

이슈 및 기여: https://github.com/kiduko/key-ti/issues

---

**마지막 업데이트**: 2025-10-17
**버전**: 0.0.7
