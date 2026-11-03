const ACCEPTED_KEYS = ['secret', 'verify', 'input', 'guess', 'phrase', 'value'];

export class VerifyController {
  constructor(secretService) { this.secretService = secretService; }

  verify(request, response) {
    const body = request.body;
    let candidate;
    if (typeof body === 'string') {
      candidate = body;
    } else if (body && !Array.isArray(body) && typeof body === 'object') {
      const keys = Object.keys(body);
      if (keys.length === 1 && ACCEPTED_KEYS.includes(keys[0])) {
        candidate = body[keys[0]];
      }
    }
    response.json({ verify: this.secretService.verify(candidate) });
  }
}
