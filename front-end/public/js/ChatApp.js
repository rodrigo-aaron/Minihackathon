export class ChatApp {
  constructor({ api, view }) {
    this.api = api;
    this.view = view;
    this.files = [];
    this.busy = true;
    this.configured = false;
    this.limits = null;
  }

  async initialize() {
    this.view.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.send();
    });
    this.view.files.addEventListener('change', () => this.selectFiles());

    try {
      const data = await this.api.load();
      this.configured = data.configured;
      this.limits = data.limits;
      this.view.renderAnswer('');
      this.showReadyStatus();
    } catch (error) {
      this.view.showError(error.message);
      this.view.showStatus('Reload the page to reconnect.');
      return;
    } finally {
      this.busy = false;
      this.view.setBusy(false, this.configured);
    }
    if (this.configured) this.view.focusMessage();
  }

  selectFiles() {
    const selected = [...this.view.files.files];
    this.view.files.value = '';
    this.view.showError();
    if (this.files.length + selected.length > this.limits.filesPerMessage) {
      this.view.showError(`Attach at most ${this.limits.filesPerMessage} files per message.`);
      return;
    }
    if (selected.some((file) => file.size > this.limits.fileBytes || file.size === 0)) {
      this.view.showError('Files must not be empty and must be 5 MB or smaller.');
      return;
    }
    if ([...this.files, ...selected].reduce((total, file) => total + file.size, 0) > this.limits.requestFileBytes) {
      this.view.showError('Attachments can total at most 10 MB per request.');
      return;
    }
    this.files.push(...selected);
    this.renderFiles();
  }

  renderFiles() {
    this.view.renderFiles(this.files, (index) => {
      this.files.splice(index, 1);
      this.renderFiles();
    });
  }

  async send() {
    if (this.busy || !this.configured) return;
    const message = this.view.message.value.trim();
    this.view.showError();
    if (!message && !this.files.length) {
      this.view.showError('Enter a message or attach a file.');
      return;
    }
    this.busy = true;
    this.view.setBusy(true);
    this.view.showStatus('Gemini is reading your message and attachments...');
    try {
      const data = await this.api.send(message, this.files);
      this.view.renderAnswer(data.reply);
      this.files = [];
      this.view.clearComposer();
    } catch (error) {
      // Keep the message and pending attachments available for a retry.
      this.view.showError(error.message);
    } finally {
      this.busy = false;
      this.view.setBusy(false, this.configured);
      this.showReadyStatus();
      this.view.focusMessage();
    }
  }

  showReadyStatus() {
    this.view.showStatus(this.configured
      ? 'Ready.'
      : 'Add GEMINI_API_KEY to the server .env file, restart the server, and reload this page.');
  }
}
