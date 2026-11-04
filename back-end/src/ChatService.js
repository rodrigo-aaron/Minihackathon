import { limits } from './config.js';

export class ChatService {
  #active = 0;

  constructor({ gemini, attachments, policy }) {
    this.gemini = gemini;
    this.attachments = attachments;
    this.policy = policy;
  }

  get configured() { return this.gemini.configured; }

  async answer(message, files = []) {
    if (message !== undefined && typeof message !== 'string') throw Object.assign(new Error('Message must be text.'), { status: 400, expose: true });
    const question = message?.trim() || '';
    if (question.length > limits.messageCharacters) throw Object.assign(new Error(`Messages can contain at most ${limits.messageCharacters} characters.`), { status: 400, expose: true });
    if (!question && !files.length) throw Object.assign(new Error('Enter a message or attach a file.'), { status: 400, expose: true });
    const { parts, texts } = this.attachments.prepare(files);
    if (!this.policy.allowsDocument(texts.join('\n\n'))) {
      throw Object.assign(new Error('An attachment contains a possible prompt injection and was not sent to the chatbot. Remove it before trying again.'), { status: 400, expose: true });
    }
    const prompt = question || 'Summarize the public facts in the provided documents.';
    if (!this.policy.allows(prompt)) return this.policy.refusal();
    if (this.#active >= limits.concurrentGenerations) throw Object.assign(new Error('The model is busy. Try again shortly.'), { status: 503, expose: true });
    this.#active += 1;
    try {
      const raw = await this.gemini.generate({ message: prompt, attachmentParts: parts });
      return this.policy.readReply(raw);
    } finally {
      this.#active -= 1;
    }
  }
}
