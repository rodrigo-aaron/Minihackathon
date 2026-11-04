// Developed with the help of generative AI.
export class RateLimiter {
  constructor({ windowMs = 60_000, budgets = {}, now = () => Date.now() } = {}) {
    this.windowMs = windowMs;
    this.budgets = { chat: [120, 600], verify: [300, 1200], status: [300, 1200], ...budgets };
    this.now = now;
    this.windows = new Map();
  }

  check(kind, ip) {
    const now = this.now();
    for (const [key, value] of this.windows) if (value.expires <= now) this.windows.delete(key);
    const keys = [`${kind}:ip:${ip}`, `${kind}:global`];
    const budget = this.budgets[kind];
    if (!budget || this.windows.size > 2048) return { allowed: false, retryAfter: 60 };
    for (let index = 0; index < keys.length; index += 1) {
      const entry = this.windows.get(keys[index]);
      if (entry && entry.count >= budget[index]) return {
        allowed: false, retryAfter: Math.max(1, Math.ceil((entry.expires - now) / 1000)),
      };
    }
    for (const key of keys) {
      const entry = this.windows.get(key) || { count: 0, expires: now + this.windowMs };
      entry.count += 1;
      this.windows.set(key, entry);
    }
    return { allowed: true };
  }
}
