@echo off
setlocal enabledelayedexpansion

set RESULT_FILE=release\smoke-install-uninstall-result.txt
(
echo STEP_1_PRECLEAR_START
taskkill /IM SMM200.exe /F 2>nul
timeout /t 2 /nobreak
echo STEP_1_PRECLEAR_DONE

echo STEP_2_INSTALLER_START
release\SMM200-Setup-0.0.0.exe /S /D=C:\Program Files\SMM200
timeout /t 20 /nobreak
echo STEP_2_INSTALLER_DONE

echo STEP_3_DIR_CHECK_START
if exist "C:\Program Files\SMM200\SMM200.exe" (
    echo STEP_3_DIR_CHECK_FOUND
) else (
    echo STEP_3_DIR_CHECK_MISSING
)

echo STEP_4_START_MENU_CHECK_START
if exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\SMM200\SMM200.lnk" (
    echo STEP_4_START_MENU_LNK_FOUND
) else (
    echo STEP_4_START_MENU_LNK_NOT_FOUND
)

echo STEP_5_DESKTOP_CHECK_START
if exist "%PUBLIC%\Desktop\SMM200.lnk" (
    echo STEP_5_DESKTOP_LNK_FOUND
) else (
    echo STEP_5_DESKTOP_LNK_NOT_FOUND
)

echo STEP_6_LAUNCH_INSTALLED_START
start /wait "C:\Program Files\SMM200\SMM200.exe"
timeout /t 2 /nobreak
taskkill /IM SMM200.exe /F 2>nul
echo STEP_6_LAUNCH_INSTALLED_STOPPED

echo STEP_7_UNINSTALL_START
if exist "C:\Program Files\SMM200\Uninstall SMM200.exe" (
    "C:\Program Files\SMM200\Uninstall SMM200.exe" /S
    timeout /t 15 /nobreak
    echo STEP_7_UNINSTALL_DONE
) else (
    echo STEP_7_UNINSTALL_EXE_MISSING
)

echo STEP_8_POST_UNINSTALL_DIR_CHECK_START
if exist "C:\Program Files\SMM200" (
    echo STEP_8_POST_UNINSTALL_DIR_STILL_EXISTS
) else (
    echo STEP_8_POST_UNINSTALL_DIR_REMOVED
)

echo STEP_9_POST_UNINSTALL_START_MENU_CHECK_START
if exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\SMM200" (
    echo STEP_9_POST_UNINSTALL_START_MENU_STILL_EXISTS
) else (
    echo STEP_9_POST_UNINSTALL_START_MENU_REMOVED
)

echo STEP_10_POST_UNINSTALL_DESKTOP_CHECK_START
if exist "%PUBLIC%\Desktop\SMM200.lnk" (
    echo STEP_10_POST_UNINSTALL_DESKTOP_STILL_EXISTS
) else (
    echo STEP_10_POST_UNINSTALL_DESKTOP_REMOVED
)

echo ALL_STEPS_COMPLETE
) > %RESULT_FILE%

echo Results written to %RESULT_FILE%
