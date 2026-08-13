const fs = require('fs');

let dbCode = fs.readFileSync('src/lib/db.ts', 'utf8');
dbCode = dbCode.replace(/\\\`db_\\\$\\{collectionName\\}\\\`/g, '`db_${collectionName}`');
fs.writeFileSync('src/lib/db.ts', dbCode);

let storageCode = fs.readFileSync('src/utils/storage.ts', 'utf8');
storageCode = storageCode.replace(/\\\`db_\\\$\\{c\\}\\\`/g, '`db_${c}`');
storageCode = storageCode.replace(/\\\`log-\\\$\\{Date\.now\(\)\}\\\`/g, '`log-${Date.now()}`');
fs.writeFileSync('src/utils/storage.ts', storageCode);

