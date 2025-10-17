#!/bin/bash

# package.json에서 버전 읽기
VERSION=$(node -p "require('./package.json').version")

echo "📦 Creating distribution package for version $VERSION"

cd release

# 이전 파일 정리
rm -rf 'Key-ti.app' "Key-ti-$VERSION" "Key-ti-$VERSION-distribution.zip"

# ZIP 파일 압축 해제
if [ -f "Key-ti-$VERSION-arm64-mac.zip" ]; then
  echo "✓ Found Key-ti-$VERSION-arm64-mac.zip"
  unzip -q "Key-ti-$VERSION-arm64-mac.zip"
else
  echo "❌ Error: Key-ti-$VERSION-arm64-mac.zip not found"
  exit 1
fi

# 배포 폴더 생성
mkdir -p "Key-ti-$VERSION"
mv 'Key-ti.app' "Key-ti-$VERSION/"

# 설치 스크립트 및 README 복사
cp ../install.sh "Key-ti-$VERSION/" 2>/dev/null || true
cp ../README.md "Key-ti-$VERSION/" 2>/dev/null || true

# 최종 배포 ZIP 생성
zip -r -q "Key-ti-$VERSION-distribution.zip" "Key-ti-$VERSION"

# 임시 폴더 정리
rm -rf "Key-ti-$VERSION"

echo ""
echo "✅ 배포 파일 생성 완료: release/Key-ti-$VERSION-distribution.zip"
echo ""
