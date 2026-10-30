import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import type { GoldenItem } from './golden.js';
import type { Citation } from './citations.js';
import { TokenUsageHandler } from './tokens.js';

export const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? 'gpt-4o';

const verdictSchema = z.object({
  facts: z.array(
    z.object({
      fact: z.string(),
      covered: z.boolean(),
      evidence: z.string(),
    }),
  ),
  correctness: z.enum(['wrong', 'partial', 'correct']),
  rationale: z.string(),
});

export interface JudgeResult {
  correctness: 0 | 1 | 2;
  completeness: number;
  rationale: string;
  facts: { fact: string; covered: boolean; evidence: string }[];
  factCountMismatch: boolean;
  usage: TokenUsageHandler['usage'];
}

const SCORE = { wrong: 0, partial: 1, correct: 2 } as const;

const SYSTEM = `You grade answers from a code question-answering assistant against a reference.

You receive the question, a numbered list of reference key facts written by someone who knows the codebase, the expected source files, and the assistant's answer with its citations.

1. For EACH reference fact, in the same order, decide whether the answer states or clearly implies it. Copy the fact text into "fact". Put a short quote or paraphrase from the answer in "evidence" (empty string if not covered). Return exactly one entry per reference fact.
2. Grade overall correctness. Correctness is about the ACCURACY of what the answer states, not how much it covers; coverage is already measured by step 1, so do not lower correctness just because reference facts are missing.
   - "correct": everything the answer claims is accurate and it directly answers the question.
   - "partial": the answer is mostly accurate but contains a minor error (for example wrong line numbers or a slightly wrong detail), or it is so vague that it does not actually answer the question.
   - "wrong": the main claim is incorrect, the answer contradicts the reference, invents code, files, or behavior, or says nothing relevant was found when the reference shows it exists.
   Do not penalize extra details unless they are wrong. Judge only against the reference and the question; do not assume facts beyond the reference.
3. Give a one-sentence rationale.`;

let judgeLlm: ReturnType<ChatOpenAI['withStructuredOutput']> | null = null;

function getJudge() {
  judgeLlm ??= new ChatOpenAI({
    model: JUDGE_MODEL,
    temperature: 0,
    maxRetries: 2,
  }).withStructuredOutput(verdictSchema, { method: 'jsonSchema', strict: true });
  return judgeLlm;
}

export async function judgeAnswer(
  item: GoldenItem,
  answer: string,
  citations: Citation[],
): Promise<JudgeResult> {
  const facts = item.key_facts.map((f, i) => `${i + 1}. ${f}`).join('\n');
  const sources = item.expected_sources
    .map((s) => `- ${s.file}${s.lines ? ` (lines ${s.lines[0]}-${s.lines[1]})` : ''}${s.symbol ? ` [${s.symbol}]` : ''}`)
    .join('\n');
  const cites = citations.length
    ? citations.map((c) => `- ${c.file} (lines ${c.startLine}-${c.endLine})`).join('\n')
    : '(none)';

  const user = `QUESTION:
${item.question}

REFERENCE KEY FACTS:
${facts}

EXPECTED SOURCES:
${sources}

ASSISTANT ANSWER:
${answer || '(empty)'}

ASSISTANT CITATIONS:
${cites}`;

  const handler = new TokenUsageHandler();
  const verdict = (await getJudge().invoke(
    [
      ['system', SYSTEM],
      ['user', user],
    ],
    { callbacks: [handler] },
  )) as z.infer<typeof verdictSchema>;

  const n = Math.min(verdict.facts.length, item.key_facts.length);
  const covered = verdict.facts.slice(0, n).filter((f) => f.covered).length;

  return {
    correctness: SCORE[verdict.correctness],
    completeness: item.key_facts.length ? covered / item.key_facts.length : 0,
    rationale: verdict.rationale,
    facts: verdict.facts,
    factCountMismatch: verdict.facts.length !== item.key_facts.length,
    usage: handler.usage,
  };
}
