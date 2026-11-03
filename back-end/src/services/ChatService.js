import { randomUUID } from 'node:crypto';
import { limits, MODEL } from '../config.js';
import { HttpError } from '../errors/HttpError.js';

export class ChatService {
  #active = 0;

  constructor({ geminiService, documentService, attachmentService, inputPolicy, promptBuilder, responsePolicy, renderer, outputGuard, auditService }) {
    Object.assign(this, { geminiService, documentService, attachmentService, inputPolicy, promptBuilder, responsePolicy, renderer, outputGuard, auditService });
  }

  get configured() { return this.geminiService.configured; }

  async send(message, files) {
    let generating = false;
    const requestId = randomUUID();
    const docMeta = {
      documentBytes: this.documentService?.byteLength?.() ?? 0,
      documentSha256: this.documentService?.sha256?.() ?? null,
    };
    try {
      const prepared = this.attachmentService.prepare(files);
      const prompt = message || 'Summarize the public facts in the provided document.';
      const inputText = [prompt, ...prepared.parts.map((part) => part.text || '')].join('\n');
      let reply = this.outputGuard.refusal();
      if (this.inputPolicy.classify(inputText) === 'allow' && this.outputGuard.safe(inputText)) {
        if (this.#active >= limits.concurrentGenerations) throw new HttpError(503, 'The model is busy. Try again shortly.');
        const contents = this.promptBuilder.build({
          message: prompt,
          attachmentParts: prepared.parts,
        });
        this.#active += 1;
        generating = true;
        let raw;
        try { raw = await this.geminiService.generate(contents); }
        catch (error) {
          this.auditService.record({
            requestId, model: MODEL, stage: 'llm', fullFileIncluded: true, ...docMeta,
            outcome: 'provider_error', providerStatus: error.providerStatus,
          });
          throw error;
        }
        const selection = this.responsePolicy.validate(raw);
        reply = this.renderer.render(selection);
        this.auditService.record({
          requestId, model: MODEL, stage: 'llm', fullFileIncluded: true, ...docMeta,
          outcome: selection?.decision === 'answer' ? 'answered' : selection?.decision === 'not_found' ? 'not_found' : 'refused',
        });
      } else {
        this.auditService.record({
          requestId, model: MODEL, stage: 'input_policy', fullFileIncluded: true, ...docMeta,
          outcome: 'refused',
        });
      }
      return this.outputGuard.protect(reply);
    } finally {
      if (generating) this.#active -= 1;
    }
  }
}
