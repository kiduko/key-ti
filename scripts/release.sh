#!/bin/bash

# 현재 버전 가져오기
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "📌 Current version: $CURRENT_VERSION"

# 버전을 0.0.1 증가
IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"
NEW_PATCH=$((patch + 1))
NEW_VERSION="$major.$minor.$NEW_PATCH"

echo "🆕 New version: $NEW_VERSION"
echo ""
read -p "Continue with release v$NEW_VERSION? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Release cancelled"
  exit 1
fi

VERSION=$NEW_VERSION

echo "🚀 Starting release process for version $VERSION"

# 1. 버전 업데이트
echo "📝 Updating version in package.json..."
pnpm version $VERSION --no-git-tag-version

# 2. 빌드
echo "🔨 Building application..."
pnpm run build

# 3. 배포 패키지 생성
echo "📦 Creating distribution packages..."
pnpm run dist

# 4. 변경사항 생성
echo "📝 Generating changelog..."
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$PREV_TAG" ]; then
  echo "No previous tag found, using all commits"
  COMMITS=$(git log --pretty=format:"- %s" --no-merges)
else
  echo "Previous tag: $PREV_TAG"
  COMMITS=$(git log $PREV_TAG..HEAD --pretty=format:"- %s" --no-merges)
fi

# 변경사항을 카테고리별로 분류
FEATURES=$(echo "$COMMITS" | grep -i "^- feat" || true)
FIXES=$(echo "$COMMITS" | grep -i "^- fix" || true)
REFACTORS=$(echo "$COMMITS" | grep -i "^- refactor" || true)
DOCS=$(echo "$COMMITS" | grep -i "^- docs" || true)
OTHERS=$(echo "$COMMITS" | grep -iv "^- \(feat\|fix\|refactor\|docs\)" || true)

# 변경사항 생성
CHANGELOG=""

if [ -n "$FEATURES" ]; then
  CHANGELOG="${CHANGELOG}#### ✨ 새로운 기능\n${FEATURES}\n\n"
fi

if [ -n "$FIXES" ]; then
  CHANGELOG="${CHANGELOG}#### 🐛 버그 수정\n${FIXES}\n\n"
fi

if [ -n "$REFACTORS" ]; then
  CHANGELOG="${CHANGELOG}#### ♻️ 리팩토링\n${REFACTORS}\n\n"
fi

if [ -n "$DOCS" ]; then
  CHANGELOG="${CHANGELOG}#### 📝 문서\n${DOCS}\n\n"
fi

if [ -n "$OTHERS" ]; then
  CHANGELOG="${CHANGELOG}#### 기타 변경사항\n${OTHERS}\n\n"
fi

# 변경사항이 없으면 기본 메시지
if [ -z "$CHANGELOG" ]; then
  CHANGELOG="- 내부 개선 및 버그 수정"
fi

# 5. GitHub Release 생성
echo "🎉 Creating GitHub Release..."

RELEASE_NOTES="## Key-ti v$VERSION

### 변경사항
$(echo -e "$CHANGELOG")

### 설치 방법
1. \`Key-ti-$VERSION-distribution.zip\` 다운로드
2. 압축 해제
3. 터미널에서 \`./install.sh\` 실행

### 업데이트
기존 사용자는 앱 실행 시 자동으로 업데이트 알림을 받습니다.

---

**Full Changelog**: https://github.com/kiduko/key-ti/compare/$PREV_TAG...v$VERSION"

gh release create "v$VERSION" \
  --title "Release v$VERSION" \
  --notes "$RELEASE_NOTES" \
  "release/Key-ti-$VERSION-distribution.zip" \
  "release/latest-mac.yml"

# 6. 버전 커밋
echo "💾 Committing version change..."
git add package.json pnpm-lock.yaml
git commit -m "chore: bump version to $VERSION"
git push

echo ""
echo "✅ Release v$VERSION created successfully!"
echo "🔗 https://github.com/kiduko/key-ti/releases/tag/v$VERSION"
