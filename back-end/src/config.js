import { fileURLToPath } from 'node:url';

export const MODEL = 'gemini-3.5-flash-lite';

export const limits = Object.freeze({
  filesPerMessage: 3,
  fileBytes: 5 * 1024 * 1024,
  requestFileBytes: 10 * 1024 * 1024,
  messageCharacters: 10_000,
  documentBytes: 128 * 1024,
  // Base64 expands the permitted 10 MB of binary attachments by about one third.
  promptBytes: 15 * 1024 * 1024,
  concurrentGenerations: 15,
});

export function loadConfig(environment = process.env) {
  const port = Number(environment.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const apiKey = environment.GEMINI_API_KEY?.trim();
  const secret = environment.SECRET;
  if (!secret) throw new Error('SECRET is required. Run npm run setup.');
  const trustProxy = Number(environment.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0) throw new Error('TRUST_PROXY_HOPS must be a nonnegative integer.');
  const isCloud = Boolean(environment.NODE_ENV === 'production' || environment.RENDER || environment.RAILWAY_ENVIRONMENT || environment.FLY_APP_NAME);
  return {
    apiKey: apiKey && apiKey !== 'your_gemini_api_key_here' ? apiKey : undefined,
    secret,
    documentTemplate: environment.DOCUMENT_TEMPLATE?.trim()
      || fileURLToPath(new URL('../data/standard.template.txt', import.meta.url)),
    trustProxy,
    host: environment.HOST || (isCloud ? '0.0.0.0' : '127.0.0.1'),
    port,
  };
}
