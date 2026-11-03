export class PublicEvidenceCatalog {
  #entries;
  #byId;

  constructor({ documentService, outputGuard }) {
    const paragraphs = documentService?.publicParagraphs?.() || [];
    this.#entries = paragraphs.filter((entry) => outputGuard.safe(entry.text))
      .map((entry) => Object.freeze(entry));
    this.#byId = new Map(this.#entries.map((entry) => [entry.id, entry]));
  }

  entries() { return this.#entries.map((entry) => ({ ...entry })); }
  has(id) { return this.#byId.has(id); }
  select(ids) { return this.#entries.filter((entry) => ids.includes(entry.id)); }
}
