// Environment configuration - MUST be imported first in any entry point
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from config folder
dotenv.config({
  path: path.join(__dirname, 'config', '.env'),
});

console.log(
  '🔧 Environment variables loaded from:',
  path.join(__dirname, 'config', '.env')
);
console.log('🔧 PORT:', process.env.PORT);
console.log('🔧 GITHUB_APP_SLUG:', process.env.GITHUB_APP_SLUG);
console.log('🔧 QDRANT_URL set:', !!process.env.QDRANT_URL);
console.log('🔧 OPENAI_API_KEY set:', !!process.env.OPENAI_API_KEY);
