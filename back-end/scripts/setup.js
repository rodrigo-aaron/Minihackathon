import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { loadConfig } from '../src/config.js';
import { SecretVerifier } from '../src/SecretVerifier.js';
import { ReferenceDocument } from '../src/ReferenceDocument.js';

const envPath = resolve('.env');
const defaultEnvironment = [
  'GEMINI_API_KEY=',
  'SECRET=',
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

new ReferenceDocument({ original: readFileSync(config.documentTemplate), secret: config.secret });
console.log('Private configuration prepared; standard file validated.');
