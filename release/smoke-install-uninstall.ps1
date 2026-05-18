param([string]$OutputFile = "release\smoke-install-uninstall-result.txt")

$results = @()

function Log {
    param([string]$msg)
    $results += $msg
    Write-Output $msg
}

# Step 1: Preclear any running instances
Log "STEP_1_PRECLEAR_START"
Get-Process -Name "SMM200" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Log "STEP_1_PRECLEAR_DONE"

# Step 2: Run installer silently
Log "STEP_2_INSTALLER_START"
$setup = ".\release\SMM200-Setup-0.0.0.exe"
if (-not (Test-Path $setup)) {
    Log "STEP_2_INSTALLER_ERROR_MISSING_FILE"
    $results | Set-Content -Path $OutputFile -Encoding ascii
    exit 1
}

& $setup /S /D="C:\Program Files\SMM200"
Start-Sleep -Seconds 20
Log "STEP_2_INSTALLER_DONE"

# Step 3: Verify installation directory exists
Log "STEP_3_DIR_CHECK_START"
$installDir = "C:\Program Files\SMM200"
if (Test-Path $installDir) {
    Log "STEP_3_DIR_CHECK_FOUND"
    $exePath = Join-Path $installDir "SMM200.exe"
    if (Test-Path $exePath) {
        Log "STEP_3_EXE_CHECK_FOUND"
    } else {
        Log "STEP_3_EXE_CHECK_MISSING"
    }
} else {
    Log "STEP_3_DIR_CHECK_MISSING"
}

# Step 4: Verify Start Menu shortcut
Log "STEP_4_START_MENU_CHECK_START"
$startMenuPath = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\SMM200"
if (Test-Path $startMenuPath) {
    Log "STEP_4_START_MENU_FOUND"
    $lnkPath = Join-Path $startMenuPath "SMM200.lnk"
    if (Test-Path $lnkPath) {
        Log "STEP_4_START_MENU_LNK_FOUND"
    } else {
        Log "STEP_4_START_MENU_LNK_MISSING"
    }
} else {
    Log "STEP_4_START_MENU_MISSING"
}

# Step 5: Verify Desktop shortcut
Log "STEP_5_DESKTOP_CHECK_START"
$desktopPath = "$env:PUBLIC\Desktop"
$desktopLnk = Join-Path $desktopPath "SMM200.lnk"
if (Test-Path $desktopLnk) {
    Log "STEP_5_DESKTOP_LNK_FOUND"
} else {
    Log "STEP_5_DESKTOP_LNK_NOT_FOUND"
}

# Step 6: Launch app from installed location and verify startup
Log "STEP_6_LAUNCH_INSTALLED_START"
$exePath = "C:\Program Files\SMM200\SMM200.exe"
if (Test-Path $exePath) {
    Start-Process -FilePath $exePath
    Start-Sleep -Seconds 8
    $runningCount = (Get-Process -Name "SMM200" -ErrorAction SilentlyContinue | Measure-Object).Count
    Log ("STEP_6_LAUNCH_INSTALLED_PROCESS_COUNT=" + $runningCount)
    Get-Process -Name "SMM200" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Log "STEP_6_LAUNCH_INSTALLED_STOPPED"
} else {
    Log "STEP_6_LAUNCH_INSTALLED_EXE_MISSING"
}

# Step 7: Uninstall via Add/Remove Programs (NSIS uninstaller)
Log "STEP_7_UNINSTALL_START"
$uninstallerPath = "C:\Program Files\SMM200\Uninstall SMM200.exe"
if (Test-Path $uninstallerPath) {
    & $uninstallerPath /S
    Start-Sleep -Seconds 15
    Log "STEP_7_UNINSTALL_DONE"
} else {
    Log "STEP_7_UNINSTALL_EXE_MISSING"
}

# Step 8: Verify uninstall removed directory
Log "STEP_8_POST_UNINSTALL_DIR_CHECK_START"
if (Test-Path $installDir) {
    Log "STEP_8_POST_UNINSTALL_DIR_STILL_EXISTS"
} else {
    Log "STEP_8_POST_UNINSTALL_DIR_REMOVED"
}

# Step 9: Verify Start Menu folder was removed
Log "STEP_9_POST_UNINSTALL_START_MENU_CHECK_START"
if (Test-Path $startMenuPath) {
    Log "STEP_9_POST_UNINSTALL_START_MENU_STILL_EXISTS"
} else {
    Log "STEP_9_POST_UNINSTALL_START_MENU_REMOVED"
}

# Step 10: Verify Desktop shortcut was removed
Log "STEP_10_POST_UNINSTALL_DESKTOP_CHECK_START"
if (Test-Path $desktopLnk) {
    Log "STEP_10_POST_UNINSTALL_DESKTOP_STILL_EXISTS"
} else {
    Log "STEP_10_POST_UNINSTALL_DESKTOP_REMOVED"
}

Log "ALL_STEPS_COMPLETE"

# Write all results to file
$results | Set-Content -Path $OutputFile -Encoding ascii
Write-Output "Results written to $OutputFile"
