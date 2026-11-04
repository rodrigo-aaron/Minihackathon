import { readFileSync } from 'node:fs';
import { loadConfig, MODEL } from '../src/config.js';
import { SecretVerifier } from '../src/SecretVerifier.js';
import { ReferenceDocument } from '../src/ReferenceDocument.js';

try {
  const config = loadConfig();
  new SecretVerifier(config.secret);
  const original = readFileSync(config.documentTemplate);
  const document = new ReferenceDocument({ original, secret: config.secret });
  document.assertIncluded([{ role: 'user', parts: [document.documentPart()] }]);
  const suppliedPath = process.argv[2];
  if (suppliedPath && !Buffer.from(document.documentPart().text, 'utf8').equals(readFileSync(suppliedPath))) {
    throw new Error('The reconstructed document differs from the supplied standard file.');
  }
  console.log(JSON.stringify({ integrity: 'passed', fullFileIncluded: true,
    matchesSuppliedFile: suppliedPath ? true : undefined, ...document.metadata(), model: MODEL }));
} catch (error) {
  console.error(error.code === 'ENOENT' ? 'Standard file not found.' : error.message);
  process.exitCode = 1;
}
