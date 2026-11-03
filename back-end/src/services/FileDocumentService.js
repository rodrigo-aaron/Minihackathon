import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { limits } from '../config.js';
import { MARKER } from './SecretService.js';

function isPdfBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function isValidUtf8(buffer) {
  return Buffer.isBuffer(buffer) && Buffer.from(buffer.toString('utf8'), 'utf8').equals(buffer);
}

export class FileDocumentService {
  #bytes;
  #text;
  #mimeType;
  #sha256;
  #paragraphs;

  constructor({ original = null, populated = null, secretService } = {}) {
    this.#bytes = null;
    this.#text = '';
    this.#mimeType = null;
    this.#sha256 = null;
    this.#paragraphs = [];

    if (!original && !populated) {
      return;
    }

    const activeBuffer = populated || original;
    if (isPdfBuffer(activeBuffer)) {
      if (activeBuffer.length > limits.fileBytes) {
        throw new Error('The PDF document must be at most 5 MB.');
      }
      this.#bytes = Buffer.from(activeBuffer);
      this.#mimeType = 'application/pdf';
      this.#sha256 = createHash('sha256').update(this.#bytes).digest('hex');
      return;
    }

    let protectedStart = -1;
    let protectedEnd = -1;

    if (original && Buffer.isBuffer(original) && original.includes(Buffer.from(MARKER))) {
      if (original.length > limits.documentBytes) {
        throw new Error('The original UTF-8 document must be at most 128 KB.');
      }
      if (!isValidUtf8(original)) throw new Error('Document must be UTF-8.');
      const expected = secretService.substitute(original);
      if (populated) {
        if (!Buffer.isBuffer(populated) || !expected.bytes.equals(populated)) {
          throw new Error('Document integrity failed: only the secret placeholder may be replaced. Run npm run document:prepare after an intentional configuration change.');
        }
      }
      this.#bytes = Buffer.from(expected.bytes);
      protectedStart = expected.protectedStart;
      protectedEnd = expected.protectedEnd;
    } else if (Buffer.isBuffer(activeBuffer)) {
      if (activeBuffer.length > limits.documentBytes) {
        throw new Error('The UTF-8 document must be at most 128 KB.');
      }
      if (!isValidUtf8(activeBuffer)) throw new Error('Document must be UTF-8 or PDF.');
      this.#bytes = Buffer.from(activeBuffer);
    } else {
      throw new Error('Invalid document buffer.');
    }

    this.#mimeType = 'text/plain';
    this.#text = this.#bytes.toString('utf8');
    this.#sha256 = createHash('sha256').update(this.#bytes).digest('hex');

    let sourceIndex = 0;
    for (const match of this.#text.matchAll(/[^\r\n][\s\S]*?(?=\r?\n[\t ]*\r?\n|$)/g)) {
      const start = Buffer.byteLength(this.#text.slice(0, match.index));
      const end = start + Buffer.byteLength(match[0]);
      const protectedParagraph = protectedStart >= 0 && start < protectedEnd && end > protectedStart;
      this.#paragraphs.push(Object.freeze({
        id: `p${String(++sourceIndex).padStart(4, '0')}`,
        text: match[0].trim(),
        protected: protectedParagraph,
      }));
    }
  }

  static fromPaths({ templatePath, documentPath, secretService }) {
    const hasTemplate = Boolean(templatePath && existsSync(templatePath));
    const hasPopulated = Boolean(documentPath && existsSync(documentPath));

    if (!hasTemplate && !hasPopulated) {
      return new FileDocumentService({ secretService });
    }

    const original = hasTemplate ? readFileSync(templatePath) : null;
    let populated = hasPopulated ? readFileSync(documentPath) : null;

    // If template has [REPLACE_WITH_YOUR_TEAM_SECRET] and SECRET changed or documentPath isn't built yet,
    // automatically synchronize documentPath inside .private/ so startup never crashes.
    if (original && !isPdfBuffer(original) && original.includes(Buffer.from(MARKER))) {
      const expected = secretService.substitute(original).bytes;
      if (!populated || !expected.equals(populated)) {
        if (documentPath) {
          const target = resolve(documentPath);
          const privateRoot = resolve('back-end/.private');
          const suffix = relative(privateRoot, target);
          if (suffix && !suffix.startsWith('..') && !isAbsolute(suffix)) {
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, expected, { mode: 0o600 });
          }
        }
        populated = expected;
      }
    }

    return new FileDocumentService({ original, populated, secretService });
  }

  hasDocument() {
    return Boolean(this.#bytes);
  }

  mimeType() {
    return this.#mimeType;
  }

  byteLength() {
    return this.#bytes ? this.#bytes.length : 0;
  }

  sha256() {
    return this.#sha256;
  }

  fullText() {
    return this.#text;
  }

  documentPart() {
    if (!this.#bytes) return null;
    if (this.#mimeType === 'application/pdf') {
      return { inlineData: { mimeType: 'application/pdf', data: this.#bytes.toString('base64') } };
    }
    return { text: this.#text };
  }

  assertIncluded(contents) {
    if (!this.#bytes) return;
    const first = contents?.[0];
    if (first?.role !== 'user') {
      throw new Error('Full-document input invariant failed.');
    }
    const part = first.parts?.[1];
    if (this.#mimeType === 'application/pdf') {
      const actual = part?.inlineData?.mimeType === 'application/pdf' && part?.inlineData?.data
        ? Buffer.from(part.inlineData.data, 'base64')
        : null;
      if (!actual || !actual.equals(this.#bytes)) {
        throw new Error('Full-document PDF input invariant failed.');
      }
      return;
    }
    if (!Buffer.from(part?.text || '', 'utf8').equals(this.#bytes)) {
      throw new Error('Full-document input invariant failed.');
    }
  }

  publicParagraphs() {
    return this.#paragraphs.filter((paragraph) => !paragraph.protected)
      .map(({ id, text }) => ({ id, text }));
  }
}
