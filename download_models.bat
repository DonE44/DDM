@echo off
setlocal enabledelayedexpansion

cd /d "c:\Users\base2jump\CODING FOR APPS\GROK SMM200"

echo Downloading Xenova Whisper models (no authentication needed)...
python scripts/download-whisper-models.py

pause

