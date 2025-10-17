#!/bin/bash

# 사용법 체크
if [ -z "$1" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.0.1"
  exit 1
fi

VERSION=$1

# Semantic versioning 형식 확인
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Invalid version format. Please use semantic versioning (e.g., 1.0.1, 0.1.0)"
  exit 1
fi

echo "🚀 Starting release process for version $VERSION"

# 1. 버전 업데이트
echo "📝 Updating version in package.json..."
npm version $VERSION --no-git-tag-version

# 2. 빌드
echo "🔨 Building application..."
npm run build

# 3. 배포 패키지 생성
echo "📦 Creating distribution packages..."
npm run dist

# 4. GitHub Release 생성
echo "🎉 Creating GitHub Release..."
gh release create "v$VERSION" \
  --title "Release v$VERSION" \
  --notes "## Key-ti v$VERSION

### 변경사항
- [변경사항을 여기에 작성하세요]

### 설치 방법
1. \`Key-ti-$VERSION-arm64-mac.zip\` 다운로드
2. 압축 해제 후 \`Key-ti.app\`을 Applications 폴더로 이동
3. 필요시 \`xattr -cr /Applications/Key-ti.app\` 실행

### 자동 업데이트
기존 사용자는 앱 실행 시 자동으로 업데이트 알림을 받습니다.

---
🤖 Generated with Key-ti release script" \
  release/*.dmg \
  release/*.zip \
  release/*.blockmap

# 5. 버전 커밋
echo "💾 Committing version change..."
git add package.json package-lock.json
git commit -m "chore: bump version to $VERSION"
git push

echo ""
echo "✅ Release v$VERSION created successfully!"
echo "🔗 https://github.com/kiduko/key-ti/releases/tag/v$VERSION"
