'use strict';
/**
 * afterPack hook — replaces the electron-builder-modified executable with a
 * pristine copy of electron.exe so that PE-resource corruption introduced by
 * the asar-integrity update step (which ignores signAndEditExecutable:false)
 * does not prevent the Chromium startup sequence from running.
 *
 * Root-cause: electron-builder 26.x writes directly to the PE resource section
 * of the renamed executable even when signAndEditExecutable is false, leaving
 * two corrupted header bytes (0x114, 0x368) and ~73 kB of mutated resource
 * entries that cause Electron to exit in <500 ms before any JS runs.
 */
const fs   = require('fs');
const path = require('path');

module.exports = async function afterPack(context) {
  const { appOutDir, packager } = context;

  // Only applies to Windows builds
  if (packager.platform.name !== 'windows') return;

  // packager.appInfo.productFilename is the reliable source in electron-builder 26.x
  const productName = (packager.appInfo && packager.appInfo.productFilename)
    || packager.appInfo.productName
    || 'FluxAura Studio';
  const exeName = productName + '.exe';
  const destPath = path.join(appOutDir, exeName);
  const srcPath  = path.join(
    packager.info.projectDir,
    'node_modules', 'electron', 'dist', 'electron.exe'
  );

  if (!fs.existsSync(srcPath)) {
    console.warn('[afterPack] WARNING: electron.exe not found at', srcPath);
    return;
  }

  console.log(`[afterPack] Restoring pristine electron.exe -> ${exeName}`);
  fs.copyFileSync(srcPath, destPath);
  console.log('[afterPack] Done.');
};
