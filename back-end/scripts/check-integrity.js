import { loadConfig, MODEL } from '../src/config.js';
import { SecretVerifier } from '../src/SecretVerifier.js';
import { ReferenceDocument } from '../src/ReferenceDocument.js';

try {
  const config = loadConfig();
  new SecretVerifier(config.secret);
  const document = new ReferenceDocument(config);
  document.assertIncluded([{ role: 'user', parts: [document.documentPart()] }]);
  console.log(JSON.stringify({ integrity: 'passed', fullFileIncluded: true, ...document.metadata(), model: MODEL }));
} catch {
  console.error('Document integrity check failed. Check configuration and run npm run document:prepare after intentional changes.');
  process.exitCode = 1;
}
