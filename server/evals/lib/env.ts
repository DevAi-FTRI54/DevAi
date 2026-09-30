// Must be imported before anything under src/: vector.service.ts and db.ts read connection settings at module load.
//
// .env      -> API keys only (OpenAI, Cohere) are used by evals.
// .env.eval -> every service the eval touches. Evals never fall back to the app's QDRANT_URL / MONGO_URI.
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EVAL_ENV_FILE = path.join(SERVER_DIR, '.env.eval');
const PRODUCTION_COLLECTIONS = new Set(['devai_collection_01']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

dotenv.config({ path: path.join(SERVER_DIR, '.env') });
if (!fs.existsSync(EVAL_ENV_FILE)) {
  throw new Error(`Missing ${EVAL_ENV_FILE}. Evals only run against services configured there.`);
}
dotenv.config({ path: EVAL_ENV_FILE });

const appQdrantUrl = process.env.QDRANT_URL;
const appMongoUri = process.env.MONGO_URI;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set in .env.eval`);
  return value;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error(`Invalid eval service URL: ${url}`);
  }
};

const allowRemote = process.env.EVAL_ALLOW_REMOTE_SERVICES === 'true';

function assertEvalTarget(name: string, evalUrl: string, appUrl: string | undefined) {
  if (appUrl && hostOf(evalUrl) === hostOf(appUrl) && !LOCAL_HOSTS.has(hostOf(evalUrl))) {
    throw new Error(`${name} points at the same host as the app (${hostOf(evalUrl)}). Refusing to run evals against production.`);
  }
  if (!LOCAL_HOSTS.has(hostOf(evalUrl)) && !allowRemote) {
    throw new Error(
      `${name} is remote (${hostOf(evalUrl)}). Set EVAL_ALLOW_REMOTE_SERVICES=true in .env.eval to use a dedicated remote eval service.`,
    );
  }
}

const qdrantUrl = required('EVAL_QDRANT_URL');
const mongoUri = required('EVAL_MONGO_URI');
export const EVAL_COLLECTION = required('EVAL_QDRANT_COLLECTION');

assertEvalTarget('EVAL_QDRANT_URL', qdrantUrl, appQdrantUrl);
assertEvalTarget('EVAL_MONGO_URI', mongoUri, appMongoUri);
if (PRODUCTION_COLLECTIONS.has(EVAL_COLLECTION)) {
  throw new Error(`EVAL_QDRANT_COLLECTION=${EVAL_COLLECTION} is a production collection.`);
}

process.env.QDRANT_URL = qdrantUrl;
process.env.QDRANT_API_KEY = process.env.EVAL_QDRANT_API_KEY ?? '';
process.env.QDRANT_COLLECTION = EVAL_COLLECTION;
process.env.MONGO_URI = mongoUri;

export const EVAL_TARGETS = `Qdrant ${hostOf(qdrantUrl)}/${EVAL_COLLECTION}, MongoDB ${hostOf(mongoUri)}`;
