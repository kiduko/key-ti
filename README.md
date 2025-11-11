# Key-ti

> AWS SAML 세션 자동 관리 도구

macOS용 Electron 앱으로 AWS SAML 인증 기반 임시 자격 증명을 자동으로 관리하고 갱신합니다.

## 주요 기능

### 🔐 세션 자동 갱신
- 세션 만료 13분 전 자동 갱신
- 백그라운드 Silent 모드 (포커스 안 뺏김)
- 실패 시 자동 재시도 (10초 간격, 최대 3회)

### 📊 세션 관리
- AWS 프로필 관리 및 다중 세션 지원
- 실시간 타이머 및 만료 알림
- ~/.aws/credentials 자동 업데이트
- AWS 콘솔 원클릭 접속

### 📈 Claude Code 사용량 분석
- 일별/월별 토큰 사용량 및 비용 통계
- 모델별(Sonnet 4.5, Haiku 4) 상세 분석
- 5시간 세션 블록 및 주간 사용량 추적
- 로컬 시간대 기준 정확한 집계
- ~/.claude/projects/ 세션 데이터 자동 수집

### 🛠️ 추가 기능
- 메모장 및 링크 관리
- 자동 백업/복원 (~/.key-ti)
- Dock/Tray 아이콘 활성 세션 표시

## 설치

[최신 릴리즈](https://github.com/kiduko/key-ti/releases/latest)에서 `Key-ti-x.x.x-distribution.zip` 다운로드 후:

```bash
unzip Key-ti-x.x.x-distribution.zip
cd Key-ti-x.x.x
./install.sh
```

## 사용 방법

### 프로필 추가
1. **세션 관리** 탭에서 **프로필 추가**
2. 프로필 정보 입력:
   - **Alias**: 프로필 별칭 (예: production)
   - **Profile Name**: AWS credentials 파일명
   - **Role ARN**: AssumeRole 역할 ARN
   - **SAML URL**: IDP SAML 인증 URL
   - **IDP**: SAML Provider ARN

### 세션 활성화
1. 프로필에서 **로그인** 클릭
2. 브라우저에서 IDP 인증
3. 자동으로 자격 증명 발급 및 저장
4. 만료 13분 전 자동 갱신

### AWS 콘솔 접속
활성 세션에서 **콘솔** 버튼 클릭

### Claude Code 사용량 확인
1. **사용량** 탭 선택
2. 일별/월별 통계 전환
3. 세션별 상세 토큰 및 비용 확인
4. 5시간 세션 리셋 및 주간 리셋 타이머 확인

## 개발

### 환경 설정
```bash
pnpm install
pnpm run dev
```

### 세션 시간 조절 (테스트용)
```bash
export KEY_TI_SESSION_DURATION=300  # 5분
pnpm start
```

### 빌드
```bash
pnpm run build        # TypeScript 컴파일
pnpm run dist         # 배포 패키지 생성
```

### 문서
- [agents.md](agents.md) - 개발자 가이드 및 AI 에이전트 워크플로우
- [GitHub Issues](https://github.com/kiduko/key-ti/issues) - 이슈 및 기능 요청

## 기술 스택

- **TypeScript** - 타입 안전성
- **Electron** - 크로스 플랫폼 데스크톱 앱
- **AWS SDK v3** - AWS STS 인증
- **electron-updater** - 자동 업데이트 (수동 업데이트 방식으로 변경됨)

## 라이선스

MIT

## 기여

이슈 및 PR 환영합니다! 기여 전 [agents.md](agents.md)를 참고해주세요.
