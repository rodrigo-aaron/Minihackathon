# Gemini Mini-Hackathon Chatbot

A minimal full-stack chatbot built with Node.js, Express, the official Google Gemini SDK, and plain browser JavaScript. Users can ask questions about a server-owned reference document, attach supporting files, and verify a suspected secret phrase through a separate endpoint.

The project is organized for submission as one ZIP file with separate front-end and back-end directories.

## Features

- Gemini-powered question answering
- Server-side API key handling
- Questions about the official reference document
- PDF, image, and UTF-8 text/code attachments
- Secret verification endpoint
- Input validation, upload limits, rate limiting, and output filtering
- Minimal responsive frontend with an external stylesheet
- Document integrity checks before provider requests
- Private configuration and generated documents excluded from Git

## Requirements

- Node.js 22.14 or newer
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Installation and setup

From the project root:

```powershell
npm install
npm run setup
```

`npm run setup` creates a private `SECRET` when needed and prepares the reference document. It preserves an existing `GEMINI_API_KEY`.

The setup script also works in deployments where `.env.example` is not committed. On Render, configure the environment variables in the service dashboard instead of uploading a `.env` file.

If necessary, edit `.env` and set:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Never place the API key in frontend files or commit `.env`.

## Running the application

Start the server:

```powershell
npm start
```

Open the address printed in the terminal, normally:

```text
http://127.0.0.1:3000
```

For development with automatic server restarts:

```powershell
npm run dev
```

If port `3000` is already in use, change `PORT` in `.env`.

## Configuration

| Variable | Description |
| --- | --- |
| `GEMINI_API_KEY` | Server-only Gemini API key |
| `SECRET` | Private phrase used by the verification endpoint |
| `DOCUMENT_TEMPLATE` | Original reference document template |
| `DOCUMENT_FILE` | Prepared private reference document |
| `PORT` | HTTP port; defaults to `3000` |
| `HOST` | Listening host; defaults to `127.0.0.1` |

The default document paths are:

```text
back-end/data/sample.template.txt
back-end/.private/team-document.txt
```

The Gemini model is configured in `back-end/src/config.js`. The API key and secret are never sent to the browser.

## API endpoints

### `GET /api/chat`

Returns the current frontend configuration and supported upload limits.

### `POST /api/chat`

Accepts a `multipart/form-data` request:

- `message`: question text
- `files`: optional attachments

Example with PowerShell:

```powershell
curl.exe -F "message=Summarize the reference document" `
  http://127.0.0.1:3000/api/chat
```

### `POST /api/verify`

Accepts JSON:

```json
{
  "secret": "candidate"
}
```

Responses identify only `Hello`, `Correct`, or `Incorrect`. Comparisons are exact and case-sensitive.

## Supported attachments

- PDF
- PNG, JPEG, and WebP images
- UTF-8 text and code files such as `.txt`, `.md`, `.csv`, `.json`, `.js`, `.ts`, `.html`, `.css`, `.py`, and `.sql`

Limits:

- Maximum 3 files per request
- Maximum 5 MB per file
- Maximum 10 MB total per request
- Maximum 10,000 characters per message

## Document preparation and integrity

The reference template uses the marker:

```text
[REPLACE_WITH_YOUR_TEAM_SECRET]
```

To regenerate the private document after changing the secret or template:

```powershell
npm run document:prepare
```

To validate that the prepared document is correct:

```powershell
npm run check:integrity
```

The integrity check does not print the confidential phrase.

## Project structure

```text
.
├── back-end/
│   ├── data/
│   ├── scripts/
│   └── src/
│       ├── controllers/
│       ├── errors/
│       ├── security/
│       └── services/
├── front-end/
│   └── public/
│       ├── js/
│       ├── index.html
│       └── styles.css
├── .env.example
├── package.json
└── README.md
```

The Express server in `back-end/src` serves the static frontend from `front-end/public`.

## Submission

Submit one ZIP file containing:

```text
front-end/
back-end/
```

Do not include:

- `.env`
- `node_modules/`
- Private secrets or generated confidential documents
- Logs or coverage output

The repository `.gitignore` already excludes these local files.

## Security notes

This project is configured for local development. Before public deployment, add authentication, HTTPS, durable audit storage, production rate limits, and platform-managed environment secrets. Never expose the Gemini API key or the private reference document through frontend assets.
