const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '..', 'dist', 'main.js');
const maxBytes = 40 * 1024;
const bytes = fs.statSync(mainPath).size;

if (bytes > maxBytes) {
  console.error('dist/main.js is ' + bytes + ' bytes; limit is ' + maxBytes + ' bytes. Move optional code behind dynamic imports.');
  process.exit(1);
}

console.log('dist/main.js size OK: ' + (bytes / 1024).toFixed(1) + ' KB');
