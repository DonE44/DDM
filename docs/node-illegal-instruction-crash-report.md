# Node Illegal Instruction Crash Report

Date captured: 2026-05-21

## Summary

Node sometimes exits immediately with code `-1073741795`, which is Windows status `0xC000001D` (`STATUS_ILLEGAL_INSTRUCTION`). This has happened while running simple Node commands and build commands from the FluxAura Studio workspace.

The crash is intermittent: the same command can fail once and then pass on retry.

## Environment

- Workspace: `C:\Users\Don E\Desktop\GROK SMM200`
- Shell in IDE: PowerShell
- Windows: `Microsoft Windows [Version 10.0.19045.7291]`
- Node executable: `C:\Program Files\nodejs\node.exe`
- Node version: `v22.22.3`
- npm version: `10.9.8`

## Node Component Versions

Captured with:

```bat
node -p "JSON.stringify(process.versions,null,2)"
```

Output:

```json
{
  "node": "22.22.3",
  "acorn": "8.16.0",
  "ada": "2.9.2",
  "amaro": "1.1.8",
  "ares": "1.34.6",
  "brotli": "1.1.0",
  "cjs_module_lexer": "2.2.0",
  "cldr": "48.0",
  "icu": "78.2",
  "llhttp": "9.3.1",
  "modules": "127",
  "napi": "10",
  "nbytes": "0.1.3",
  "ncrypto": "0.0.1",
  "nghttp2": "1.64.0",
  "openssl": "3.5.6",
  "simdjson": "4.5.0",
  "simdutf": "6.4.2",
  "sqlite": "3.51.3",
  "tz": "2026a",
  "undici": "6.24.1",
  "unicode": "17.0",
  "uv": "1.51.0",
  "uvwasi": "0.0.23",
  "v8": "12.4.254.21-node.56",
  "zlib": "1.3.1-e00f703",
  "zstd": "1.5.7"
}
```

## Observed Failures

Commands that have intermittently failed with `-1073741795`:

```bat
node -p "1+1"
node -v
npm run build
node node_modules\vite\bin\vite.js build --debug --clearScreen false
```

Commands that passed after retry:

```bat
npm run build
npm run commands:audit
node -v
node -p "JSON.stringify(process.versions,null,2)"
```

## Windows Event Log Check

Command used:

```powershell
Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1000,1001; StartTime=(Get-Date).AddHours(-24)} -MaxEvents 30 |
  Where-Object { $_.Message -match 'node.exe|pwsh.exe|powershell.exe' } |
  Select-Object TimeCreated,ProviderName,Id,Message
```

Result: no matching `node.exe`, `pwsh.exe`, or `powershell.exe` crash events were returned in the queried window.

## Likely Meaning

`0xC000001D` means the process tried to execute a CPU instruction that the current CPU/runtime environment could not execute. Because the failure can occur with `node -p "1+1"`, this points below the FluxAura Studio app code, most likely one of:

- Installed Node binary or V8 build using an unsupported CPU instruction on this machine.
- Corrupt or mismatched Node installation.
- Security/overlay/injection software interfering with `node.exe`.
- Hardware/driver issue causing intermittent invalid-instruction faults.

## Recommended Permanent Fix Path

1. Install a conservative LTS Node build in a separate path and pin the project to it.
   - Recommended first test: Node 20 LTS x64, or another stable LTS build known to work on this CPU.
   - Avoid relying on the current global `C:\Program Files\nodejs\node.exe` until the crash disappears.
2. Use a per-project Node manager such as Volta or nvm-windows so VS Code terminals always pick the pinned Node version.
3. If the crash persists with a different Node version, capture a Windows crash dump using ProcDump:

```bat
procdump -e -ma -x "%TEMP%\node-crash-dumps" node.exe
```

Then rerun a crashing command such as:

```bat
node -p "1+1"
```

4. If a dump is captured, inspect it in WinDbg or send the `.dmp` plus this report to a debugger/AI.

## Notes

The FluxAura Studio build itself did pass after retry, so the app source did not appear to be the direct cause of the Node process crash.
