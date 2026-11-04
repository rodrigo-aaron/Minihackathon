import { readFileSync } from 'node:fs';
import { loadConfig, MODEL } from '../src/config.js';
import { SecretVerifier } from '../src/SecretVerifier.js';
import { ReferenceDocument } from '../src/ReferenceDocument.js';

try {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: npm run check:integrity -- path/to/standard-file.txt');
  const config = loadConfig();
  new SecretVerifier(config.secret);
  const original = readFileSync(path);
  const document = new ReferenceDocument({ original, secret: config.secret });
  document.assertIncluded([{ role: 'user', parts: [document.documentPart()] }]);
  console.log(JSON.stringify({ integrity: 'passed', fullFileIncluded: true, ...document.metadata(), model: MODEL }));
} catch (error) {
  console.error(error.code === 'ENOENT' ? 'Standard file not found.' : error.message);
  process.exitCode = 1;
}
