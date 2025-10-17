#!/bin/bash

echo "Key-ti 설치 중..."

# Key-ti.app 찾기 (distribution.zip에서 이미 압축 해제된 상태)
if [ ! -d "Key-ti.app" ]; then
    echo "❌ 오류: Key-ti.app을 찾을 수 없습니다."
    echo "distribution.zip 파일을 압축 해제한 폴더에서 실행하세요."
    exit 1
fi

echo "📦 Key-ti.app 발견"
echo "Applications 폴더로 복사 중..."
cp -R "Key-ti.app" /Applications/

# quarantine 속성 제거
echo "보안 속성 제거 중..."
xattr -cr "/Applications/Key-ti.app"

echo ""
echo "✅ 설치 완료!"
echo ""
echo "이제 Applications 폴더에서 'Key-ti'를 실행할 수 있습니다."
echo ""
