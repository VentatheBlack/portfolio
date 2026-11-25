// Turns any Vimeo link into { id, hash }.
// Returns null if the text is not a Vimeo video link.
// "hash" is only used by unlisted videos. For normal videos it is an empty string.
export function parseVimeo(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text) return null;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch (error) {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null;

  const parts = url.pathname.split('/').filter(Boolean);

  // Embed links look like: player.vimeo.com/video/123456789?h=abc123def4
  if (host === 'player.vimeo.com') {
    if (parts[0] !== 'video' || !/^\d+$/.test(parts[1] || '')) return null;
    const hash = url.searchParams.get('h') || '';
    return { id: parts[1], hash: /^[a-z0-9]+$/i.test(hash) ? hash : '' };
  }

  // Normal links look like: vimeo.com/123456789
  // Unlisted links look like: vimeo.com/123456789/abc123def4
  // Some links have a folder first, like vimeo.com/showcase/1234567/video/987654321
  let idIndex = parts.findIndex(
    (part, i) => (parts[i - 1] === 'video' || parts[i - 1] === 'videos') && /^\d+$/.test(part)
  );
  if (idIndex === -1) idIndex = parts.findIndex((part) => /^\d+$/.test(part));
  if (idIndex === -1) return null;

  const id = parts[idIndex];
  const candidate = parts[idIndex + 1] || url.searchParams.get('h') || '';
  return { id, hash: /^[a-z0-9]{6,}$/i.test(candidate) ? candidate : '' };
}
