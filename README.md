# Gemini Mini-Hackathon Chatbot

A Node.js/Express chatbot with vanilla browser JavaScript. Use general chat without a document, or turn on Hackathon file mode to ask questions about a standard file. A separate endpoint verifies a suspected secret phrase.

## Setup

Requires Node.js 22.14 or newer.

```powershell
npm install
npm run setup
```

Set `GEMINI_API_KEY` in the private `.env` file, then run:

```powershell
npm start
```

Open the address printed in the terminal. `npm run dev` enables automatic server restarts. Setup preserves the existing key and secret, and generates a secret only when none is configured. It does not require or prepare a document.

## Hackathon file mode

1. Turn on the **Hackathon file** toggle.
2. Select the original standard file as UTF-8 `.txt` or `.md` (maximum 128 KB).
3. Ask a question, or submit an empty message for a summary of public facts.

The standard file must contain exactly one `[REPLACE_WITH_YOUR_TEAM_SECRET]` marker. The server replaces only those marker bytes with the configured secret. The original file remains unchanged in the browser, and the secret is never sent back to the browser.

The browser keeps the selected file only in page memory and resends it with every Hackathon file mode question. The server processes it within that request, supplies the complete populated file to Gemini, and retains no shared active document. Refreshing the page or turning Hackathon file mode off clears the selection. No database, cookies, localStorage, sessionStorage, or conversation history is used.

For practice, select `docs/standard-file-example.txt`. Filenames are unrestricted; the application has no dependency on this example. During the competition, use the lecturer's standard file and keep Hackathon file mode enabled for every competition question.

Hackathon file mode rejects missing files, invalid text, missing/duplicate markers, and recognized prompt-injection instructions. These validators are heuristic and may miss attacks or flag benign quotations. Accepted documents are sent whole, never silently redacted or truncated.

## Configuration

| Variable | Meaning |
| --- | --- |
| GEMINI_API_KEY | Private Gemini API key |
| SECRET | Private phrase, 1–100 printable characters; no brackets or surrounding whitespace; cannot be Hello |
| PORT | HTTP port; default 3000 |
| HOST | Default 127.0.0.1 locally, 0.0.0.0 on recognized cloud deployments |
| TRUST_PROXY_HOPS | Trusted reverse-proxy hop count; default 0 |

The model is pinned in `back-end/src/config.js`. Documents are selected in the page; `DOCUMENT_TEMPLATE` and `DOCUMENT_FILE` are no longer used. On hosted services, configure the API key and secret in the service dashboard. Never place credentials in browser code or public files.

## Additional attachments

Attach up to 3 supporting files per question, at most 5 MB each and 10 MB total, in addition to the Hackathon file mode file. Questions may contain up to 10,000 characters. Supporting attachments stay selected until removed or the page reloads; each question resends them. Only the latest answer is displayed. Failed requests retain the current question and files for retry.

Supporting attachments accept PDF, PNG, JPEG, WebP, and UTF-8 text/code. Text/code contents pass through local injection checks. PDF/image uploads currently receive file-type and size checks only; local content inspection for those formats remains unimplemented. Hackathon file mode standard files require UTF-8 text so their contents and exact placeholder substitution can be checked.

## API

| Endpoint | Request | Response |
| --- | --- | --- |
| GET /healthz | None | `{ "status": "ok" }` |
| GET /api/chat | None | Provider status and public upload/context limits |
| POST /api/chat | Multipart `message`, `mode` (`general` or `context`), optional `files`, and one required `context` file in Hackathon file mode | `{ "reply": "checked answer" }` |
| POST /api/verify | JSON `{ "secret": "candidate" }` | One `verify` key containing Hello, Correct, or Incorrect |

Verification is exact and case-sensitive, and never calls Gemini. `Hello` returns Hello; the exact phrase returns Correct; other guesses return Incorrect. Malformed and rate-limited requests retain the single-key body with an appropriate HTTP error status.

## Integrity inspection

To inspect a standard file locally without creating a prepared file:

```powershell
npm run check:integrity -- docs/standard-file-example.txt
```

This command checks marker substitution and full-file input inclusion, printing only metadata. The Gemini adapter independently checks complete-file inclusion on every Hackathon file mode provider invocation.

## Code guide

Start with `server.js` for dependency wiring, `app.js` for endpoints, and `ChatService.js` for the question-answer workflow. ReferenceDocument performs in-memory marker substitution; Attachments handles uploads; GeminiClient calls the model; ChatPolicy validates input and output; SecretVerifier checks guesses; RateLimiter tracks request budgets.

The three browser modules are ApiClient, ChatApp, and VerifyApp. Existing presentation styles are in `front-end/public/styles.css`. See [the architecture guide](docs/architecture.md) for data flow and responsibilities.

## Confidentiality and submission

Input checks, system instructions, structured response validation, and output filters are heuristic defenses, not a guarantee against all prompt injection or inference. Generated answers are not restricted to a reviewed passage catalog.

Exclude `.env`, `node_modules/`, `.private/`, logs, and confidential artifacts from submissions. Rate limits are in-memory and apply to one server process. Legacy prepared files in `.private` are not loaded by the app.
