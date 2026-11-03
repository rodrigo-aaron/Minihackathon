import { limits } from '../config.js';
import { HttpError } from '../errors/HttpError.js';

export class ChatController {
  constructor({ chatService }) {
    this.chatService = chatService;
  }

  get(request, response) {
    response.json({
      configured: this.chatService.configured,
      limits: {
        filesPerMessage: limits.filesPerMessage,
        fileBytes: limits.fileBytes,
        requestFileBytes: limits.requestFileBytes,
        messageCharacters: limits.messageCharacters,
      },
    });
  }

  async send(request, response) {
    const message = request.body?.message;
    if (message !== undefined && typeof message !== 'string') {
      throw new HttpError(400, 'Message must be text.');
    }
    const text = message?.trim() || '';
    if (text.length > limits.messageCharacters) {
      throw new HttpError(400, `Messages can contain at most ${limits.messageCharacters} characters.`);
    }
    if (!text && !request.files?.length) {
      throw new HttpError(400, 'Enter a message or attach a file.');
    }

    response.json({ reply: await this.chatService.send(text, request.files || []) });
  }
}
