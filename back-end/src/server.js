import { readFileSync } from 'node:fs';

import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { SecretVerifier } from './SecretVerifier.js';
import { ReferenceDocument } from './ReferenceDocument.js';
import { Attachments } from './Attachments.js';
import { ChatPolicy } from './ChatPolicy.js';
import { GeminiClient } from './GeminiClient.js';
import { ChatService } from './ChatService.js';
import { RateLimiter } from './RateLimiter.js';

try {
  const config = loadConfig();
  const verifier = new SecretVerifier(config.secret);
  const policy = new ChatPolicy(config.secret);
  const referenceDocument = new ReferenceDocument({ original: readFileSync(config.documentTemplate), secret: config.secret });
  const gemini = new GeminiClient({ apiKey: config.apiKey, referenceDocument });
  const chat = new ChatService({ gemini, attachments: new Attachments(), policy });
  const app = createApp({ chat, verifier, policy, rateLimiter: new RateLimiter(), trustProxy: config.trustProxy });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Gemini chat is running at http://${config.host}:${config.port}`);
    if (!chat.configured) console.log('Set GEMINI_API_KEY and restart to enable replies.');
  });
  server.on('error', (error) => {
    console.error(`Could not start the server: ${error.code || 'unknown error'}`);
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { server.close(); server.closeIdleConnections(); });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
