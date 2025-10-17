#!/bin/bash

echo "Key-ti 설치 중..."

# arm64-mac.zip 파일 찾기
ZIP_FILE=$(ls Key-ti-*-arm64-mac.zip 2>/dev/null | head -1)

if [ -z "$ZIP_FILE" ]; then
    echo "❌ 오류: Key-ti ZIP 파일을 찾을 수 없습니다."
    echo "distribution.zip 파일을 압축 해제한 폴더에서 실행하세요."
    exit 1
fi

echo "📦 $ZIP_FILE 발견"
echo "압축 해제 중..."
unzip -q "$ZIP_FILE"

if [ ! -d "Key-ti.app" ]; then
    echo "❌ 오류: 압축 해제에 실패했습니다."
    exit 1
fi

echo "Applications 폴더로 복사 중..."
cp -R "Key-ti.app" /Applications/

# quarantine 속성 제거
echo "보안 속성 제거 중..."
xattr -cr "/Applications/Key-ti.app"

# 임시 파일 정리
echo "임시 파일 정리 중..."
rm -rf "Key-ti.app"

echo ""
echo "✅ 설치 완료!"
echo ""
echo "이제 Applications 폴더에서 'Key-ti'를 실행할 수 있습니다."
echo ""
