import { ChatApi } from './ChatApi.js';
import { ChatApp } from './ChatApp.js';
import { ChatView } from './ChatView.js';
import { VerifySecretApp } from './VerifySecretApp.js';

const api = new ChatApi();
const app = new ChatApp({ api, view: new ChatView(document) });
new VerifySecretApp({ api, document }).initialize();
void app.initialize();
