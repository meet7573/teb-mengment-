// After making everything optional chaining, some TypeScript checks might complain about string vs string | undefined
// But since the result of ?.toLowerCase() might be undefined, .includes() could throw if called on undefined, e.g. a?.toLowerCase().includes() -> Cannot read property 'includes' of undefined.
// So let's replace `?.toLowerCase().includes` with `?.toLowerCase()?.includes`
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
  let newCode = code.replace(/\?\.toLowerCase\(\)\.includes/g, '?.toLowerCase()?.includes');
  
  if (code !== newCode) {
    fs.writeFileSync(file, newCode);
    console.log('Fixed includes', file);
  }
});
