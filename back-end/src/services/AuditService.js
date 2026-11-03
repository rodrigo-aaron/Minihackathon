import { appendFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class AuditService {
  constructor(filePath = null) { this.filePath = filePath; this.events = []; }

  record({ requestId, model, stage = 'llm', fullFileIncluded, documentBytes, documentSha256, outcome, providerStatus }) {
    const event = {
      time: new Date().toISOString(), requestId, model, stage,
      fullFileIncluded: fullFileIncluded === true,
      outcome: ['answered', 'refused', 'not_found', 'provider_error'].includes(outcome) ? outcome : 'refused',
    };
    if (Number.isInteger(documentBytes) && documentBytes > 0) event.documentBytes = documentBytes;
    if (typeof documentSha256 === 'string' && documentSha256) event.documentSha256 = documentSha256;
    if (outcome === 'provider_error') event.providerStatus = Number.isInteger(providerStatus) ? providerStatus : null;
    this.events.push(event);
    if (this.events.length > 200) this.events.shift();
    if (this.filePath) {
      mkdirSync(dirname(this.filePath), { recursive: true });
      let size = 0;
      try { size = statSync(this.filePath).size; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (size > 1024 * 1024) writeFileSync(this.filePath, '');
      appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
    }
  }
}
