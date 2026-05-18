const fs=require('fs');const c=fs.readFileSync('src/App.jsx','utf8');const ob=c.split('{').length-1;const cb=c.split('}').length-1;console.log('Braces',ob,cb,'diff',ob-cb)
