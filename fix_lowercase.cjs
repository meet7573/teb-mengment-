const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules')) {
        results = results.concat(walk(file));
      }
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let code = fs.readFileSync(file, 'utf-8');
  let newCode = code.replace(/(?<!\?)\.toLowerCase\(\)/g, '?.toLowerCase()');
  
  if (code !== newCode) {
    fs.writeFileSync(file, newCode);
    console.log('Fixed', file);
  }
});
