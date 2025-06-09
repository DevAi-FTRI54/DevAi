import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const GITHUB_APP_PRIVATE_KEY = readFileSync(path.join(__dirname, '../../src/config/github-app.pem'), 'utf8');
