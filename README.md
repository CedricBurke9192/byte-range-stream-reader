# byte-range-stream-reader

Reads a specific byte offset and length from a file using Node's `createReadStream` `start` and `end` options, without loading the whole file into memory.

## Usage

```js
import { ByteRangeStreamReader, collectStreamData } from 'byte-range-stream-reader';
import { writeFileSync } from 'node:fs';

// Class API — bind a file path once, read many ranges.
const filePath = '/tmp/large.bin';
writeFileSync(filePath, 'abcdefghijklmnopqrstuvwxyz');
const reader = new ByteRangeStreamReader(filePath);
const bytes = await reader.read(10, 5); // Buffer of 5 bytes starting at offset 10

// Functional API — one-shot read.
const same = await collectStreamData(filePath, 10, 5);
```

## Why

Reading a small slice of a large file should not require buffering megabytes through memory. Node's `fs.createReadStream` accepts `start` and `end` options that cause it to fetch only the requested region from disk, so we delegate to it directly and drain the stream into a single `Buffer`.

The trade-off: we still accumulate the full range in memory before resolving. That is fine for small slices (which is the intended use); if you need to stream gigabytes through a transform pipeline, use `createReadStream` yourself instead of this library.

## Edge cases

- `createReadStream`'s `end` option is **inclusive**, not exclusive. This library computes `end = start + length - 1` so that `length` bytes are read. A zero-length read is short-circuited to return an empty `Buffer` without touching the filesystem (otherwise `start === end` would read one byte).
- If the requested range extends past EOF, Node returns only the bytes that exist. This library resolves with that shorter `Buffer` rather than rejecting — callers who need exactly `length` bytes should check `buf.length`.
- Non-integer or negative `start`/`length` throw `TypeError` before any I/O is attempted.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

