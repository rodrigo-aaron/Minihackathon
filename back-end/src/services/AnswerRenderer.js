export class AnswerRenderer {
  constructor({ catalog = null, outputGuard }) {
    this.catalog = catalog;
    this.outputGuard = outputGuard;
  }

  render(selection) {
    if (!selection || selection.decision === 'refuse') return this.outputGuard.refusal();
    if (selection.decision === 'not_found') {
      const fallback = 'No matching public information was found in the reference file.';
      const text = typeof selection.answer === 'string' && selection.answer.trim()
        ? selection.answer.trim()
        : fallback;
      return this.outputGuard.protect(text);
    }
    if (typeof selection.answer === 'string') {
      return this.outputGuard.protect(selection.answer.trim());
    }
    if (this.catalog && Array.isArray(selection.evidenceIds)) {
      return this.outputGuard.protect(this.catalog.select(selection.evidenceIds).map((entry) => entry.text).join('\n\n'));
    }
    return this.outputGuard.refusal();
  }
}
