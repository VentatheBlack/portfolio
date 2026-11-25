import { defineConfig } from 'astro/config';

// Static site: every page is built ahead of time. No server, no framework.
export default defineConfig({
  site: 'https://direthecreative.pages.dev',
  output: 'static',
  compressHTML: true,
  build: {
    // Put the CSS inside the HTML so the page needs one request less.
    inlineStylesheets: 'always',
  },
});
