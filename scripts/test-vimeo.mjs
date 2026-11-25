// Run with: npm test
// Checks that every kind of Vimeo link is understood.
import assert from 'node:assert/strict';
import { parseVimeo } from '../src/lib/vimeo.js';

const cases = [
  ['https://vimeo.com/123456789', { id: '123456789', hash: '' }],
  ['https://vimeo.com/123456789/abc123def4', { id: '123456789', hash: 'abc123def4' }],
  ['vimeo.com/123456789', { id: '123456789', hash: '' }],
  ['  https://www.vimeo.com/123456789  ', { id: '123456789', hash: '' }],
  ['https://vimeo.com/123456789?h=abc123def4', { id: '123456789', hash: 'abc123def4' }],
  ['https://player.vimeo.com/video/123456789?h=abc123def4', { id: '123456789', hash: 'abc123def4' }],
  ['https://player.vimeo.com/video/123456789', { id: '123456789', hash: '' }],
  ['https://vimeo.com/channels/staffpicks/123456789', { id: '123456789', hash: '' }],
  ['https://vimeo.com/showcase/1234567/video/987654321', { id: '987654321', hash: '' }],
  ['https://example.com/123456789', null],
  ['https://vimeo.com/', null],
  ['not a link', null],
  ['', null],
  [undefined, null],
];

let failed = 0;
for (const [input, expected] of cases) {
  try {
    assert.deepEqual(parseVimeo(input), expected);
    console.log('PASS ', JSON.stringify(input));
  } catch (error) {
    failed++;
    console.log('FAIL ', JSON.stringify(input), '->', JSON.stringify(parseVimeo(input)), 'expected', JSON.stringify(expected));
  }
}
console.log(failed ? `\n${failed} test(s) failed` : '\nAll tests passed');
process.exit(failed ? 1 : 0);
