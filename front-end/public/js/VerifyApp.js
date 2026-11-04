import { ApiClient } from './ApiClient.js';

// Developed with the help of generative AI.
export class VerifyApp {
  constructor({ api, document }) {
    this.api = api;
    this.form = document.querySelector('#verify-form');
    this.guess = document.querySelector('#secret-guess');
    this.button = document.querySelector('#verify-button');
    this.result = document.querySelector('#verify-result');
    this.status = document.querySelector('#verify-status');
    this.busy = false;
  }

  initialize() {
    this.form.addEventListener('submit', (event) => { event.preventDefault(); void this.verify(); });
  }

  async verify() {
    if (this.busy) return;
    this.busy = true;
    this.button.disabled = true;
    this.result.textContent = '';
    this.status.textContent = 'Checking...';
    try {
      const { data, status } = await this.api.verify(this.guess.value);
      this.result.textContent = JSON.stringify(data);
      this.status.textContent = status === 429 ? 'Too many guesses. Wait before trying again.'
        : status >= 400 ? 'The verification request could not be accepted.' : '';
    } catch (error) { this.status.textContent = error.message; }
    finally { this.busy = false; this.button.disabled = false; }
  }
}

new VerifyApp({ api: new ApiClient(), document }).initialize();
