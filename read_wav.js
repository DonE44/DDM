const fs=require('fs');
const b=fs.readFileSync('c:\\Users\\base2jump\\CODING FOR APPS\\GROK SMM200\\resources\\SE2X03-05\\SCALA\\CLIPART\\MUSIC\\WAVE\\1CHILL1.WAV');
const fmt=b.readUInt16LE(20);
const ch=b.readUInt16LE(22);
const sr=b.readUInt32LE(24);
const bps=b.readUInt16LE(34);
console.log('format:',fmt,'channels:',ch,'sampleRate:',sr,'bitsPerSample:',bps,'size:',b.length);
