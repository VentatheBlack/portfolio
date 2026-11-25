// Run with: npm run build && npm run check
// Looks at the finished site and reports PASS or FAIL for the important things.
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
let failed = 0;
const LEFTOVERS = ['PROJECT' + '_NAME', 'GITHUB' + '_USERNAME', 'REPO' + '_NAME'];
const hasLeftover = (text) => LEFTOVERS.some((word) => text.includes(word));

function report(name, pass, detail = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!pass) failed++;
}

function warn(message) {
  console.log(`WARN  ${message}`);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.log('FAIL  dist/index.html does not exist. Run "npm run build" first.');
  process.exit(1);
}

const html = await readFile(join(DIST, 'index.html'), 'utf8');
const htmlKb = Math.round(Buffer.byteLength(html) / 1024);
report('Home page HTML is small (under 80 KB)', htmlKb < 80, `${htmlKb} KB`);
report('CSS is inside the page (no separate stylesheet)', !/<link[^>]+rel=["']stylesheet["']/i.test(html));

const scripts = [...html.matchAll(/<script\b[^>]*>/gi)];
report('No visitor JavaScript files to download', !scripts.some((m) => /\ssrc=/i.test(m[0])), `${scripts.length} inline script(s)`);
report('At most 2 small inline scripts', scripts.length <= 2);

const images = [...html.matchAll(/<img\b[^>]*>/gi)];
const imagesOk = images.every((m) => /\salt=/i.test(m[0]) && /\swidth=/i.test(m[0]) && /\sheight=/i.test(m[0]));
report('Every image has alt, width and height', imagesOk, `${images.length} image(s)`);

report('Pop-up video player is on the page', html.includes('id="player"'));
report('Showreel hero is on the page', /class="[^"]*hero/.test(html));
report('About section is on the page', html.includes('id="about"'));
report('Services section is on the page', html.includes('id="services"'));
report('Work section is on the page', html.includes('id="work"'));
report('Contact section is on the page', html.includes('id="contact"'));
report('Five Work tabs are available', (html.match(/<button[^>]+role="tab"/g) || []).length === 5);
report('Case studies are inside the Work tabs', html.includes('>Case studies<'));
report('Empty Work tabs have intentional placeholders', html.includes('Projects coming soon'));
report('Work cards use a responsive grid', html.includes('class="work-grid'));
report('Styled direthecreative wordmark is present', html.includes('class="brand-word"'));
report('Contact background image is present', html.includes('class="contact-background"'));
report('Reduced motion is supported', html.includes('prefers-reduced-motion'));

const cards = (html.match(/data-vimeo-id=/g) || []).length;
const pictureCards = (html.match(/data-image=/g) || []).length;
console.log(`INFO  ${cards} video card(s) and ${pictureCards} thumbnail card(s) on the page${cards + pictureCards === 0 ? ' (ready to add through /admin)' : ''}`);

const casesDir = fileURLToPath(new URL('../src/data/cases/', import.meta.url));
let caseCount = 0;
if (existsSync(casesDir)) caseCount = (await readdir(casesDir)).filter((name) => name.endsWith('.json')).length;
let casePages = 0;
const workDir = join(DIST, 'work');
if (existsSync(workDir)) {
  for (const entry of await readdir(workDir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(join(workDir, entry.name, 'index.html'))) casePages++;
  }
}
report('Every case file has its own page', casePages === caseCount, `${caseCount} case file(s), ${casePages} page(s)`);

report('No leftover [[placeholder]] text', !html.includes('[['));
report('No leftover placeholder words', !hasLeftover(html));
report('Admin page exists', existsSync(join(DIST, 'admin', 'index.html')));
report('Admin config exists', existsSync(join(DIST, 'admin', 'config.yml')));
report('_headers file exists', existsSync(join(DIST, '_headers')));
report('Login functions exist',
  existsSync(fileURLToPath(new URL('../functions/auth.js', import.meta.url))) &&
  existsSync(fileURLToPath(new URL('../functions/callback.js', import.meta.url))));

const adminConfigPath = join(DIST, 'admin', 'config.yml');
if (existsSync(adminConfigPath)) {
  const config = await readFile(adminConfigPath, 'utf8');
  report('Admin config has no placeholder words', !hasLeftover(config));
  report('Admin config has no tab characters', !/\t/.test(config));
  report('Admin config has all four editing areas', ['name: site', 'name: services', 'name: work', 'name: cases'].every((word) => config.includes(word)));
}

const astroConfig = await readFile(fileURLToPath(new URL('../astro.config.mjs', import.meta.url)), 'utf8');
report('Astro config has the real project name', !hasLeftover(astroConfig));
report('robots.txt exists', existsSync(join(DIST, 'robots.txt')));

const files = await walk(DIST);
const sizes = [];
for (const file of files) sizes.push({ file: file.replace(DIST, ''), bytes: (await stat(file)).size });
sizes.sort((a, b) => b.bytes - a.bytes);
const MAX = 25 * 1024 * 1024;
report('No file bigger than 25 MiB', sizes.every((s) => s.bytes < MAX));
for (const s of sizes) {
  const path = s.file.replace(/\\/g, '/');
  if (!path.startsWith('/uploads/')) continue;
  const isLoop = /\.(gif|mp4|webm)$/i.test(path);
  const limit = isLoop ? 2 * 1024 * 1024 : 1024 * 1024;
  if (s.bytes > limit) warn(`${path} is ${(s.bytes / 1024 / 1024).toFixed(1)} MB. Keep ${isLoop ? 'loops under 2 MB' : 'pictures under 1 MB'}.`);
}
const totalKb = Math.round(sizes.reduce((sum, s) => sum + s.bytes, 0) / 1024);
console.log(`INFO  ${files.length} files, ${totalKb} KB in total. Biggest files:`);
for (const s of sizes.slice(0, 5)) console.log(`        ${Math.round(s.bytes / 1024)} KB  ${s.file}`);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
