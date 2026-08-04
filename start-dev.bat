@echo off
REM ============================================================
REM  InTandem Desk — start the local dev servers
REM
REM  Double-click this file (or pin it to your taskbar) to bring
REM  up both apps:
REM
REM      Web     http://localhost:8080
REM      Mobile  http://localhost:8081
REM
REM  WHY THIS FILE EXISTS
REM  --------------------
REM  Servers started from inside an assistant session are child
REM  processes of that session — when it ends, Windows kills them
REM  and localhost goes dead. Launched from here, the server is
REM  owned by YOU. Nothing but closing this window stops it.
REM
REM  The loop restarts the orchestrator if it ever exits unexpectedly,
REM  so a crash does not leave you with a dead localhost.
REM  Close this window (or press Ctrl-C twice) to stop for real.
REM ============================================================

title InTandem Desk - dev servers
cd /d "%~dp0"

:loop
echo.
echo  ---------------------------------------------------------
echo   Starting InTandem Desk dev servers...
echo   Web    http://localhost:8080
echo   Mobile http://localhost:8081
echo   Close this window to stop.
echo  ---------------------------------------------------------
echo.

node dev.mjs

REM Reaching here means dev.mjs exited. If that was deliberate
REM (Ctrl-C) the window closes on the next keypress; otherwise it
REM comes back up after a short pause.
echo.
echo  [!] dev.mjs stopped. Restarting in 3 seconds -- press Ctrl-C to quit.
timeout /t 3 /nobreak >nul
goto loop
