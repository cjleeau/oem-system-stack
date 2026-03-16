import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  path.join(root, 'public/data/nodes.csv'),
  path.join(root, 'public/data/edges.csv')
];

let failed = false;
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required data file: ${file}`);
    failed = true;
    continue;
  }
  const firstLine = fs.readFileSync(file, 'utf8').split(/\r?\n/, 1)[0] || '';
  if (!firstLine.includes(',')) {
    console.error(`CSV header missing or invalid: ${file}`);
    failed = true;
  } else {
    console.log(`OK: ${path.relative(root, file)} -> ${firstLine}`);
  }
}

if (failed) process.exit(1);
