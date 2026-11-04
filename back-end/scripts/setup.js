import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { loadConfig } from '../src/config.js';
import { SecretVerifier } from '../src/SecretVerifier.js';
import { populateDocument } from '../src/ReferenceDocument.js';

const envPath = resolve('.env');
const defaultEnvironment = [
  'GEMINI_API_KEY=',
  'SECRET=',
  'DOCUMENT_TEMPLATE=back-end/data/sample.template.txt',
  'DOCUMENT_FILE=back-end/.private/team-document.txt',
  'PORT=3000',
  'HOST=127.0.0.1',
  '',
].join('\n');
let contents = existsSync(envPath)
  ? readFileSync(envPath, 'utf8')
  : existsSync('.env.example')
    ? readFileSync('.env.example', 'utf8')
    : defaultEnvironment;
if (!/^SECRET[\t ]*=[\t ]*\S/m.test(contents)) {
  const SECRET = randomBytes(24).toString('base64url');
  contents = contents.replace(/^SECRET\s*=.*$/gm, '');
  contents += `\nSECRET=${SECRET}\n`;
}
writeFileSync(envPath, contents, { mode: 0o600 });
process.loadEnvFile(envPath);
const config = loadConfig();
new SecretVerifier(config.secret);

const original = readFileSync(config.templatePath);
const target = resolve(config.documentPath);
const privateRoot = resolve('back-end/.private');
const suffix = relative(privateRoot, target);
if (!suffix || suffix.startsWith('..') || isAbsolute(suffix)) {
  throw new Error('DOCUMENT_FILE must be inside back-end/.private.');
}
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, populateDocument(original, config.secret), { mode: 0o600 });
console.log('Private configuration and reference document prepared. Existing API key was preserved.');
