// Runs before every build and every dev start (see package.json).
// For each Vimeo link it asks Vimeo for the video's size and thumbnail,
// saves the thumbnail into public/thumbs/, and writes src/data/vimeo-meta.json.
// If Vimeo cannot be reached, the build still works: that video shows a plain placeholder.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseVimeo } from '../src/lib/vimeo.js';

const SITE_FILE = fileURLToPath(new URL('../src/data/site.json', import.meta.url));
const WORK_FILE = fileURLToPath(new URL('../src/data/work.json', import.meta.url));
const CASES_DIR = fileURLToPath(new URL('../src/data/cases/', import.meta.url));
const META_FILE = fileURLToPath(new URL('../src/data/vimeo-meta.json', import.meta.url));
const THUMBS_DIR = fileURLToPath(new URL('../public/thumbs/', import.meta.url));

async function fetchWithTimeout(url, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'portfolio-build' } });
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(task, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function isImage(response) {
  return response && response.ok && String(response.headers.get('content-type') || '').startsWith('image/');
}

async function main() {
  await mkdir(THUMBS_DIR, { recursive: true });
  const links = [];

  async function readJson(file) {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      console.warn(`Vimeo: could not read ${file}: ${error.message}`);
      return null;
    }
  }

  const site = await readJson(SITE_FILE);
  if (site && site.showreel_vimeo) links.push({ link: site.showreel_vimeo, big: true });

  const work = await readJson(WORK_FILE);
  for (const section of (work && work.sections) || []) {
    for (const video of section.videos || []) links.push({ link: video.vimeo, big: false });
  }

  let caseFiles = [];
  try {
    caseFiles = (await readdir(CASES_DIR)).filter((name) => name.endsWith('.json'));
  } catch (error) {
    caseFiles = [];
  }
  for (const name of caseFiles) {
    const item = await readJson(CASES_DIR + name);
    if (item && item.vimeo) links.push({ link: item.vimeo, big: false });
  }

  const meta = {};
  let good = 0;
  let skipped = 0;
  let failed = 0;

  for (const { link, big } of links) {
    const parsed = parseVimeo(link);
    if (!parsed) {
      console.warn(`Vimeo: skipped, not a valid Vimeo link: ${link}`);
      skipped++;
      continue;
    }
    if (meta[parsed.id]) continue;

    const canonical = `https://vimeo.com/${parsed.id}${parsed.hash ? '/' + parsed.hash : ''}`;
    try {
      const response = await withRetry(() =>
        fetchWithTimeout(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(canonical)}`)
      );
      if (!response.ok) throw new Error(`Vimeo answered with status ${response.status}`);
      const info = await response.json();
      if (!info.thumbnail_url) throw new Error('Vimeo gave no thumbnail');

      const hasSize = info.width && info.height;
      const isWide = hasSize ? info.width >= info.height : true;
      const thumbWidth = big ? 1600 : isWide ? 960 : 640;
      const thumbHeight = hasSize ? Math.round((thumbWidth * info.height) / info.width) : Math.round((thumbWidth * 9) / 16);
      const bigger = info.thumbnail_url.replace(/_(\d+)x(\d+)(\.[a-z]+)?$/i, `_${thumbWidth}$3`);
      let imageResponse = null;
      if (bigger !== info.thumbnail_url) {
        try {
          imageResponse = await fetchWithTimeout(bigger);
        } catch (error) {
          imageResponse = null;
        }
      }
      if (!isImage(imageResponse)) imageResponse = await withRetry(() => fetchWithTimeout(info.thumbnail_url));
      if (!isImage(imageResponse)) throw new Error('Thumbnail download failed');

      const type = String(imageResponse.headers.get('content-type'));
      const ext = type.includes('webp') ? 'webp' : type.includes('png') ? 'png' : 'jpg';
      const file = `${parsed.id}.${ext}`;
      await writeFile(THUMBS_DIR + file, Buffer.from(await imageResponse.arrayBuffer()));

      meta[parsed.id] = {
        title: info.title || '',
        width: info.width || 0,
        height: info.height || 0,
        thumb: `/thumbs/${file}`,
        thumbWidth,
        thumbHeight,
      };
      good++;
    } catch (error) {
      console.warn(`Vimeo: could not load ${canonical} (${error.message}). A plain placeholder will be used.`);
      meta[parsed.id] = { title: '', width: 0, height: 0, thumb: '', thumbWidth: 0, thumbHeight: 0 };
      failed++;
    }
  }

  await writeFile(META_FILE, JSON.stringify(meta, null, 2) + '\n');
  console.log(`Vimeo: ${good} thumbnail(s) saved, ${failed} failed, ${skipped} skipped, ${links.length} link(s) found.`);
}

main().catch((error) => {
  console.warn('Vimeo: unexpected problem:', error.message);
  writeFile(META_FILE, '{}\n').then(() => process.exit(0));
});
