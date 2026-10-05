// Reranking uses the Cohere trial key only; COHERE_API_KEY is not read.
export const COHERE_KEY_VAR = 'COHERE_API_KEY_TRIAL';

export const cohereApiKey = (): string | undefined => process.env[COHERE_KEY_VAR]?.trim() || undefined;
