// Run once with: node scripts/make-platforms.mjs
// Writes src/lib/platforms.js: the platform logos stored inside the project,
// so nothing is downloaded when the page opens. Needs: npm install --save-dev simple-icons@16
import * as si from 'simple-icons';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const badge = [
  ['youtube', 'YouTube', si.siYoutube],
  ['tiktok', 'TikTok', si.siTiktok],
  ['instagram', 'Instagram', si.siInstagram],
  ['spotify', 'Spotify', si.siSpotify],
  ['applepodcasts', 'Apple Podcasts', si.siApplepodcasts],
  ['facebook', 'Facebook', si.siFacebook],
  ['x', 'X', si.siX],
];

for (const [key, , icon] of badge) {
  if (!icon || !icon.path) {
    console.error(`The icon for "${key}" was not found in simple-icons. Stop and tell the user.`);
    process.exit(1);
  }
}
if (!si.siWhatsapp || !si.siWhatsapp.path) {
  console.error('The icon for "whatsapp" was not found in simple-icons. Stop and tell the user.');
  process.exit(1);
}

let out = `// Platform logos, stored in the project so nothing is downloaded when the page opens.
// Logo shapes come from the Simple Icons set (public domain). The logos belong to their owners
// and are used here only to show where a video can also be watched.
// Every icon is drawn on a 24 x 24 grid and coloured by the page (fill="currentColor").
//
// To add another platform: add one more entry to PLATFORMS with a short lowercase key,
// the name shown to people, and the icon path. Then add the same key to the "Also on" lists
// in public/admin/config.yml.

export const PLATFORMS = {\n`;
for (const [key, label, icon] of badge) {
  out += `  ${key}: {\n    label: ${JSON.stringify(label)},\n    path: ${JSON.stringify(icon.path)},\n  },\n`;
}
out += `};

// Icons used only for contact links (not for tagging videos).
export const EXTRA_ICONS = {
  whatsapp: {
    label: 'WhatsApp',
    path: ${JSON.stringify(si.siWhatsapp.path)},
  },
  email: {
    label: 'Email',
    path: 'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v.4l-10 6.2L2 6.4V6zm0 2.8V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8.8l-9.5 5.9a1 1 0 0 1-1 0L2 8.8z',
  },
};

// Looks up an icon by key. Returns null for an unknown key.
export function getIcon(key) {
  return PLATFORMS[key] || EXTRA_ICONS[key] || null;
}
`;

writeFileSync(fileURLToPath(new URL('../src/lib/platforms.js', import.meta.url)), out);
console.log('Wrote src/lib/platforms.js');
