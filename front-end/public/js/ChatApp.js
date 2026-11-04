import { ApiClient } from './ApiClient.js';

// Developed with the help of generative AI.
export class ChatApp {
  constructor({ api, document }) {
    this.api = api;
    this.document = document;
    this.form = document.querySelector('#chat-form');
    this.controls = document.querySelector('#chat-controls');
    this.message = document.querySelector('#message');
    this.fileInput = document.querySelector('#files');
    this.pendingFiles = document.querySelector('#pending-files');
    this.answer = document.querySelector('#answer');
    this.emptyAnswer = document.querySelector('#empty-answer');
    this.status = document.querySelector('#status');
    this.error = document.querySelector('#error');
    this.files = [];
    this.busy = true;
    this.configured = false;
    this.limits = null;
  }

  async initialize() {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.send();
    });
    this.fileInput.addEventListener('change', () => this.selectFiles());

    try {
      const data = await this.api.load();
      this.configured = data.configured;
      this.limits = data.limits;
      this.renderAnswer('');
      this.showReadyStatus();
    } catch (error) {
      this.showError(error.message);
      this.showStatus('Reload the page to reconnect.');
      return;
    } finally {
      this.busy = false;
      this.setBusy(false, this.configured);
    }
    if (this.configured) this.focusMessage();
  }

  selectFiles() {
    const selected = [...this.fileInput.files];
    this.fileInput.value = '';
    this.showError();
    if (this.files.length + selected.length > this.limits.filesPerMessage) {
      this.showError(`Attach at most ${this.limits.filesPerMessage} files per message.`);
      return;
    }
    if (selected.some((file) => file.size > this.limits.fileBytes || file.size === 0)) {
      this.showError('Files must not be empty and must be 5 MB or smaller.');
      return;
    }
    if ([...this.files, ...selected].reduce((total, file) => total + file.size, 0) > this.limits.requestFileBytes) {
      this.showError('Attachments can total at most 10 MB per request.');
      return;
    }
    this.files.push(...selected);
    this.renderFiles();
    this.showReadyStatus();
  }

  async send() {
    if (this.busy || !this.configured) return;
    const message = this.message.value.trim();
    this.showError();
    if (!message && !this.files.length) {
      this.showError('Enter a message or attach a file.');
      return;
    }
    this.busy = true;
    this.setBusy(true);
    this.showStatus('Gemini is reading your message and attachments...');
    try {
      const data = await this.api.send(message, this.files);
      this.renderAnswer(data.reply);
      this.message.value = '';
      this.renderFiles();
    } catch (error) {
      // Keep the message and pending attachments available for a retry.
      this.showError(error.message);
    } finally {
      this.busy = false;
      this.setBusy(false, this.configured);
      this.showReadyStatus();
      this.focusMessage();
    }
  }

  showReadyStatus() {
    if (!this.configured) {
      this.showStatus('Add GEMINI_API_KEY to the server .env file, restart the server, and reload this page.');
      return;
    }
    const names = this.files.map((file) => file.name).join(', ');
    this.showStatus(names ? `Ready — Selected attachments: ${names}. Included with each question until removed.`
      : 'Ready — Chat or ask about the official reference document.');
  }

  setBusy(busy, configured = true) {
    this.controls.disabled = busy || !configured;
    this.answer.setAttribute('aria-busy', String(busy));
    this.renderFiles();
  }

  showStatus(message) {
    this.status.textContent = message;
  }

  showError(message = '') {
    this.error.textContent = message;
  }

  renderAnswer(text) {
    this.answer.replaceChildren();
    for (const [index, line] of text.split('\n').entries()) {
      if (index > 0) this.answer.append(this.document.createElement('br'));
      this.answer.append(this.document.createTextNode(line));
    }
    this.emptyAnswer.hidden = Boolean(text);
  }

  renderFiles() {
    this.pendingFiles.replaceChildren();
    this.files.forEach((file, index) => {
      const item = this.document.createElement('li');
      const remove = this.document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.disabled = this.busy;
      remove.addEventListener('click', () => {
        this.files.splice(index, 1);
        this.renderFiles();
        this.showReadyStatus();
      });
      item.append(this.document.createTextNode(`${file.name} (${this.formatSize(file.size)}) `), remove);
      this.pendingFiles.append(item);
    });
  }

  focusMessage() {
    this.message.focus();
  }

  formatSize(bytes) {
    return bytes < 1024 ? `${bytes} bytes` : `${Math.ceil(bytes / 1024)} KB`;
  }
}

void new ChatApp({ api: new ApiClient(), document }).initialize();
