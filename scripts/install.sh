#!/bin/bash

echo "Key-ti 설치 중..."

# 현재 디렉토리에서 ZIP 파일 찾기
ZIP_FILE=$(ls Key-ti-*-arm64-mac.zip 2>/dev/null | head -n 1)

if [ -z "$ZIP_FILE" ]; then
    echo "❌ 오류: Key-ti ZIP 파일을 찾을 수 없습니다."
    exit 1
fi

echo "📦 $ZIP_FILE 발견"

# ZIP 압축 해제
if [ -f "$ZIP_FILE" ]; then
    echo "압축 해제 중..."
    unzip -q "$ZIP_FILE"

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
