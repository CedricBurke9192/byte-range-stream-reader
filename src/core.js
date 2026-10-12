/**
 * Core implementation for reading byte ranges from a file via Node.js streams.
 */
import { createReadStream } from 'node:fs';
import { Buffer } from 'node:buffer';

/**
 * Reads a specific byte range from a file using createReadStream's start/end
 * options. Node streams emit data as chunks; this helper drains the stream
 * into a single Buffer without loading the *whole file* into memory — only
 * the requested range is fetched from disk.
 *
 * @param {string} filePath - Absolute or relative path to the file.
 * @param {number} start - Inclusive byte offset to begin reading from (0-based).
 * @param {number} length - Number of bytes to read.
 * @returns {Promise<Buffer>} Buffer of exactly the bytes read, or a shorter
 *   Buffer if the range extends past EOF (by design; see README).
 */
export async function collectStreamData(filePath, start, length) {
  if (!Number.isSafeInteger(start) || start < 0) {
    throw new TypeError(`start must be a non-negative safe integer; got ${String(start)}`);
  }
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new TypeError(`length must be a non-negative safe integer; got ${String(length)}`);
  }

  // length === 0: createReadStream with start===end reads one byte, so we
  // short-circuit instead and never touch the filesystem.
  if (length === 0) {
    return Buffer.alloc(0);
  }

  // createReadStream's `end` option is INCLUSIVE. To read `length` bytes
  // starting at `start`, the final byte index is start + length - 1.
  const end = start + length - 1;

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { start, end });
    const chunks = [];
    let totalBytes = 0;

    stream.on('data', (chunk) => {
      chunks.push(chunk);
      totalBytes += chunk.length;
    });

    stream.on('end', () => {
      const result = Buffer.concat(chunks, totalBytes);
      resolve(result);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Thin class wrapper around collectStreamData for callers who prefer an
 * object-oriented API or want to bind a file path once and read many ranges.
 */
export class ByteRangeStreamReader {
  /**
   * @param {string} filePath - Path to the file this reader is bound to.
   */
  constructor(filePath) {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new TypeError('filePath must be a non-empty string');
    }
    this.filePath = filePath;
  }

  /**
   * Reads `length` bytes starting at `start` from the bound file.
   *
   * @param {number} start - Inclusive byte offset (0-based, non-negative).
   * @param {number} length - Number of bytes to read (non-negative).
   * @returns {Promise<Buffer>} The bytes read; may be shorter than `length`
   *   if the range extends past EOF.
   */
  read(start, length) {
    return collectStreamData(this.filePath, start, length);
  }
}
