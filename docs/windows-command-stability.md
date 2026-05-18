# Windows Command Stability

FluxAura Studio uses Node entrypoints directly for repeatable Windows runs.

Recommended commands:

```powershell
node scripts/start-desktop-dev.cjs
node scripts/stable-validation.mjs
node node_modules/vite/bin/vite.js build --debug
```

In VS Code, use:

```text
Terminal > Run Task... > FluxAura Studio: Validate Sequentially
```

Avoid running heavy Node checks in parallel on this Windows setup. Run lint, build, command audit, and core validation sequentially. The validation script already does that and retries once if Windows returns access violation `0xC0000005`.

If PowerShell reports a PSReadLine paste/render error, it is a terminal input bug rather than a FluxAura build failure. Close that terminal tab and open a fresh one, or run the VS Code validation task above.
