export const MODEL = 'gemini-3.5-flash-lite';

export const limits = Object.freeze({
  filesPerMessage: 3,
  fileBytes: 5 * 1024 * 1024,
  requestFileBytes: 10 * 1024 * 1024,
  messageCharacters: 10_000,
  documentBytes: 128 * 1024,
  promptBytes: 768 * 1024,
  concurrentGenerations: 2,
});

export function loadConfig(environment = process.env) {
  const port = Number(environment.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const apiKey = environment.GEMINI_API_KEY?.trim();
  return {
    apiKey: apiKey && apiKey !== 'your_gemini_api_key_here' ? apiKey : undefined,
    model: MODEL,
    secret: environment.SECRET,
    templatePath: environment.DOCUMENT_TEMPLATE || 'back-end/data/sample.template.txt',
    documentPath: environment.DOCUMENT_FILE || 'back-end/.private/team-document.txt',
    auditPath: 'back-end/.private/audit.jsonl',
    host: environment.HOST || '127.0.0.1',
    port,
  };
}
