// Build eclipse.html: inline the astronomy-engine bundle into eclipse.src.html.
// Gates on a syntax check of the app script first — a stray apostrophe in a template
// literal once shipped a blank page, so the build refuses to write on parse errors.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const SRC = path.join(DIR, 'eclipse.src.html');
const LIB = path.join(DIR, 'astronomy.browser.min.js');
const OUT = path.join(DIR, 'eclipse.html');

let html = fs.readFileSync(SRC, 'utf8');

// --- syntax gate on the app's own <script> block (the last one in the file) ---
const i = html.lastIndexOf('<script>');
const j = html.indexOf('</script>', i);
if (i < 0 || j < 0) throw new Error('app <script> block not found');
const appJs = html.slice(i + '<script>'.length, j);
const tmp = path.join(require('os').tmpdir(), 'eclipse-appjs-check.js');
fs.writeFileSync(tmp, appJs);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (e) {
  console.error(e.stderr.toString());
  throw new Error('BUILD ABORTED — syntax error in app script (see above)');
}
fs.unlinkSync(tmp);

// --- inline the library ---
if (!html.includes('/*INLINE_ASTRONOMY*/')) throw new Error('INLINE_ASTRONOMY marker missing');
html = html.replace('/*INLINE_ASTRONOMY*/', () => fs.readFileSync(LIB, 'utf8'));
fs.writeFileSync(OUT, html);
console.log('built eclipse.html —', fs.statSync(OUT).size, 'bytes (syntax OK)');
