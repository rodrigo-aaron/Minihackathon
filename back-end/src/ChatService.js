import { limits } from './config.js';
import { HttpError } from './HttpError.js';

export class ChatService {
  #active = 0;

  constructor({ gemini, attachments, policy }) {
    this.gemini = gemini;
    this.attachments = attachments;
    this.policy = policy;
  }

  get configured() { return this.gemini.configured; }

  async answer(message, files = []) {
    if (message !== undefined && typeof message !== 'string') throw new HttpError(400, 'Message must be text.');
    const question = message?.trim() || '';
    if (question.length > limits.messageCharacters) throw new HttpError(400, `Messages can contain at most ${limits.messageCharacters} characters.`);
    if (!question && !files.length) throw new HttpError(400, 'Enter a message or attach a file.');
    const { parts } = this.attachments.prepare(files);
    const prompt = question || 'Summarize the public facts in the attached files.';
    if (!this.policy.allows(prompt)) return this.policy.refusal();
    if (this.#active >= limits.concurrentGenerations) throw new HttpError(503, 'The model is busy. Try again shortly.');
    this.#active += 1;
    try {
      const raw = await this.gemini.generate({ message: prompt, attachmentParts: parts });
      return this.policy.readReply(raw);
    } finally {
      this.#active -= 1;
    }
  }
}
