import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { BaseMessage } from '@langchain/core/messages';
import type { LLMResult } from '@langchain/core/outputs';

// USD. Verify against current vendor pricing before recording a baseline.
export const PRICES = {
  chat: {
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
    'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  } as Record<string, { inputPer1M: number; outputPer1M: number }>,
  embeddingPer1M: 0.13, // text-embedding-3-large
  rerankPerSearch: 2.0 / 1000, // Cohere rerank-v3.5
};

export interface ModelUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
}

export class TokenUsageHandler extends BaseCallbackHandler {
  name = 'eval_token_usage';
  usage: Record<string, ModelUsage> = {};
  private models = new Map<string, string>();

  handleChatModelStart(
    llm: Serialized,
    _messages: BaseMessage[][],
    runId: string,
    _parentRunId?: string,
    extraParams?: Record<string, unknown>,
    _tags?: string[],
    metadata?: Record<string, unknown>,
  ) {
    const invocation = extraParams?.invocation_params as
      | Record<string, unknown>
      | undefined;
    const model =
      (metadata?.ls_model_name as string | undefined) ??
      (invocation?.model as string | undefined) ??
      'unknown';
    this.models.set(runId, model);
  }

  handleLLMEnd(output: LLMResult, runId: string) {
    const model = this.models.get(runId) ?? 'unknown';
    let prompt = 0;
    let completion = 0;
    const tu = output.llmOutput?.tokenUsage as
      | { promptTokens?: number; completionTokens?: number }
      | undefined;
    if (tu && (tu.promptTokens || tu.completionTokens)) {
      prompt = tu.promptTokens ?? 0;
      completion = tu.completionTokens ?? 0;
    } else {
      for (const gen of output.generations.flat()) {
        const meta = (gen as any).message?.usage_metadata;
        prompt += meta?.input_tokens ?? 0;
        completion += meta?.output_tokens ?? 0;
      }
    }
    const u = (this.usage[model] ??= { calls: 0, promptTokens: 0, completionTokens: 0 });
    u.calls += 1;
    u.promptTokens += prompt;
    u.completionTokens += completion;
  }

  totals() {
    return Object.values(this.usage).reduce(
      (acc, u) => ({
        calls: acc.calls + u.calls,
        promptTokens: acc.promptTokens + u.promptTokens,
        completionTokens: acc.completionTokens + u.completionTokens,
      }),
      { calls: 0, promptTokens: 0, completionTokens: 0 },
    );
  }
}

function priceFor(model: string) {
  const key = Object.keys(PRICES.chat)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.startsWith(k));
  return PRICES.chat[key ?? 'gpt-4o-mini'];
}

export function chatCost(usage: Record<string, ModelUsage>): number {
  return Object.entries(usage).reduce((sum, [model, u]) => {
    const p = priceFor(model);
    return (
      sum +
      (u.promptTokens / 1e6) * p.inputPer1M +
      (u.completionTokens / 1e6) * p.outputPer1M
    );
  }, 0);
}

// Query embeddings don't go through chat callbacks: estimate the original question plus 3 MultiQuery rewrites at chars/4.
export const estimateQueryEmbeddingTokens = (question: string) =>
  4 * Math.ceil(question.length / 4);
