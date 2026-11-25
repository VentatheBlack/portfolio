// Run with: npm run data
// Reads everything in src/data and explains problems in plain words.
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseVimeo } from '../src/lib/vimeo.js';
import { PLATFORMS } from '../src/lib/platforms.js';

const DATA = fileURLToPath(new URL('../src/data/', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
let problems = 0;

function problem(message) {
  console.log(`PROBLEM  ${message}`);
  problems++;
}

async function load(path, label) {
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    if (JSON.stringify(data).includes('[[')) problem(`${label} still has [[placeholder]] text in it`);
    return data;
  } catch (error) {
    problem(`${label} is missing or is not valid JSON (${error.message})`);
    return null;
  }
}

function checkPlatforms(list, label) {
  for (const key of list || []) {
    if (!PLATFORMS[key]) problem(`${label}: "${key}" is not a known platform. Known: ${Object.keys(PLATFORMS).join(', ')}`);
  }
}

function checkFile(path, label) {
  if (path && path.startsWith('/uploads/') && !existsSync(PUBLIC + path.slice(1))) {
    problem(`${label}: the file ${path} does not exist in public/uploads`);
  }
}

function checkHex(value, label) {
  if (value && !/^#[0-9a-f]{6}$/i.test(value)) problem(`${label} must be a six-digit hex colour such as #DCD0FF`);
}

const site = await load(DATA + 'site.json', 'site.json');
if (site) {
  if (!site.name) problem('site.json: "name" is empty');
  if (!site.email) problem('site.json: "email" is empty');
  if (site.showreel_vimeo && !parseVimeo(site.showreel_vimeo)) problem('site.json: showreel_vimeo is not a Vimeo link');
  if (site.theme && !['dark', 'light', 'auto'].includes(site.theme)) problem('site.json: theme must be dark, light or auto');
  checkHex(site.accent_primary, 'site.json accent_primary');
  checkHex(site.accent_secondary, 'site.json accent_secondary');
  checkFile(site.hero_media, 'site.json hero_media');
  checkFile(site.about_photo, 'site.json about_photo');
  checkFile(site.contact_background, 'site.json contact_background');
  for (const item of site.socials || []) {
    if (!PLATFORMS[item.platform]) problem(`site.json: social platform "${item.platform}" is not known`);
    if (!item.url) problem(`site.json: the ${item.platform} link has no web address`);
  }
}

const services = await load(DATA + 'services.json', 'services.json');
if (services) {
  if (!Array.isArray(services.items)) problem('services.json: "items" must be a list');
  for (const item of services.items || []) {
    if (!item.title) problem('services.json: a service has no title');
    checkFile(item.image, `services.json "${item.title}" image`);
  }
}

const work = await load(DATA + 'work.json', 'work.json');
let videoCount = 0;
let thumbCount = 0;
if (work) {
  if (!Array.isArray(work.sections)) problem('work.json: "sections" must be a list');
  for (const section of work.sections || []) {
    if (!section.title) problem('work.json: a tab has no title');
    if (section.shape && !['wide', 'vertical'].includes(section.shape)) problem(`work.json: tab "${section.title}" has a shape that is not wide or vertical`);
    for (const video of section.videos || []) {
      videoCount++;
      if (!parseVimeo(video.vimeo)) problem(`work.json: "${video.title}" in tab "${section.title}" does not have a valid Vimeo link`);
      checkPlatforms(video.platforms, `work.json "${video.title}"`);
    }
    for (const thumb of section.thumbnails || []) {
      thumbCount++;
      if (!thumb.image) problem(`work.json: thumbnail "${thumb.title}" has no picture`);
      checkFile(thumb.image, `work.json thumbnail "${thumb.title}"`);
      checkPlatforms(thumb.platforms, `work.json thumbnail "${thumb.title}"`);
    }
  }
}

let caseCount = 0;
let caseNames = [];
try {
  caseNames = (await readdir(DATA + 'cases/')).filter((name) => name.endsWith('.json'));
} catch (error) {
  caseNames = [];
}
for (const name of caseNames) {
  const item = await load(DATA + 'cases/' + name, `cases/${name}`);
  if (!item) continue;
  caseCount++;
  if (!item.title) problem(`cases/${name}: "title" is empty`);
  if (!parseVimeo(item.vimeo)) problem(`cases/${name}: "vimeo" is not a valid Vimeo link`);
  checkPlatforms(item.platforms, `cases/${name}`);
}

console.log(`INFO  ${videoCount} video(s), ${thumbCount} thumbnail(s), ${caseCount} case page(s), ${(services && services.items ? services.items.length : 0)} service(s)`);
console.log(problems ? `\n${problems} problem(s) found. Fix them, then run this again.` : '\nData looks good.');
process.exit(problems ? 1 : 0);
