// Final answer from gathered evidence. The model returns only evidence IDs and line ranges;
// citations are assembled server-side by the deterministic citation layer.
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import type { Callbacks } from '@langchain/core/callbacks/manager';
import { SYSTEM_PROMPTS } from '../queries/prompts.js';
import type { EvidenceReference } from '../queries/evidence.js';

export type AnswerDraft = { answer: string; citations: EvidenceReference[] };

export type Answerer = (
  prompt: { system: string; user: string },
  options: { signal: AbortSignal; callbacks?: Callbacks },
) => Promise<{ draft: AnswerDraft; promptTokens: number; completionTokens: number }>;

const answerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({ evidenceId: z.string(), startLine: z.number(), endLine: z.number() })),
});

export function answerSystemPrompt(type: string | undefined): string {
  const prompts = SYSTEM_PROMPTS as Record<string, { content: string }>;
  const key =
    Object.keys(prompts).find((k) => k.toLowerCase() === String(type ?? '').toLowerCase()) ?? 'Find';
  return `Your system prompt:\n\n${prompts[key].content}`;
}

export function answerUserPrompt(question: string, evidence: string): string {
  return `Use the following evidence, gathered from the repository by code-search tools, to answer the question at the end.

Each context block is an evidence item with an ID like [E1] and numbered source lines.
Cite evidence only by its ID with the startLine/endLine (from the line numbers shown) that support your answer.
Do not copy code into citations; the server attaches the exact source text.
Answer the question completely using all of the available evidence. Citations identify supporting evidence;
do not shorten or narrow the explanation because snippets are attached separately.
If the evidence does not contain the answer, say what is missing instead of guessing.

Context: ${evidence || '(no evidence was gathered)'}

Question: ${question}

Helpful answer:`;
}

export function createDefaultAnswerer(model = 'gpt-4o-mini'): Answerer {
  const llm = new ChatOpenAI({ model, temperature: 0, maxRetries: 2, apiKey: process.env.OPENAI_API_KEY });
  const structured = llm.withStructuredOutput(answerSchema, { method: 'jsonSchema', strict: true, includeRaw: true });
  return async ({ system, user }, { signal, callbacks }) => {
    const { raw, parsed } = await structured.invoke(
      [
        ['system', system],
        ['user', user],
      ],
      { signal, callbacks, runName: 'agent-answer' },
    );
    const usage = (raw as { usage_metadata?: { input_tokens?: number; output_tokens?: number } }).usage_metadata;
    return {
      draft: parsed as AnswerDraft,
      promptTokens: usage?.input_tokens ?? 0,
      completionTokens: usage?.output_tokens ?? 0,
    };
  };
}
