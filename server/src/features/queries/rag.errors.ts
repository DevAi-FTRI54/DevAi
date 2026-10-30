// Classifies failures in the RAG pipeline so callers see the real cause instead of a blanket VECTOR_DB_DOWN.
import { isQdrantConnectionError } from '../indexing/vector.service.js';

export type RagErrorCode =
  | 'MODEL_AUTH'
  | 'MODEL_QUOTA'
  | 'MODEL_RATE_LIMIT'
  | 'MODEL_ERROR'
  | 'VECTOR_DB_DOWN'
  | 'INTERNAL';

export type RagStage = 'retrieve' | 'generate';

const USER_MESSAGES: Record<RagErrorCode, string> = {
  MODEL_AUTH: 'The AI model provider rejected our credentials.',
  MODEL_QUOTA: 'The AI model provider quota is exhausted.',
  MODEL_RATE_LIMIT: 'The AI model provider is rate limiting requests. Please try again shortly.',
  MODEL_ERROR: 'The AI model provider returned an error.',
  VECTOR_DB_DOWN: 'The code search index is unavailable.',
  INTERNAL: 'Unexpected server error while answering the question.',
};

export class RagError extends Error {
  readonly code: RagErrorCode;
  readonly stage: RagStage;
  readonly userMessage: string;

  constructor(code: RagErrorCode, stage: RagStage, cause: unknown) {
    const detail = (cause as any)?.message ?? String(cause);
    super(`${code} during ${stage}: ${detail}`, { cause });
    this.name = 'RagError';
    this.code = code;
    this.stage = stage;
    this.userMessage = USER_MESSAGES[code];
  }
}

// LangChain tags OpenAI client errors with lc_error_code (MODEL_AUTHENTICATION, MODEL_RATE_LIMIT, ...);
// quota exhaustion is also tagged MODEL_RATE_LIMIT, so it is checked first via the OpenAI error code.
function classifyModelError(err: any): RagErrorCode | null {
  const status = err?.status;
  const code = err?.code ?? err?.error?.code;
  const type = err?.type ?? err?.error?.type;
  const lcCode: string | undefined = err?.lc_error_code;
  if (code === 'insufficient_quota' || type === 'insufficient_quota' || code === 'credit_balance_exhausted') {
    return 'MODEL_QUOTA';
  }
  if (lcCode === 'MODEL_AUTHENTICATION' || status === 401 || code === 'invalid_api_key') return 'MODEL_AUTH';
  if (lcCode === 'MODEL_RATE_LIMIT' || status === 429) return 'MODEL_RATE_LIMIT';
  if (lcCode?.startsWith('MODEL_') || /openai/i.test(`${err?.constructor?.name} ${err?.message}`)) {
    return 'MODEL_ERROR';
  }
  return null;
}

export function toRagError(err: unknown, stage: RagStage): RagError {
  if (err instanceof RagError) return err;
  const code = classifyModelError(err) ?? (isQdrantConnectionError(err) ? 'VECTOR_DB_DOWN' : 'INTERNAL');
  return new RagError(code, stage, err);
}
