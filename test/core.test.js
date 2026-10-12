import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ByteRangeStreamReader, collectStreamData } from '../src/index.js';

const tmpRoot = join(tmpdir(), 'byte-range-stream-reader-tests');

function setupFixtures() {
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(tmpRoot, { recursive: true });

  // 26 bytes: positions 0..25 each holding the letter at that index.
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  const alphaPath = join(tmpRoot, 'alphabet.txt');
  writeFileSync(alphaPath, alpha, 'utf8');

  const emptyPath = join(tmpRoot, 'empty.bin');
  writeFileSync(emptyPath, Buffer.alloc(0));

  // 5 bytes of explicit binary values.
  const binPath = join(tmpRoot, 'data.bin');
  writeFileSync(binPath, Buffer.from([0, 1, 2, 255, 254]));

  return { alphaPath, emptyPath, binPath };
}

const { alphaPath, emptyPath, binPath } = setupFixtures();

test('ByteRangeStreamReader reads a middle range', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  const buf = await reader.read(10, 5);
  assert.equal(buf.toString('utf8'), 'klmno');
});

test('ByteRangeStreamReader reads from start', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  const buf = await reader.read(0, 5);
  assert.equal(buf.toString('utf8'), 'abcde');
});

test('ByteRangeStreamReader reads to end exactly', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  const buf = await reader.read(20, 6);
  assert.equal(buf.toString('utf8'), 'uvwxyz');
});

test('ByteRangeStreamReader range past EOF returns fewer bytes', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  const buf = await reader.read(24, 10);
  assert.equal(buf.length, 2);
  assert.equal(buf.toString('utf8'), 'yz');
});

test('ByteRangeStreamReader zero-length read returns empty buffer', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  const buf = await reader.read(5, 0);
  assert.equal(buf.length, 0);
});

test('ByteRangeStreamReader zero-length read at offset 0 returns empty buffer', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  const buf = await reader.read(0, 0);
  assert.equal(buf.length, 0);
});

test('ByteRangeStreamReader read from empty file returns empty buffer', async () => {
  const reader = new ByteRangeStreamReader(emptyPath);
  const buf = await reader.read(0, 5);
  assert.equal(buf.length, 0);
});

test('ByteRangeStreamReader rejects negative start', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  await assert.rejects(() => reader.read(-1, 5), TypeError);
});

test('ByteRangeStreamReader rejects negative length', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  await assert.rejects(() => reader.read(0, -1), TypeError);
});

test('ByteRangeStreamReader rejects non-integer start', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  await assert.rejects(() => reader.read(1.5, 5), TypeError);
});

test('ByteRangeStreamReader rejects non-integer length', async () => {
  const reader = new ByteRangeStreamReader(alphaPath);
  await assert.rejects(() => reader.read(0, 1.5), TypeError);
});

test('ByteRangeStreamReader preserves binary byte values', async () => {
  const reader = new ByteRangeStreamReader(binPath);
  const buf = await reader.read(0, 5);
  assert.deepEqual(Array.from(buf), [0, 1, 2, 255, 254]);
});

test('ByteRangeStreamReader constructor rejects empty path', () => {
  assert.throws(() => new ByteRangeStreamReader(''), TypeError);
});

test('ByteRangeStreamReader read on missing file rejects with ENOENT', async () => {
  const reader = new ByteRangeStreamReader(join(tmpRoot, 'does-not-exist.bin'));
  await assert.rejects(() => reader.read(0, 10), (err) => err.code === 'ENOENT');
});

test('collectStreamData standalone function reads a range', async () => {
  const buf = await collectStreamData(alphaPath, 5, 3);
  assert.equal(buf.toString('utf8'), 'fgh');
});

test('collectStreamData returns a Buffer instance', async () => {
  const buf = await collectStreamData(alphaPath, 0, 4);
  assert.ok(Buffer.isBuffer(buf));
});

test('collectStreamData zero-length returns empty Buffer and is a Buffer', async () => {
  const buf = await collectStreamData(alphaPath, 3, 0);
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.length, 0);
});

test('collectStreamData range entirely past EOF returns empty buffer', async () => {
  const buf = await collectStreamData(alphaPath, 100, 5);
  assert.equal(buf.length, 0);
});
