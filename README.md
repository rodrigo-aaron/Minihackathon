# Gemini Mini-Hackathon Chatbot

A small Node.js/Express chatbot with vanilla browser JavaScript. It answers questions using Gemini, an official reference document, and optional attachments. A separate endpoint verifies a suspected secret phrase.

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

Open the address printed in the terminal. `npm run dev` enables automatic server restarts.

`setup` preserves the existing API key and secret. If no secret is configured, it generates one. To choose a phrase, set `SECRET="your phrase"` in `.env` and run `npm run document:prepare`. The phrase must contain 1–100 printable characters, have no brackets or surrounding whitespace, and must not be Hello. No real secret belongs in source files or this README.

On hosted services, configure environment variables in the service dashboard. Prepare the official document with the same secret before starting the service. Never upload `.env` as a public asset.

## Configuration

| Variable | Meaning |
| --- | --- |
| GEMINI_API_KEY | Private Gemini API key |
| SECRET | Stable private verification phrase |
| DOCUMENT_TEMPLATE | Original UTF-8 template; defaults to `back-end/data/sample.template.txt` |
| DOCUMENT_FILE | Prepared file; defaults to `back-end/.private/team-document.txt` |
| PORT | HTTP port; default 3000 |
| HOST | Default 127.0.0.1 locally, 0.0.0.0 on recognized cloud deployments |
| TRUST_PROXY_HOPS | Trusted reverse-proxy hop count; default 0 |

The model is pinned in `back-end/src/config.js`. Startup fails if the secret or official document is missing, or if the prepared document differs from the expected marker substitution.

## Official reference document

The original UTF-8 template must contain exactly one `[REPLACE_WITH_YOUR_TEAM_SECRET]` marker. Preparation replaces only those marker bytes. Keep the remaining standard file unchanged.

```powershell
npm run document:prepare
npm run check:integrity
```

The integrity command is read-only. It checks the prepared bytes and full-file input invariant without printing the phrase. The complete prepared document, including the secret, is supplied to every Gemini generation request.

## Attachments and chat

Attach up to 3 files per question: at most 5 MB each and 10 MB total. Questions may contain up to 10,000 characters. Supported attachments are PDF, PNG, JPEG, WebP, and UTF-8 text/code files. Official preparation templates must be UTF-8 text.

Attachments stay selected in the current browser page until removed or the page reloads. Each question resends them, so follow-up questions work without storing conversation history or sharing uploads between visitors. Only the latest answer is displayed. Failed requests retain the current question and files for retry.

## API

| Endpoint | Request | Response |
| --- | --- | --- |
| GET /healthz | None | `{ "status": "ok" }` |
| GET /api/chat | None | Provider configuration status and public upload limits |
| POST /api/chat | Multipart `message` and optional `files` | `{ "reply": "checked answer" }` |
| POST /api/verify | JSON `{ "secret": "candidate" }` | One `verify` key containing Hello, Correct, or Incorrect |

Verification is exact and case-sensitive. Input `Hello` returns Hello; the exact phrase returns Correct; other guesses return Incorrect. Verification never calls Gemini. Malformed and rate-limited verification requests retain the single-key response shape and use an appropriate HTTP error status.

## Code guide

Start with `back-end/src/server.js` for dependency wiring, `app.js` for endpoints, and `ChatService.js` for the question-answer workflow. The remaining backend modules are ReferenceDocument, Attachments, GeminiClient, ChatPolicy, SecretVerifier, RateLimiter, HttpError, and config.

The three browser modules are ApiClient, ChatApp, and VerifyApp. Existing presentation styles are in `front-end/public/styles.css`.

See [the architecture guide](docs/architecture.md) for responsibilities, data flow, and confidentiality limits.

## Confidentiality and submission

The server checks input patterns, validates structured model responses, and filters recognizable secret disclosures. These are heuristic defenses, not a guarantee against all prompt injection or inference. Generated answers remain flexible; the server does not restrict them to an approved passage catalog.

Submit the project with `front-end/`, `back-end/`, `package.json`, the lockfile, and setup instructions. Exclude `.env`, `node_modules/`, `.private/`, logs, and any confidential artifacts. Rate limits are in-memory and apply to one server process.
