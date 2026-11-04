// Developed with the help of generative AI.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
