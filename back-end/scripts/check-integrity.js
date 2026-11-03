import { loadConfig, MODEL } from '../src/config.js';
import { SecretService } from '../src/services/SecretService.js';
import { FileDocumentService } from '../src/services/FileDocumentService.js';

try {
  const config = loadConfig();
  const secretService = new SecretService(config.secret);
  const documentService = FileDocumentService.fromPaths({ ...config, secretService });
  const docPart = documentService.documentPart();
  const contents = [{ role: 'user', parts: [{ text: 'Full official file follows.' }, ...(docPart ? [docPart] : [])] }];
  documentService.assertIncluded(contents);
  console.log(JSON.stringify({
    integrity: 'passed',
    fullFileIncluded: documentService.hasDocument(),
    mimeType: documentService.mimeType(),
    documentBytes: documentService.byteLength(),
    documentSha256: documentService.sha256(),
    model: MODEL,
  }));
} catch {
  console.error('Document integrity check failed. Check private configuration and the original template.');
  process.exitCode = 1;
}
