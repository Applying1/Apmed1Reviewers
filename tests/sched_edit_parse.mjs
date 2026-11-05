import fs from 'node:fs';

const file = new URL('../schedule-edit.html', import.meta.url);
const html = fs.readFileSync(file, 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, n = 0, failed = 0;

while ((m = re.exec(html))) {
  const attrs = m[1] || '';
  if (/\bsrc\s*=/i.test(attrs)) continue;
  n++;
  const body = m[2] || '';
  try {
    new Function(body);
  } catch (e) {
    failed++;
    const first = body.trim().split(/\r?\n/)[0].slice(0, 80);
    console.error('Inline script ' + n + ' failed to parse: ' + e.message);
    console.error('  starts with: ' + first);
  }
}

if (failed) process.exit(1);
console.log('OK ' + n + ' scripts');
