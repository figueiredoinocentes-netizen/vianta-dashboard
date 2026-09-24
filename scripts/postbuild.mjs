// Build script: this site has no bundler step — it's the old Lovable
// export (Aquisição, at "/") plus a standalone HTML app (Operações, at
// "/operacoes"), both served as static files. This just assembles dist/.
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC = 'public';
const DIST = 'dist';

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(PUBLIC, DIST, { recursive: true });

// Lovable's own index.html is the site's real entry point at "/".
fs.renameSync(path.join(DIST, 'lovable-index.html'), path.join(DIST, 'index.html'));

console.log('Build: public/ copied to dist/ (lovable-index.html -> index.html)');
