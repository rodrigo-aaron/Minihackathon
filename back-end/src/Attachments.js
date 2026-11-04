import { extname } from 'node:path';
import { limits } from './config.js';

const textExtensions = new Set([
  '.txt', '.md', '.csv', '.json', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx',
  '.html', '.css', '.xml', '.yaml', '.yml', '.log', '.py', '.sql',
]);

const binaryTypes = new Map([
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);

// Developed with the help of generative AI.
export class Attachments {
  prepare(files = []) {
    if (files.length > limits.filesPerMessage) {
      throw Object.assign(new Error(`Attach at most ${limits.filesPerMessage} files per message.`), { status: 400, expose: true });
    }
    const totalBytes = files.reduce((sum, file) => sum + file.buffer.length, 0);
    if (totalBytes > limits.requestFileBytes) {
      throw Object.assign(new Error('Attachments can total at most 10 MB per request.'), { status: 413, expose: true });
    }

    const parts = [];
    const texts = [];
    for (const file of files) {
      const name = file.originalname.split(/[\\/]/).pop().slice(0, 200);
      const extension = extname(name).toLowerCase();
      if (file.buffer.length === 0) {
        throw Object.assign(new Error(`The file "${name}" is empty.`), { status: 400, expose: true });
      }
      if (file.buffer.length > limits.fileBytes) {
        throw Object.assign(new Error('Each attachment must be 5 MB or smaller.'), { status: 413, expose: true });
      }

      if (textExtensions.has(extension)) {
        const content = this.decodeText(file.buffer, name);
        texts.push(name, content);
        parts.push({ text: `Attached file: ${JSON.stringify(name)}\n\n${content}` });
      } else if (binaryTypes.has(extension)) {
        this.validateSignature(file.buffer, extension, name);
        parts.push(
          { text: `Attached file: ${JSON.stringify(name)}` },
          { inlineData: { mimeType: binaryTypes.get(extension), data: file.buffer.toString('base64') } },
        );
      } else {
        throw Object.assign(new Error(`Unsupported file "${name}". Use a PDF, PNG, JPEG, WebP, or supported text/code file.`), { status: 415, expose: true });
      }
    }

    return { parts, texts };
  }

  decodeText(buffer, name) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (text.includes('\0')) throw new Error('Binary content');
      return text;
    } catch {
      throw Object.assign(new Error(`The file "${name}" must contain UTF-8 text.`), { status: 415, expose: true });
    }
  }

  validateSignature(buffer, extension, name) {
    let valid = false;
    switch (extension) {
      case '.pdf':
        valid = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
        break;
      case '.png':
        valid = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        break;
      case '.jpg':
      case '.jpeg':
        valid = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        break;
      case '.webp':
        valid = buffer.subarray(0, 4).toString('ascii') === 'RIFF'
          && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
        break;
    }
    if (!valid) throw Object.assign(new Error(`The contents of "${name}" do not match its file type.`), { status: 415, expose: true });
  }
}
