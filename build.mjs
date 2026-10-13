// Builds the two single-file apps (index.html, index.offline.html) from src/.
// No dependencies: node build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

const template = read('src/index.template.html');
const css = read('src/css/styles.css');
const script = readdirSync(join(root, 'src/js'))
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => read('src/js/' + f))
  .join('');

const fill = (libs) =>
  template
    .replace('@@STYLES@@', () => css)
    .replace('@@LIBS@@', () => libs)
    .replace('@@SCRIPT@@', () => script);

// Online build: libraries and the font come from public CDNs.
writeFileSync(join(root, 'index.html'), fill(read('src/libs.online.html')));

// Offline build: libraries come from vendor/ and the web font is dropped.
const offline = fill(read('src/libs.offline.html'))
  .replace('<link rel="preconnect" href="https://fonts.googleapis.com">\n', '')
  .replace('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap">\n', '');
writeFileSync(join(root, 'index.offline.html'), offline);

console.log('built index.html and index.offline.html');
