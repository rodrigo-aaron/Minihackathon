import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { loadConfig, MODEL } from '../src/config.js';
import { MARKER, SecretService } from '../src/services/SecretService.js';

const envPath = resolve('.env');
const defaultEnvironment = [
  'GEMINI_API_KEY=',
  `GEMINI_MODEL=${MODEL}`,
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
contents = contents.replace(/^GEMINI_MODEL\s*=.*$/gm, `GEMINI_MODEL=${MODEL}`);
if (!/^GEMINI_MODEL=/m.test(contents)) contents += `\nGEMINI_MODEL=${MODEL}\n`;
writeFileSync(envPath, contents, { mode: 0o600 });
process.loadEnvFile(envPath);
const config = loadConfig();
const secretService = new SecretService(config.secret);
if (config.templatePath && existsSync(config.templatePath)) {
  const original = readFileSync(config.templatePath);
  const target = resolve(config.documentPath);
  const privateRoot = resolve('back-end/.private');
  const suffix = relative(privateRoot, target);
  if (!suffix || suffix.startsWith('..') || isAbsolute(suffix)) {
    throw new Error('DOCUMENT_FILE must be inside the project .private directory.');
  }
  mkdirSync(dirname(target), { recursive: true });
  const isPdf = original.length >= 5 && original.subarray(0, 5).toString('ascii') === '%PDF-';
  const outputBytes = !isPdf && original.includes(Buffer.from(MARKER))
    ? secretService.substitute(original).bytes
    : original;
  writeFileSync(target, outputBytes, { mode: 0o600 });
}
console.log('Private SECRET configured; team document prepared. Existing API key was preserved.');
