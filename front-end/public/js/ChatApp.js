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
    this.hackathonToggle = document.querySelector('#hackathon-toggle');
    this.contextPanel = document.querySelector('#context-panel');
    this.contextInput = document.querySelector('#context-file');
    this.contextStatus = document.querySelector('#context-status');
    this.answer = document.querySelector('#answer');
    this.emptyAnswer = document.querySelector('#empty-answer');
    this.status = document.querySelector('#status');
    this.error = document.querySelector('#error');
    this.files = [];
    this.contextMode = false;
    this.contextFile = null;
    this.hackathonToggle.checked = false;
    this.contextPanel.hidden = true;
    this.contextInput.value = '';
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
    this.hackathonToggle.addEventListener('change', () => this.setHackathonMode());
    this.contextInput.addEventListener('change', () => this.selectContextFile());

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

  setHackathonMode() {
    if (this.busy) return;
    this.contextMode = this.hackathonToggle.checked;
    this.contextPanel.hidden = !this.contextMode;
    if (!this.contextMode) {
      this.contextFile = null;
      this.contextInput.value = '';
      this.contextStatus.textContent = 'Upload the hackathon file to start.';
    }
    this.showError();
    this.showReadyStatus();
  }

  selectContextFile() {
    const file = this.contextInput.files[0];
    this.contextInput.value = '';
    if (!file) return;
    this.showError();
    if (!/\.(txt|md)$/i.test(file.name) || !file.size || file.size > this.limits.documentBytes) {
      this.showError('The standard file must be a nonempty UTF-8 .txt or .md file, at most 128 KB.');
      return;
    }
    this.contextFile = file;
    this.contextStatus.textContent = `${file.name} selected. Included with every question while Hackathon file is enabled.`;
    this.showReadyStatus();
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
    if (this.contextMode && !this.contextFile) {
      this.showError('Upload the hackathon file before sending a question.');
      return;
    }
    if (!message && !this.files.length && !this.contextFile) {
      this.showError('Enter a message or attach a file.');
      return;
    }
    this.busy = true;
    this.setBusy(true);
    this.showStatus('Gemini is reading your message and attachments...');
    try {
      const data = await this.api.send(message, this.files, {
        mode: this.contextMode ? 'context' : 'general',
        contextFile: this.contextFile,
      });
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
    if (this.contextMode) {
      this.showStatus(this.contextFile ? `Ready — Hackathon file: ${this.contextFile.name}.`
        : 'Hackathon file enabled — Upload the standard file before asking a question.');
      return;
    }
    const names = this.files.map((file) => file.name).join(', ');
    this.showStatus(names ? `Ready — Selected attachments: ${names}. Included with each question until removed.`
      : 'Ready — Ask a question or attach a document.');
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
