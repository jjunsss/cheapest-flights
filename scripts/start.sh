#!/usr/bin/env bash
# 더블클릭 또는 `bash scripts/start.sh`로 실행하세요.
# Node.js 22 이상이 깔려있어야 합니다.

set -e
cd "$(dirname "$0")/.."

echo ""
echo "🛫  Search Airplane — 최저가 직항 찾기"
echo "----------------------------------------"

# 1) Node.js 확인
if ! command -v node >/dev/null 2>&1; then
  echo "❌  Node.js가 없습니다."
  echo ""
  echo "다음 중 하나로 설치 후 다시 실행해 주세요:"
  echo "   • macOS:    brew install node"
  echo "   • Ubuntu:   sudo apt install nodejs npm"
  echo "   • 공식 사이트:  https://nodejs.org   (LTS 다운로드)"
  echo ""
  read -p "엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "⚠️  현재 Node.js v$(node -v) — 권장은 v22 이상입니다."
  echo "    그래도 계속 시도하지만 동작 보장 안 됩니다."
  echo ""
fi

# 2) node_modules 없으면 설치
if [ ! -d node_modules ]; then
  echo "📦  의존성 설치 중 (처음 한 번만, 1~3분 소요)..."
  npm install
  echo ""
fi

# 3) Playwright 브라우저 엔진 확인/설치
if [ ! -d "$HOME/.cache/ms-playwright" ] || [ -z "$(ls -A "$HOME/.cache/ms-playwright" 2>/dev/null | grep chromium)" ]; then
  echo "🌐  브라우저 엔진 설치 중 (처음 한 번만, 약 170MB)..."
  npx playwright install chromium
  echo ""
fi

# 4) 브라우저 자동 열기 (3초 후)
APP_URL="http://localhost:5173"
(
  sleep 3
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$APP_URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$APP_URL" >/dev/null 2>&1 || true
  fi
) &

echo "🚀  앱을 시작합니다..."
echo "    잠시 후 브라우저가 자동으로 열립니다 ($APP_URL)"
echo "    종료하려면 이 창에서 Ctrl+C 를 누르세요."
echo ""

npm run dev
