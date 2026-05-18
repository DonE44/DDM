@echo off
cd /d "c:\Users\base2jump\CODING FOR APPS\GROK SMM200"
node node_modules/.bin/vite build --mode development
echo EXIT CODE: %ERRORLEVEL%
