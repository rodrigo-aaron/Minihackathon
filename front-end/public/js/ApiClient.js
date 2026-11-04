// Developed with the help of generative AI.
export class ApiClient {
  constructor(endpoint = '/api/chat') {
    this.endpoint = endpoint;
  }

  async request(options = {}) {
    let response;
    try {
      response = await fetch(this.endpoint, { ...options, credentials: 'omit' });
    } catch {
      throw new Error('Could not reach the chat server. Check that it is running.');
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('The server returned an unexpected response. Please try again.');
    }
    if (!response.ok) throw new Error(data.error || 'The request failed. Please try again.');
    return data;
  }

  load() {
    return this.request();
  }

  send(message, files) {
    const body = new FormData();
    body.append('message', message);
    for (const file of files) body.append('files', file);
    return this.request({ method: 'POST', body });
  }

  async verify(secret) {
    let response;
    try {
      response = await fetch('/api/verify', {
        method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret }),
      });
    } catch { throw new Error('Could not reach the verification service.'); }
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The verification service returned an invalid response.'); }
    if (!data || Array.isArray(data) || typeof data !== 'object' || Object.keys(data).length !== 1 || !['Hello', 'Correct', 'Incorrect'].includes(data.verify)) {
      throw new Error('The verification service returned an invalid response.');
    }
    return { data, status: response.status };
  }
}
