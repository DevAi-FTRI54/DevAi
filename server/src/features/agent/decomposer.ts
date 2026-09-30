// Splits a question into the parts that each need their own evidence (agentic-v1.1).
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import type { Callbacks } from '@langchain/core/callbacks/manager';

export const MAX_SUBGOALS = 5;

export type Decomposer = (
  input: { question: string; type?: string },
  options: { signal: AbortSignal; callbacks?: Callbacks },
) => Promise<{ subgoals: string[]; promptTokens?: number; completionTokens?: number }>;

const schema = z.object({ subgoals: z.array(z.string()) });

const SYSTEM = `You split a question about a code repository into subgoals: the separate parts a complete answer must cover, each needing its own evidence.

Rules:
- A single-part question has exactly one subgoal: the question itself.
- Split only on genuinely separate asks (e.g. "how X works AND where Y is configured", "trace A through B to C", "compare P and Q"). Do not invent parts the question does not ask for.
- At most ${MAX_SUBGOALS} subgoals, in the order the question asks them. Each is one short, self-contained sentence.`;

// Trims, drops empties and duplicates, caps the count; falls back to the question itself.
export function normalizeSubgoals(subgoals: unknown, question: string): string[] {
  const out: string[] = [];
  for (const s of Array.isArray(subgoals) ? subgoals : []) {
    const text = typeof s === 'string' ? s.trim() : '';
    if (text && !out.some((o) => o.toLowerCase() === text.toLowerCase())) out.push(text);
  }
  return out.length ? out.slice(0, MAX_SUBGOALS) : [question];
}

export function createDefaultDecomposer(model = 'gpt-4o-mini'): Decomposer {
  const llm = new ChatOpenAI({ model, temperature: 0, maxRetries: 2, apiKey: process.env.OPENAI_API_KEY });
  const structured = llm.withStructuredOutput(schema, { method: 'jsonSchema', strict: true, includeRaw: true });
  return async ({ question, type }, { signal, callbacks }) => {
    const { raw, parsed } = await structured.invoke(
      [
        ['system', SYSTEM],
        ['user', `Question${type ? ` (${type})` : ''}: ${question}`],
      ],
      { signal, callbacks, runName: 'agent-decompose' },
    );
    const usage = (raw as { usage_metadata?: { input_tokens?: number; output_tokens?: number } }).usage_metadata;
    return {
      subgoals: (parsed as { subgoals: string[] }).subgoals,
      promptTokens: usage?.input_tokens ?? 0,
      completionTokens: usage?.output_tokens ?? 0,
    };
  };
}
