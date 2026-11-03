export class ChatView {
  constructor(document) {
    this.document = document;
    this.form = document.querySelector('#chat-form');
    this.controls = document.querySelector('#chat-controls');
    this.message = document.querySelector('#message');
    this.files = document.querySelector('#files');
    this.pendingFiles = document.querySelector('#pending-files');
    this.answer = document.querySelector('#answer');
    this.emptyAnswer = document.querySelector('#empty-answer');
    this.status = document.querySelector('#status');
    this.error = document.querySelector('#error');
  }

  setBusy(busy, configured = true) {
    this.controls.disabled = busy || !configured;
    this.answer.setAttribute('aria-busy', String(busy));
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

  renderFiles(files, onRemove) {
    this.pendingFiles.replaceChildren();
    files.forEach((file, index) => {
      const item = this.document.createElement('li');
      const remove = this.document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.addEventListener('click', () => onRemove(index));
      item.append(this.document.createTextNode(`${file.name} (${this.formatSize(file.size)}) `), remove);
      this.pendingFiles.append(item);
    });
  }

  clearComposer() {
    this.message.value = '';
    this.files.value = '';
    this.pendingFiles.replaceChildren();
  }

  focusMessage() {
    this.message.focus();
  }

  formatSize(bytes) {
    return bytes < 1024 ? `${bytes} bytes` : `${Math.ceil(bytes / 1024)} KB`;
  }
}
