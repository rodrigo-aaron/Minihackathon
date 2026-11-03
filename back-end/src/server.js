import { createApplication } from './bootstrap.js';
import { loadConfig } from './config.js';

const config = loadConfig();
let application;
try { application = createApplication(config); }
catch (error) {
  console.error(error.code === 'ENOENT' ? 'Document not prepared. Run npm run setup.' : error.message);
  process.exit(1);
}
const server = application.listen(config.port, config.host);

server.on('listening', () => {
  console.log(`Gemini chat is running at http://${config.host}:${config.port}`);
  if (!config.apiKey) console.log('Set GEMINI_API_KEY in .env and restart to enable replies.');
});

server.on('error', (error) => {
  console.error(`Could not start the server: ${error.code || error.message}`);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    server.closeIdleConnections();
  });
}
