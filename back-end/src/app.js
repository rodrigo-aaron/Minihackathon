import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { limits } from './config.js';

export function createApp({ chat, verifier, policy, rateLimiter, trustProxy = 0 }) {
  const app = express();
  app.disable('x-powered-by');
  // Trust only the configured number of reverse-proxy hops, never arbitrary headers.
  app.set('trust proxy', trustProxy);

  function limit(kind) {
    return (request, response, next) => {
      const result = rateLimiter.check(kind, request.ip);
      if (result.allowed) return next();
      response.set('Retry-After', String(result.retryAfter));
      if (kind === 'verify') return response.status(429).json({ verify: 'Incorrect' });
      next(Object.assign(new Error('Too many requests. Please try again later.'), { status: 429, expose: true }));
    };
  }

  app.use((request, response, next) => {
    response.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    if (request.path.startsWith('/api/')) response.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', (request, response, next) => {
    const origin = request.get('origin');
    if (origin) {
      let originHost;
      try { originHost = new URL(origin).host; } catch { originHost = ''; }
      if (!originHost || originHost !== request.get('host')) {
        if (request.path === '/verify') return response.status(403).json({ verify: 'Incorrect' });
        return next(Object.assign(new Error('Cross-origin requests are not allowed.'), { status: 403, expose: true }));
      }
    }
    next();
  });

  app.post('/api/verify', limit('verify'),
    express.json({ limit: '2kb' }),
    express.urlencoded({ extended: false, limit: '2kb' }),
    (request, response) => {
      const body = request.body;
      const candidate = body && !Array.isArray(body) && typeof body === 'object'
        && Object.keys(body).length === 1 ? body.secret : undefined;
      response.json({ verify: verifier.verify(candidate) });
    });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: limits.fileBytes,
      files: limits.filesPerMessage + 1,
      fields: 2,
      fieldNameSize: 100,
      fieldSize: limits.messageCharacters * 4,
      parts: limits.filesPerMessage + 3,
    },
  });

  app.get('/healthz', (request, response) => response.json({ status: 'ok' }));
  app.get('/api/chat', limit('status'), (request, response) => {
    response.json({
      configured: chat.configured,
      limits: {
        filesPerMessage: limits.filesPerMessage,
        fileBytes: limits.fileBytes,
        requestFileBytes: limits.requestFileBytes,
        messageCharacters: limits.messageCharacters,
        documentBytes: limits.documentBytes,
      },
    });
  });
  app.post('/api/chat', limit('chat'), upload.fields([
    { name: 'files', maxCount: limits.filesPerMessage },
    { name: 'context', maxCount: 1 },
  ]),
    async (request, response) => {
      const reply = await chat.answer(request.body?.message, request.files?.files || [], {
        mode: request.body?.mode ?? 'general',
        contextFile: request.files?.context?.[0] ?? null,
      });
      response.json({ reply });
    });
  app.use('/api', (request, response) => response.status(404).json({ error: 'API endpoint not found.' }));
  app.use(express.static(fileURLToPath(new URL('../../front-end/public/', import.meta.url)), { dotfiles: 'deny' }));
  app.use((request, response) => response.status(404).type('text').send('Not found.'));

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    // The verification endpoint always keeps its single-key response contract.
    if (request.path === '/api/verify') {
      return response.status(error.status === 413 ? 413 : 400).json({ verify: 'Incorrect' });
    }
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Each attachment must be 5 MB or smaller.'
        : 'Invalid upload. Send one message, one mode, up to 3 files, and at most one context file.';
      return response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: policy.protect(message) });
    }
    // Only intentionally public errors may expose their messages.
    if (error.expose === true && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599) {
      return response.status(error.status).json({ error: policy.protect(error.message) });
    }
    if (/Unexpected end of form|Boundary not found|Malformed part header/.test(error.message)) {
      return response.status(400).json({ error: policy.protect('Invalid upload.') });
    }
    // Keep operational logging useful without recording request or provider contents.
    console.error('Unhandled request error.');
    response.status(500).json({ error: policy.protect('An unexpected server error occurred.') });
  });
  return app;
}
