import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Secret } from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Check first
if (!process.env.GITHUB_APP_PRIVATE_KEY) {
  throw new Error('GITHUB_APP_PRIVATE_KEY is not set in environment variables');
}

// ✅ Then safely assign
export const GITHUB_APP_PRIVATE_KEY: Secret =
  process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
