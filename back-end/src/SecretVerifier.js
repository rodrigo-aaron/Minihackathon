import { createHash, timingSafeEqual } from 'node:crypto';

export class SecretVerifier {
  #digest;

  constructor(SECRET) {
    if (typeof SECRET !== 'string' || !SECRET.length || [...SECRET].length > 100
      || SECRET.trim() !== SECRET || /[\p{C}\[\]]/u.test(SECRET)
      || SECRET.normalize('NFKC').toLowerCase() === 'hello') {
      throw new Error('SECRET must be 1-100 printable characters, single-line, without brackets or surrounding whitespace, and cannot be Hello. Run npm run setup.');
    }

    this.#digest = this.digest(SECRET);
  }

  digest(value) {
    return createHash('sha256').update(value, 'utf8').digest();
  }

  verify(candidate) {
    if (candidate === 'Hello') return 'Hello';
    if (typeof candidate !== 'string' || Buffer.byteLength(candidate) > 1024) return 'Incorrect';
    return timingSafeEqual(this.#digest, this.digest(candidate)) ? 'Correct' : 'Incorrect';
  }
}
