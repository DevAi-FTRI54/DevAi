import 'dotenv/config';

// Must run before vector.service.ts is imported: it reads QDRANT_COLLECTION at module load.
export const EVAL_COLLECTION =
  process.env.EVAL_QDRANT_COLLECTION ?? 'devai_eval_01';
process.env.QDRANT_COLLECTION = EVAL_COLLECTION;

// Optional: point evals at a different Qdrant (e.g. a local instance) than the app uses.
if (process.env.EVAL_QDRANT_URL) {
  process.env.QDRANT_URL = process.env.EVAL_QDRANT_URL;
  process.env.QDRANT_API_KEY = process.env.EVAL_QDRANT_API_KEY ?? '';
}
