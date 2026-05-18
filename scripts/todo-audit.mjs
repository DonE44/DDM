import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'electron', 'scripts', 'docs', '.vscode'];
const ignoreDirs = new Set(['node_modules', 'dist', 'release', '.git', 'models']);
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.cjs', '.mjs', '.json', '.md', '.ps1', '.css', '.html']);

const patterns = [
  ['TODO', /\bTODO\b/i],
  ['FIXME', /\bFIXME\b/i],
  ['HACK', /\bHACK\b/i],
  ['XXX', /\bXXX\b/],
  ['NOT_IMPLEMENTED', /not implemented|not yet implemented|unimplemented/i],
  ['STUB', /\bstub\b/i],
  ['PLACEHOLDER', /placeholder/i],
  ['LEGACY_BRAND', /\bSMME\b|Solutions MultiMedia Editor|\bSMM200\b|\bScala\b|\bSMMScript\b/i],
];

const hits = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) walk(filePath);
      continue;
    }

    if (!extensions.has(path.extname(entry.name).toLowerCase())) continue;

    let text = '';
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    text.split(/\r?\n/).forEach((line, index) => {
      const match = patterns.find(([, pattern]) => pattern.test(line));
      if (!match) return;

      hits.push({
        kind: match[0],
        file: filePath,
        line: index + 1,
        text: line.trim().slice(0, 240),
      });
    });
  }
}

roots.forEach(walk);

for (const hit of hits) {
  console.log(`${hit.kind}\t${hit.file}\t${hit.line}\t${hit.text}`);
}

console.error(`TOTAL_HITS=${hits.length}`);
