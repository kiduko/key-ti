#!/bin/bash

echo "Key-ti 설치 중..."

# DMG 마운트 (DMG를 사용하는 경우)
if [ -f "Key-ti-1.0.0-arm64.dmg" ]; then
    echo "DMG 마운트 중..."
    hdiutil attach "Key-ti-1.0.0-arm64.dmg" -quiet

    echo "Applications 폴더로 복사 중..."
    cp -R "/Volumes/Key-ti 1.0.0-arm64/Key-ti.app" /Applications/

    echo "DMG 언마운트 중..."
    hdiutil detach "/Volumes/Key-ti 1.0.0-arm64" -quiet
fi

# ZIP을 사용하는 경우
if [ -f "Key-ti-1.0.0-arm64-mac.zip" ]; then
    echo "압축 해제 중..."
    unzip -q "Key-ti-1.0.0-arm64-mac.zip"

    echo "Applications 폴더로 복사 중..."
    cp -R "Key-ti.app" /Applications/
fi

# App이 현재 디렉토리에 이미 있는 경우 (distribution zip에서 압축 해제한 경우)
if [ -d "Key-ti.app" ]; then
    echo "Applications 폴더로 복사 중..."
    cp -R "Key-ti.app" /Applications/
fi

# quarantine 속성 제거
echo "보안 속성 제거 중..."
xattr -cr "/Applications/Key-ti.app"

echo ""
echo "✅ 설치 완료!"
echo ""
echo "이제 Applications 폴더에서 'Key-ti'를 실행할 수 있습니다."
echo ""
