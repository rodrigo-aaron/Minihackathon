import { limits } from './config.js';
import { HttpError } from './HttpError.js';

export class ChatService {
  #active = 0;

  constructor({ gemini, attachments, policy, createContext }) {
    this.gemini = gemini;
    this.attachments = attachments;
    this.policy = policy;
    this.createContext = createContext;
  }

  get configured() { return this.gemini.configured; }

  async answer(message, files = [], { mode = 'general', contextFile = null } = {}) {
    if (!['general', 'context'].includes(mode)) throw new HttpError(400, 'Invalid chat mode.');
    if (mode === 'context' && !contextFile) throw new HttpError(400, 'Hackathon file mode requires a standard file with every question.');
    if (mode === 'general' && contextFile) throw new HttpError(400, 'Enable Hackathon file mode to use a standard file.');
    if (message !== undefined && typeof message !== 'string') throw new HttpError(400, 'Message must be text.');
    const question = message?.trim() || '';
    if (question.length > limits.messageCharacters) throw new HttpError(400, `Messages can contain at most ${limits.messageCharacters} characters.`);
    if (!question && !files.length && !contextFile) throw new HttpError(400, 'Enter a message or attach a file.');
    const { parts, texts } = this.attachments.prepare(files);
    let referenceDocument = null;
    if (contextFile) {
      if (!/\.(txt|md)$/i.test(contextFile.originalname)
        || !contextFile.buffer.length || contextFile.buffer.length > limits.documentBytes) {
        throw new HttpError(400, 'The standard file must be a nonempty UTF-8 .txt or .md file, at most 128 KB.');
      }
      const text = this.attachments.decodeText(contextFile.buffer, 'standard file');
      texts.push(contextFile.originalname, text);
      try {
        // Work on a new buffer. The original browser file is never modified.
        referenceDocument = this.createContext(contextFile.buffer);
      } catch {
        throw new HttpError(400, 'The standard file must contain exactly one [REPLACE_WITH_YOUR_TEAM_SECRET] placeholder.');
      }
    }
    if (!this.policy.allowsDocument(texts.join('\n\n'))) {
      throw new HttpError(400, 'An attachment contains a possible prompt injection and was not sent to the chatbot. Remove it before trying again.');
    }
    const prompt = question || 'Summarize the public facts in the provided documents.';
    if (!this.policy.allows(prompt)) return this.policy.refusal();
    if (this.#active >= limits.concurrentGenerations) throw new HttpError(503, 'The model is busy. Try again shortly.');
    this.#active += 1;
    try {
      const raw = await this.gemini.generate({ message: prompt, attachmentParts: parts, referenceDocument });
      return this.policy.readReply(raw);
    } finally {
      this.#active -= 1;
    }
  }
}
