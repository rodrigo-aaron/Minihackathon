import { GoogleGenAI } from '@google/genai';
import { MODEL } from '../config.js';
import { HttpError } from '../errors/HttpError.js';
import { responseSchema } from '../security/ResponsePolicy.js';
import { systemInstruction } from './PromptBuilder.js';

export class GeminiService {
  constructor({ apiKey, client, documentService }) {
    this.documentService = documentService;
    this.client = client ?? (apiKey ? new GoogleGenAI({ apiKey, httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } } }) : null);
  }

  get configured() {
    return Boolean(this.client);
  }

  async generate(contents) {
    this.documentService.assertIncluded(contents);
    if (!this.configured) {
      throw new HttpError(503, 'Add GEMINI_API_KEY to your .env file, then restart the server.');
    }
    try {
      const response = await this.client.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          maxOutputTokens: 512,
          thinkingConfig: { thinkingLevel: 'MINIMAL' },
        },
      });

      // The draft is consumed only by ResponsePolicy; never expose provider content.
      return response.text || '';
    } catch (error) {
      if (error instanceof HttpError) throw error;
      const status = Number(error.status ?? error.code);
      const failure = (httpStatus, message) => Object.assign(new HttpError(httpStatus, message), {
        providerStatus: Number.isFinite(status) ? status : null,
      });
      if (status === 429) {
        throw failure(429, 'Gemini quota or rate limit reached. Check your API quota or try again later.');
      }
      if ([401, 403].includes(status)) {
        throw failure(502, 'Gemini rejected the API key or its permissions. Check your server configuration.');
      }
      if (status === 400 || status === 404) {
        throw failure(502, 'Gemini rejected the request. Check the pinned model and try a smaller or different attachment.');
      }
      throw failure(502, 'Could not get a reply from Gemini. Please try again.');
    }
  }
}
