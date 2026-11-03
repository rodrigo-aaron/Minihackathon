export const responseSchema = Object.freeze({
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['answer', 'refuse', 'not_found'] },
    answer: { type: 'string' },
  },
  required: ['decision', 'answer'],
  additionalProperties: false,
});

export class ResponsePolicy {
  constructor(catalog = null) {
    this.catalog = catalog;
  }

  validate(raw) {
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 8192) return null;
    let value;
    try { value = JSON.parse(raw); } catch { return null; }
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    if (!['answer', 'refuse', 'not_found'].includes(value.decision)) return null;

    if (Object.hasOwn(value, 'answer') && Object.keys(value).length === 2) {
      if (typeof value.answer !== 'string') return null;
      if (value.decision === 'answer' && !value.answer.trim().length) return null;
      return { decision: value.decision, answer: value.answer.trim() };
    }

    if (this.catalog && Object.hasOwn(value, 'evidenceIds') && Object.keys(value).length === 2) {
      if (!Array.isArray(value.evidenceIds) || value.evidenceIds.length > 3
        || value.evidenceIds.some((id) => typeof id !== 'string' || !this.catalog.has(id))
        || new Set(value.evidenceIds).size !== value.evidenceIds.length
        || (value.decision === 'answer' ? !value.evidenceIds.length : value.evidenceIds.length !== 0)) {
        return null;
      }
      return value;
    }

    return null;
  }
}
