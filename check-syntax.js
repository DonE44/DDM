const fs=require('fs');
const src=fs.readFileSync('src/App.jsx','utf8');
const braces=src.split('{').length-src.split('}').length;
const parens=src.split('(').length-src.split(')').length;
console.log('Brace balance:', braces, '(should be 0)');
console.log('Paren balance:', parens, '(should be 0)');
console.log('Total lines:', src.split('\n').length);
