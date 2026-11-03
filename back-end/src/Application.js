import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { limits } from './config.js';
import { ChatController } from './controllers/ChatController.js';
import { VerifyController } from './controllers/VerifyController.js';
import { HttpError } from './errors/HttpError.js';
import { RateLimitService } from './services/RateLimitService.js';

export class Application {
  constructor({ chatService, secretService, outputGuard, rateLimiter = new RateLimitService() }) {
    this.app = express();
    this.controller = new ChatController({ chatService });
    this.verifier = new VerifyController(secretService);
    this.rateLimiter = rateLimiter;
    this.outputGuard = outputGuard;
    this.configure();
  }

  limit(kind) {
    return (request, response, next) => {
      const result = this.rateLimiter.check(kind, request.ip);
      if (result.allowed) return next();
      response.set('Retry-After', String(result.retryAfter));
      if (kind === 'verify') return response.status(429).json({ verify: 'Incorrect' });
      next(new HttpError(429, 'Too many requests. Please try again later.'));
    };
  }

  configure() {
    this.app.disable('x-powered-by');
    this.app.set('trust proxy', true);
    this.app.use((request, response, next) => {
      response.set({
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      });
      if (request.path.startsWith('/api/')) response.set('Cache-Control', 'no-store');
      next();
    });

    // Keep browser requests on the same host (compatible with HTTPS tunnels/reverse proxies).
    this.app.use('/api', (request, response, next) => {
      const origin = request.get('origin');
      if (origin) {
        let originHost = '';
        try { originHost = new URL(origin).host; } catch { originHost = ''; }
        if (!originHost || originHost !== request.get('host')) {
          if (request.path === '/verify') return response.status(403).json({ verify: 'Incorrect' });
          return next(new HttpError(403, 'Cross-origin requests are not allowed.'));
        }
      }
      next();
    });

    this.app.post(
      '/api/verify',
      this.limit('verify'),
      express.json({ limit: '2kb', strict: false }),
      express.urlencoded({ extended: false, limit: '2kb' }),
      (request, response) => this.verifier.verify(request, response),
    );

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: limits.fileBytes,
        files: limits.filesPerMessage,
        fields: 1,
        fieldNameSize: 100,
        fieldSize: limits.messageCharacters * 4,
        parts: limits.filesPerMessage + 1,
      },
    });

    this.app.get('/api/chat', this.limit('status'), (request, response) => this.controller.get(request, response));
    this.app.post('/api/chat', this.limit('chat'), upload.array('files', limits.filesPerMessage),
      (request, response) => this.controller.send(request, response));
    this.app.use('/api', (request, response) => response.status(404).json({ error: 'API endpoint not found.' }));
    this.app.use(express.static(fileURLToPath(new URL('../../front-end/public/', import.meta.url)), { dotfiles: 'deny' }));
    this.app.use((request, response) => response.status(404).type('text').send('Not found.'));

    this.app.use((error, request, response, next) => {
      if (response.headersSent) return next(error);
      if (request.path === '/api/verify') return response.status(error.status === 413 ? 413 : 400).json({ verify: 'Incorrect' });
      if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
          ? 'Each attachment must be 5 MB or smaller.'
          : 'Invalid upload. Send one message and up to 3 files using the files field.';
        return response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: this.outputGuard.protect(message) });
      }
      if (error instanceof HttpError) {
        return response.status(error.status).json({ error: this.outputGuard.protect(error.message) });
      }
      // Do not log provider error bodies or credentials.
      if (/Unexpected end of form|Boundary not found|Malformed part header/.test(error.message)) {
        return response.status(400).json({ error: this.outputGuard.protect('Invalid upload.') });
      }
      response.status(500).json({ error: this.outputGuard.protect('An unexpected server error occurred.') });
    });
  }

  listen(port, host) {
    return this.app.listen(port, host);
  }
}
