const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  `} else if (record.status === 'Present') {`,
  `} else {`
);

fs.writeFileSync('server.ts', code);
console.log('Fixed break condition');
