# Key-ti

SAML 기반 AWS 세션 키 자동 갱신 프로그램

## 기능

- **세션 관리**: AWS 프로필 관리 (alias, profile name, role ARN, SAML URL, IDP)
- **SAML 인증**: 브라우저를 통한 자동 로그인
- **자동 갱신**: AWS STS를 통한 임시 자격 증명 자동 발급
- **Credentials 관리**: ~/.aws/credentials 파일 자동 업데이트
- **메모장**: 여러 메모 파일 관리
- **링크 관리**: 자주 사용하는 사이트 빠른 접근
- **백업/복원**: 로컬 백업 (~/.key-ti)

## 배포판 설치

1. `Key-ti-{VERSION}-distribution.zip` 압축 해제 (예: Key-ti-1.0.0-distribution.zip)
2. 터미널에서 다음 명령 실행:

```bash
cd Key-ti-{VERSION}  # 예: cd Key-ti-1.0.0
./install.sh
```

install.sh가 자동으로:
- ZIP 파일을 찾아서 압축 해제
- Key-ti.app을 Applications 폴더로 복사
- 보안 속성 제거 (xattr)

## 개발자용 설치

```bash
npm install
npm run dev
```

## 빌드 및 배포

```bash
# 개발 빌드
npm run build
npm start

# 배포판 생성 (로컬)
npm run dist
```

## GitHub Release 배포

### 로컬 릴리즈 (권장)

로컬에서 빌드하고 GitHub Release를 생성합니다 (macOS runner 비용 절약):

```bash
./scripts/release.sh
```

스크립트가 자동으로:
- ✅ 현재 버전에서 0.0.1 자동 증가
- ✅ 확인 후 진행 (y/n)
- ✅ package.json 버전 업데이트
- ✅ 앱 빌드
- ✅ 배포 패키지 생성 (ZIP)
- ✅ GitHub Release 생성 및 파일 업로드
- ✅ 버전 변경사항 커밋 및 푸시

### GitHub Actions 릴리즈

GitHub 웹 UI에서 릴리즈 (버전 자동 증가):

1. GitHub 저장소 → **Actions** 탭
2. **Release** workflow 선택
3. **Run workflow** 클릭
4. 버전 자동 증가 (현재 버전 + 0.0.1)

**참고:** macOS runner 비용이 비싸므로 로컬 릴리즈 권장

## 사용 방법

### 1. 세션 관리 탭

- **프로필 추가**: AWS 프로필 정보 입력
  - Alias: 프로필 별칭 (예: production)
  - Profile Name: AWS credentials 파일에 저장될 프로필 이름
  - Role ARN: AssumeRole할 역할의 ARN
  - SAML URL: IDP의 SAML 인증 URL
  - IDP: SAML Provider의 ARN (Principal ARN)

- **로그인**: 프로필에서 "로그인" 버튼 클릭
  - 브라우저에서 IDP 로그인
  - 자동으로 AWS 자격 증명 발급 및 저장

- **AWS 콘솔 열기**: 활성 세션에서 "콘솔" 버튼으로 브라우저에서 AWS 콘솔 접속

### 2. 메모장 탭

- 여러 메모 파일 생성 및 관리
- 왼쪽 목록에서 메모 선택
- "저장" 버튼으로 내용 저장

### 3. 링크 탭

- 자주 사용하는 웹사이트 URL 저장
- 클릭으로 브라우저에서 바로 열기

### 4. 설정 탭

- **백업**: `~/.key-ti` 폴더에 모든 데이터 백업
- **복원**: 백업 목록에서 선택하여 복원
- **자동 백업**: 앱 종료 시 자동 백업 (선택사항)

## 기술 스택

- TypeScript
- Electron
- AWS SDK for JavaScript v3
- HTML/CSS

## 주의사항

- macOS 전용으로 개발됨
- SAML 인증이 설정된 AWS 계정이 필요
- 세션은 최대 12시간 동안 유효
