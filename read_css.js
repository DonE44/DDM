const fs = require('fs');
const lines = fs.readFileSync('c:/Users/base2jump/CODING FOR APPS/GROK SMM200/src/App.css', 'utf8').split('\n');
console.log('Total lines:', lines.length);
console.log('Last 10 lines:');
lines.slice(-10).forEach((l, i) => console.log(lines.length - 10 + i + 1, JSON.stringify(l)));
