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

1. `Key-ti-1.0.0-distribution.zip` 압축 해제
2. 터미널에서 다음 명령 실행:

```bash
cd Key-ti-1.0.0
chmod +x install.sh
./install.sh
```

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

로컬에서 빌드하고 GitHub Release를 생성합니다 (macOS runner 비용 절약):

```bash
./scripts/release.sh 1.0.1
```

스크립트가 자동으로:
- ✅ 버전 형식 검증 (semantic versioning: x.y.z)
- ✅ package.json 버전 업데이트
- ✅ 앱 빌드
- ✅ 배포 패키지 생성 (DMG, ZIP)
- ✅ GitHub Release 생성 및 파일 업로드
- ✅ 버전 변경사항 커밋 및 푸시

### 수동 릴리즈 (대안)

직접 단계별로 실행하려면:

```bash
# 1. 버전 업데이트
npm version 1.0.1 --no-git-tag-version

# 2. 빌드 및 배포 패키지 생성
npm run dist

# 3. GitHub Release 생성
gh release create v1.0.1 \
  --title "Release v1.0.1" \
  --notes "릴리즈 노트 내용" \
  release/*.dmg release/*.zip release/*.blockmap

# 4. 버전 커밋
git add package.json package-lock.json
git commit -m "chore: bump version to 1.0.1"
git push
```

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
