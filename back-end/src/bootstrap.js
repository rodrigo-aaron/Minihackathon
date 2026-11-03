import { Application } from './Application.js';
import { SecretService } from './services/SecretService.js';
import { FileDocumentService } from './services/FileDocumentService.js';
import { PublicEvidenceCatalog } from './services/PublicEvidenceCatalog.js';
import { AttachmentService } from './services/AttachmentService.js';
import { GeminiService } from './services/GeminiService.js';
import { PromptBuilder } from './services/PromptBuilder.js';
import { AnswerRenderer } from './services/AnswerRenderer.js';
import { AuditService } from './services/AuditService.js';
import { ChatService } from './services/ChatService.js';
import { OutputGuard } from './security/OutputGuard.js';
import { InputPolicy } from './security/InputPolicy.js';
import { ResponsePolicy } from './security/ResponsePolicy.js';

export function createServices({ secretService, documentService, apiKey, client, auditService = new AuditService() }) {
  const outputGuard = new OutputGuard(secretService);
  const catalog = new PublicEvidenceCatalog({ documentService, outputGuard });
  const promptBuilder = new PromptBuilder({ documentService });
  const geminiService = new GeminiService({ apiKey, client, documentService });
  const chatService = new ChatService({
    geminiService, documentService, attachmentService: new AttachmentService(), inputPolicy: new InputPolicy(),
    promptBuilder, responsePolicy: new ResponsePolicy(catalog),
    renderer: new AnswerRenderer({ catalog, outputGuard }), outputGuard, auditService,
  });
  return { secretService, documentService, catalog, outputGuard, promptBuilder, geminiService, chatService, auditService };
}

export function createApplication(config) {
  const secretService = new SecretService(config.secret);
  const documentService = FileDocumentService.fromPaths({ ...config, secretService });
  const services = createServices({ secretService, documentService, apiKey: config.apiKey, auditService: new AuditService(config.auditPath) });
  return new Application(services);
}
