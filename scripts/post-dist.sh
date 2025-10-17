#!/bin/bash

# package.json에서 버전 읽기
VERSION=$(node -p "require('./package.json').version")

echo "📦 Creating distribution package for version $VERSION"

cd release

# 이전 파일 정리
rm -rf "Key-ti-$VERSION-distribution" "Key-ti-$VERSION-distribution.zip"

# ZIP 파일 존재 확인
if [ ! -f "Key-ti-$VERSION-arm64-mac.zip" ]; then
  echo "❌ Error: Key-ti-$VERSION-arm64-mac.zip not found"
  exit 1
fi

echo "✓ Found Key-ti-$VERSION-arm64-mac.zip ($(du -h "Key-ti-$VERSION-arm64-mac.zip" | cut -f1))"

# 배포 폴더 생성
mkdir -p "Key-ti-$VERSION-distribution"

# electron-builder가 만든 압축 파일 복사 (압축 해제하지 않음)
cp "Key-ti-$VERSION-arm64-mac.zip" "Key-ti-$VERSION-distribution/"

# 설치 스크립트 및 README 복사
cp ../scripts/install.sh "Key-ti-$VERSION-distribution/" 2>/dev/null || true
chmod +x "Key-ti-$VERSION-distribution/install.sh" 2>/dev/null || true
cp ../README.md "Key-ti-$VERSION-distribution/" 2>/dev/null || true

# 최종 배포 ZIP 생성
zip -r -q "Key-ti-$VERSION-distribution.zip" "Key-ti-$VERSION-distribution"

# 임시 폴더 정리
rm -rf "Key-ti-$VERSION-distribution"

echo ""
echo "✅ 배포 파일 생성 완료: release/Key-ti-$VERSION-distribution.zip ($(du -h "Key-ti-$VERSION-distribution.zip" | cut -f1))"
echo ""
