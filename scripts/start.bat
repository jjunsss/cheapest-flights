@echo off
REM 더블클릭 또는 cmd에서 (scripts\start.bat) 으로 실행하세요.
REM Node.js 22 이상이 깔려있어야 합니다.

setlocal
cd /d "%~dp0\.."

echo.
echo  Search Airplane - 최저가 직항 찾기
echo ----------------------------------------

REM 1) Node.js 확인
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [X] Node.js가 없습니다.
  echo.
  echo  https://nodejs.org 에서 LTS 버전을 다운로드한 후 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

REM 2) node_modules 없으면 설치
if not exist node_modules (
  echo.
  echo  [*] 의존성 설치 중 (처음 한 번만, 1~3분 소요)...
  call npm install
  if errorlevel 1 goto :fail
)

REM 3) Playwright Chromium 확인
if not exist "%USERPROFILE%\AppData\Local\ms-playwright\chromium-headless-shell-1223" if not exist "%USERPROFILE%\AppData\Local\ms-playwright\chromium-1223" (
  echo.
  echo  [*] 브라우저 엔진 설치 중 (처음 한 번만, 약 170MB)...
  call npx playwright install chromium
  if errorlevel 1 goto :fail
)

REM 4) 브라우저 자동 열기 (3초 후 백그라운드)
start "" /MIN cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5173"

echo.
echo  [^>] 앱을 시작합니다...
echo      잠시 후 브라우저가 자동으로 열립니다 (http://localhost:5173)
echo      종료하려면 이 창에서 Ctrl+C 를 누르세요.
echo.

call npm run dev
exit /b 0

:fail
echo.
echo  설치 도중 오류가 발생했습니다. 메시지를 확인해 주세요.
pause
exit /b 1
