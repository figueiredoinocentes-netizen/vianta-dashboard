// Post-build script (Node.js): copy Lovable assets + operacoes.html into dist
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC = 'public';
const DIST = 'dist';
const ASSETS = path.join(DIST, 'assets');

// 1. Copy old Lovable bundle and CSS
fs.copyFileSync(
  path.join(PUBLIC, 'assets', 'index-Cdosnuq2.js'),
  path.join(ASSETS, 'index-Cdosnuq2.js')
);
fs.copyFileSync(
  path.join(PUBLIC, 'assets', 'index-DBm4vQ15.css'),
  path.join(ASSETS, 'index-DBm4vQ15.css')
);

// 2. Copy old Lovable index.html (overwrites Vite's generated one)
fs.copyFileSync(
  path.join(PUBLIC, 'lovable-index.html'),
  path.join(DIST, 'index.html')
);

// 3. Copy operacoes.html
fs.copyFileSync(
  path.join(PUBLIC, 'operacoes.html'),
  path.join(DIST, 'operacoes.html')
);

console.log('Post-build: old Lovable assets + operacoes.html copied to dist/');