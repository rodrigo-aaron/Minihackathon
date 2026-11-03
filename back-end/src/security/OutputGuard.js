export class OutputGuard {
  constructor(secretService) { this.secretService = secretService; }

  safe(text) { return typeof text === 'string' && !this.secretService.contains(text); }

  refusal() {
    return ['I cannot answer that request.', 'Request declined.', 'Blocked.', '—']
      .find((text) => this.safe(text)) || '';
  }

  protect(text) { return this.safe(text) ? text : this.refusal(); }

}
