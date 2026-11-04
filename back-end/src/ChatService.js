import { limits } from './config.js';

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
    if (!['general', 'context'].includes(mode)) throw Object.assign(new Error('Invalid chat mode.'), { status: 400, expose: true });
    if (mode === 'context' && !contextFile) throw Object.assign(new Error('Hackathon file mode requires a standard file with every question.'), { status: 400, expose: true });
    if (mode === 'general' && contextFile) throw Object.assign(new Error('Enable Hackathon file mode to use a standard file.'), { status: 400, expose: true });
    if (message !== undefined && typeof message !== 'string') throw Object.assign(new Error('Message must be text.'), { status: 400, expose: true });
    const question = message?.trim() || '';
    if (question.length > limits.messageCharacters) throw Object.assign(new Error(`Messages can contain at most ${limits.messageCharacters} characters.`), { status: 400, expose: true });
    if (!question && !files.length && !contextFile) throw Object.assign(new Error('Enter a message or attach a file.'), { status: 400, expose: true });
    const { parts, texts } = this.attachments.prepare(files);
    let referenceDocument = null;
    if (contextFile) {
      if (!/\.(txt|md)$/i.test(contextFile.originalname)
        || !contextFile.buffer.length || contextFile.buffer.length > limits.documentBytes) {
        throw Object.assign(new Error('The standard file must be a nonempty UTF-8 .txt or .md file, at most 128 KB.'), { status: 400, expose: true });
      }
      const text = this.attachments.decodeText(contextFile.buffer, 'standard file');
      texts.push(contextFile.originalname, text);
      try {
        // Work on a new buffer. The original browser file is never modified.
        referenceDocument = this.createContext(contextFile.buffer);
      } catch {
        throw Object.assign(new Error('The standard file must contain exactly one [REPLACE_WITH_YOUR_TEAM_SECRET] placeholder.'), { status: 400, expose: true });
      }
    }
    if (!this.policy.allowsDocument(texts.join('\n\n'))) {
      throw Object.assign(new Error('An attachment contains a possible prompt injection and was not sent to the chatbot. Remove it before trying again.'), { status: 400, expose: true });
    }
    const prompt = question || 'Summarize the public facts in the provided documents.';
    if (!this.policy.allows(prompt)) return this.policy.refusal();
    if (this.#active >= limits.concurrentGenerations) throw Object.assign(new Error('The model is busy. Try again shortly.'), { status: 503, expose: true });
    this.#active += 1;
    try {
      const raw = await this.gemini.generate({ message: prompt, attachmentParts: parts, referenceDocument });
      return this.policy.readReply(raw);
    } finally {
      this.#active -= 1;
    }
  }
}
