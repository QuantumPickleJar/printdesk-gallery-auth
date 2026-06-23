const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeFileName, buildEntry, mergeEntry } = require('../src/gallery');

test('sanitizeFileName strips unsafe chars', () => {
  assert.equal(sanitizeFileName('../my image?.png'), 'my-image-.png');
});

test('sanitizeFileName removes leading dots', () => {
  assert.equal(sanitizeFileName('...secret.stl'), 'secret.stl');
});

test('buildEntry parses tags and preserves attachment', () => {
  const entry = buildEntry({ title: 'Cube', tags: 'a, b, c' }, ['assets/gallery/cube/a.png'], 'assets/gallery-attachments/cube/cube.stl', 'cube');
  assert.equal(entry.id, 'cube');
  assert.deepEqual(entry.tags, ['a', 'b', 'c']);
  assert.equal(entry.attachment, 'assets/gallery-attachments/cube/cube.stl');
});

test('mergeEntry updates existing entry by id', () => {
  const existing = JSON.stringify({ entries: [{ id: 'cube', title: 'Old' }] });
  const merged = mergeEntry(existing, { id: 'cube', title: 'New' });
  const parsed = JSON.parse(merged);
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].title, 'New');
});
