import { createHash, timingSafeEqual } from 'node:crypto';

export const MARKER = '[REPLACE_WITH_YOUR_TEAM_SECRET]';

function canonical(text) {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function caesarShift(text, shift) {
  return text.replace(/[a-z]/gi, (character) => {
    const base = character <= 'Z' ? 65 : 97;
    return String.fromCharCode(((character.charCodeAt(0) - base + shift) % 26) + base);
  });
}

const COMMON_WORDS = new Set([
  'about', 'after', 'again', 'below', 'could', 'every', 'first', 'found', 'great', 'house',
  'large', 'learn', 'never', 'other', 'place', 'plant', 'point', 'right', 'small', 'sound',
  'spell', 'still', 'study', 'their', 'there', 'these', 'thing', 'think', 'three', 'water',
  'where', 'which', 'world', 'would', 'write', 'years', 'hello', 'secret', 'phrase', 'team',
]);

export class SecretService {
  #value;
  #lower;
  #digest;
  #signatures;
  #substrings;

  constructor(SECRET) {
    if (typeof SECRET !== 'string' || !SECRET.length || [...SECRET].length > 100
      || SECRET.trim() !== SECRET || /[\p{C}\[\]]/u.test(SECRET)
      || SECRET.normalize('NFKC').toLowerCase() === 'hello') {
      throw new Error('SECRET must be 1-100 printable characters, single-line, without brackets or surrounding whitespace, and cannot be Hello. Run npm run setup.');
    }
    this.#value = SECRET;
    this.#lower = SECRET.normalize('NFKC').toLowerCase();
    this.#digest = this.digest(SECRET);

    const shifts = [];
    for (let shift = 1; shift < 26; shift += 1) {
      shifts.push(caesarShift(SECRET, shift));
    }

    const asciiCodes = [...SECRET].map((character) => character.codePointAt(0));
    const binary = asciiCodes.map((code) => code.toString(2).padStart(8, '0')).join('');
    const hexSpaced = Buffer.from(SECRET, 'utf8').toString('hex');

    this.#signatures = [
      SECRET,
      [...SECRET].reverse().join(''),
      ...shifts,
      Buffer.from(SECRET).toString('base64'),
      Buffer.from(SECRET).toString('base64').replace(/=+$/, ''),
      Buffer.from(SECRET).toString('base64url'),
      hexSpaced,
      encodeURIComponent(SECRET),
      asciiCodes.join(','),
      asciiCodes.join(' '),
      binary,
    ].map(canonical).filter((sig) => sig.length >= 3);

    // Build partial-leak signatures: distinctive tokens (>= 4 chars) and sliding windows (>= 6 chars).
    const partialSet = new Set();
    const cleanCanonical = canonical(SECRET);
    const windowSize = Math.min(6, cleanCanonical.length);
    if (windowSize >= 4) {
      for (let i = 0; i <= cleanCanonical.length - windowSize; i += 1) {
        const slice = cleanCanonical.slice(i, i + windowSize);
        if (!COMMON_WORDS.has(slice)) {
          partialSet.add(slice);
          partialSet.add([...slice].reverse().join(''));
        }
      }
    }
    for (const token of this.#lower.split(/[^\p{L}\p{N}]+/u)) {
      if (token.length >= 4 && !COMMON_WORDS.has(token)) {
        partialSet.add(token);
        partialSet.add([...token].reverse().join(''));
      }
    }
    this.#substrings = [...partialSet];
  }

  digest(value) {
    return createHash('sha256').update(value, 'utf8').digest();
  }

  verify(candidate) {
    if (candidate === 'Hello') return 'Hello';
    if (typeof candidate !== 'string' || Buffer.byteLength(candidate) > 1024) return 'Incorrect';
    return timingSafeEqual(this.#digest, this.digest(candidate)) ? 'Correct' : 'Incorrect';
  }

  contains(text) {
    if (typeof text !== 'string' || !text) return false;
    const normalizedText = text.normalize('NFKC');
    if (normalizedText.includes(this.#value) || normalizedText.toLowerCase().includes(this.#lower)) {
      return true;
    }
    const compact = canonical(normalizedText);
    if (this.#signatures.some((signature) => compact.includes(signature))) {
      return true;
    }
    if (this.#substrings.some((part) => compact.includes(part))) {
      return true;
    }
    return false;
  }

  substitute(original) {
    const marker = Buffer.from(MARKER);
    const start = original.indexOf(marker);
    if (start < 0 || original.indexOf(marker, start + marker.length) !== -1) {
      throw new Error('The original document must contain exactly one secret placeholder.');
    }
    const secretBytes = Buffer.from(this.#value, 'utf8');
    return {
      bytes: Buffer.concat([original.subarray(0, start), secretBytes, original.subarray(start + marker.length)]),
      protectedStart: start,
      protectedEnd: start + secretBytes.length,
    };
  }
}
