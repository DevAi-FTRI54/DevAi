import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const GITHUB_APP_PRIVATE_KEY =
  process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!process.env.GITHUB_APP_PRIVATE_KEY) {
  throw new Error('GITHUB_APP_PRIVATE_KEY is not set in environment variables');
}
