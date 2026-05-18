#!/usr/bin/env node
const fs = require('fs');

const file = process.argv[2] || 'src/modals/FrameBorderEditor.jsx';
const content = fs.readFileSync(file, 'utf8');

// Count braces, brackets, parentheses
const braces = { open: 0, close: 0 };
const brackets = { open: 0, close: 0 };
const parens = { open: 0, close: 0 };

let inString = false;
let stringChar = '';
let inComment = false;
let inLineComment = false;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  const prev = i > 0 ? content[i-1] : '';
  const next = i < content.length - 1 ? content[i+1] : '';
  
  // Handle comments
  if (!inString && !inComment && !inLineComment) {
    if (char === '/' && next === '/') {
      inLineComment = true;
      i++; // skip next char
      continue;
    }
    if (char === '/' && next === '*') {
      inComment = true;
      i++; // skip next char
      continue;
    }
  }
  
  if (inLineComment && char === '\n') {
    inLineComment = false;
    continue;
  }
  
  if (inComment && char === '*' && next === '/') {
    inComment = false;
    i++; // skip next char
    continue;
  }
  
  if (inComment || inLineComment) continue;
  
  // Handle strings
  if ((char === '"' || char === "'" || char === '`') && prev !== '\\') {
    if (!inString) {
      inString = true;
      stringChar = char;
    } else if (char === stringChar) {
      inString = false;
      stringChar = '';
    }
  }
  
  if (inString) continue;
  
  // Count brackets
  if (char === '{') braces.open++;
  if (char === '}') braces.close++;
  if (char === '[') brackets.open++;
  if (char === ']') brackets.close++;
  if (char === '(') parens.open++;
  if (char === ')') parens.close++;
}

const lines = content.split('\n').length;

console.log(`File: ${file}`);
console.log(`Lines: ${lines}`);
console.log(`\nBracket Balance:`);
console.log(`  Braces:   { ${braces.open} } ${braces.close} ${braces.open === braces.close ? '✓' : '✗ MISMATCH'}`);
console.log(`  Brackets: [ ${brackets.open} ] ${brackets.close} ${brackets.open === brackets.close ? '✓' : '✗ MISMATCH'}`);
console.log(`  Parens:   ( ${parens.open} ) ${parens.close} ${parens.open === parens.close ? '✓' : '✗ MISMATCH'}`);

if (braces.open !== braces.close || brackets.open !== brackets.close || parens.open !== parens.close) {
  console.log(`\n❌ Syntax check FAILED: Unbalanced brackets`);
  process.exit(1);
} else {
  console.log(`\n✓ No syntax errors found`);
  process.exit(0);
}
