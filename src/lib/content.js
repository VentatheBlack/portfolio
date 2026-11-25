// Helpers shared by the home page and the case pages.
// They turn the saved content (src/data/*.json) into exactly what the pages need.
import meta from '../data/vimeo-meta.json';
import { parseVimeo } from './vimeo.js';
import { PLATFORMS } from './platforms.js';

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Splits text on blank lines into paragraphs. Empty text gives an empty list.
export function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

// Looks up what the prepare script saved about one Vimeo video.
export function vimeoInfo(id) {
  return meta[id] || {};
}

// The person's social tag and the "also on" platforms, cleaned up. Used by videos and thumbnails.
function tagAndPlatforms(raw) {
  return {
    tag: String(raw.tag || '').trim(),
    tagLink: String(raw.tag_link || '').trim(),
    platforms: (raw.platforms || []).filter((key) => PLATFORMS[key]),
  };
}

// Builds one thumbnail picture (a normal image, not a Vimeo video) from a saved entry.
export function buildThumbnail(raw) {
  if (!raw || !raw.image) return null;
  return {
    title: raw.title || 'Thumbnail',
    image: raw.image,
    ...tagAndPlatforms(raw),
  };
}

// Builds one video for the page from a saved entry.
// shape is "wide" or "vertical" and is only used when Vimeo could not tell us the real size.
export function buildVideo(raw, shape = 'wide') {
  const parsed = parseVimeo(raw.vimeo);
  if (!parsed) return null;
  const info = vimeoInfo(parsed.id);
  const width = info.width || (shape === 'vertical' ? 1080 : 1920);
  const height = info.height || (shape === 'vertical' ? 1920 : 1080);
  return {
    title: raw.title || info.title || 'Video',
    note: raw.note || '',
    id: parsed.id,
    hash: parsed.hash,
    thumb: info.thumb || '',
    thumbWidth: info.thumbWidth || 960,
    thumbHeight: info.thumbHeight || 540,
    ratio: `${width} / ${height}`,
    ratioNumber: Number((width / height).toFixed(4)),
    ...tagAndPlatforms(raw),
  };
}

// Reads every file in src/data/cases/ (one file per case study).
export function loadCases() {
  const files = import.meta.glob('../data/cases/*.json', { eager: true });
  return Object.entries(files)
    .map(([path, module]) => {
      const data = module.default || module;
      const slug = path.split('/').pop().replace(/\.json$/, '');
      return { ...data, slug, order: Number(data.order) || 100 };
    })
    .filter((item) => item.title && parseVimeo(item.vimeo))
    .sort((a, b) => a.order - b.order || String(a.title).localeCompare(String(b.title)));
}
