# Gemini Mini-Hackathon Chatbot

JavaScript, Node.js, Express, plain HTML, a minimal external stylesheet, and object-oriented classes. No styling libraries.

The chatbot answers questions using public passages from a server-owned reference document. The complete document, including the confidential phrase, is supplied to `gemini-3.5-flash-lite` on every model request. A separate **Verify Secret** input compares guesses without calling Gemini.

## Run locally

Requires Node.js 22.14 or newer.

1. Run `npm install`.
2. Run `npm run setup`. This preserves an existing `.env` API key, configures a random private `SECRET` if needed, and prepares the practice document.
3. Set `GEMINI_API_KEY` in `.env` if it is not already configured.
4. Run `npm start` and open the host/port printed in the console.

## Submission layout

Submit one ZIP file containing these separate directories:

```text
front-end/
  public/
back-end/
  src/
  scripts/
  data/
```

The root `package.json` contains the commands for running the back end and serving the front end.

Use `npm run dev` for automatic server restarts when source changes. If your port is occupied, change `PORT` in `.env`. The example configuration uses port 3001. The verifier works independently of Gemini availability.

## Configuration

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-only Gemini API key |
| `SECRET` | Exact confidential phrase, 1-100 printable characters; cannot be Hello |
| `DOCUMENT_TEMPLATE` | Original UTF-8 file with exactly one `[REPLACE_WITH_YOUR_TEAM_SECRET]` marker |
| `DOCUMENT_FILE` | Populated file inside `back-end/.private/` |
| `PORT` | Local HTTP port |
| `HOST` | Defaults to `127.0.0.1`; configure appropriately for hosting |

The model is pinned in server configuration to `gemini-3.5-flash-lite`. The application does not substitute another model based on an environment value or client request.

The generated secret and populated document are private and ignored by Git. Do not put them in browser assets or expose `.env`. Changing `SECRET` or the original template requires running `npm run document:prepare`, then restarting the server.

## Use the official document

The included `back-end/data/sample.template.txt` is the current practice reference. When the lecturer supplies the standard UTF-8 file, save its original bytes unchanged, point `DOCUMENT_TEMPLATE` to it, and run `npm run document:prepare`. The preparation step replaces only the placeholder, without brackets. Startup verifies that the populated file equals that exact substitution. Other file formats require a compatible preparation adapter; do not reformat an official file to make it fit.

Run `npm run check:integrity` for a local pass/fail check without printing the phrase. The full file is asserted again at the actual Gemini SDK call boundary on every independent request.

## Verification endpoint

`POST /api/verify`, with `Content-Type: application/json`:

```json
{"secret":"candidate"}
```

| Input | Response |
| --- | --- |
| Exact `Hello` | `{"verify":"Hello"}` |
| Exact secret | `{"verify":"Correct"}` |
| Another guess | `{"verify":"Incorrect"}` |

Comparison is case-sensitive and does not trim input. Accepted requests return HTTP 200. Malformed requests and rate limits retain the single-key response body; a rate limit uses HTTP 429. No partial-match information or submitted guess is returned.

## Chat behavior and boundaries

Gemini reads the complete reference document (including the confidential phrase) on every model request and generates natural-language answers through a structured `{ decision, answer }` schema. Node validates the decision and passes the answer through `OutputGuard` before sending it.

Supplementary attachments remain supported: PDFs, PNG/JPEG/WebP images, and common UTF-8 text/code files. The server also supports both UTF-8 text files and PDFs for the reference document (or operates normally with user-attached files if no server reference document is present). Limits are three files per request, 5 MB per file, and 10 MB total per request.

Requests are stateless: no chat sessions, conversation storage, session cookies, or previous messages are used. Only the latest answer is displayed; refreshing clears it. Attachments apply only to the current request and must be attached again for another question. Public API requests have separate IP/global chat and verification limits. Minimal local audit metadata is stored in `.private/`; it contains no prompts, answers, guesses, attachments, or secret values. Provider-side data handling is governed by the Gemini service.

Layered protections reduce disclosure risk but cannot guarantee immunity to every prompt injection or inference channel when the model reads the phrase. See `docs/architecture.md` for the runtime components. Public hosting additionally requires HTTPS, platform-managed environment secrets, and appropriate proxy configuration; this repository is configured for local use by default.
