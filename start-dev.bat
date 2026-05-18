@echo off
cd /d "%~dp0"
echo Starting SMM200 dev environment...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-desktop-dev.ps1
