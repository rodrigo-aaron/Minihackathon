import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { limits } from './config.js';

export const MARKER = '[REPLACE_WITH_YOUR_TEAM_SECRET]';

export function populateDocument(original, secret) {
  if (original.length > limits.documentBytes) throw new Error('Reference template must be at most 128 KB.');
  try { new TextDecoder('utf-8', { fatal: true }).decode(original); }
  catch { throw new Error('Reference template must be UTF-8 text. Export other formats to text before preparing it.'); }
  const marker = Buffer.from(MARKER);
  const start = original.indexOf(marker);
  if (start < 0 || original.indexOf(marker, start + marker.length) !== -1) {
    throw new Error('The reference template must contain exactly one secret placeholder.');
  }
  return Buffer.concat([original.subarray(0, start), Buffer.from(secret, 'utf8'), original.subarray(start + marker.length)]);
}

export class ReferenceDocument {
  #text;
  #bytes;

  constructor({ templatePath, documentPath, secret }) {
    const original = readFileSync(templatePath);
    const expected = populateDocument(original, secret);
    const prepared = readFileSync(documentPath);
    if (!prepared.equals(expected)) {
      throw new Error('Document integrity failed. Run npm run document:prepare after an intentional change.');
    }
    this.#bytes = prepared;
    this.#text = prepared.toString('utf8');
  }

  documentPart() { return { text: this.#text }; }

  metadata() {
    return { documentBytes: this.#bytes.length, documentSha256: createHash('sha256').update(this.#bytes).digest('hex') };
  }

  assertIncluded(contents) {
    const included = contents.some((content) => content.role === 'user'
      && content.parts.some((part) => typeof part.text === 'string'
        && Buffer.from(part.text, 'utf8').equals(this.#bytes)));
    if (!included) throw new Error('Complete reference document is missing from the model request.');
  }
}
