import type { CitationDiagnostics } from '../queries/evidence.js';
import type { ToolName } from '../tools/index.js';

export type AgentLimits = {
  // Tool executions (retries of one call count once; rejected duplicates count zero).
  maxToolCalls: number;
  // Planner turns, including turns whose request was rejected.
  maxIterations: number;
  // Consecutive turns that added no new evidence (duplicates, failures, empty results) before stopping.
  maxNoProgressTurns: number;
  toolTimeoutMs: number;
  // Retries after the first attempt, for transient failures only.
  maxToolRetries: number;
  retryBaseDelayMs: number;
  plannerTimeoutMs: number;
  answerTimeoutMs: number;
  // Retries after the first attempt for transient model failures (timeouts, 429s, network errors).
  maxLlmRetries: number;
  llmRetryBaseDelayMs: number;
  // Wall-clock budget for planning and tools; the final answer gets answerTimeoutMs on top.
  runTimeoutMs: number;
  // Characters of evidence shown to the planner per tool result (the store keeps everything).
  maxObservationChars: number;
  // Rough token budget (chars/4) for evidence given to the final answer.
  maxAnswerEvidenceTokens: number;
};

export const DEFAULT_AGENT_LIMITS: AgentLimits = {
  maxToolCalls: 8,
  maxIterations: 12,
  maxNoProgressTurns: 3,
  toolTimeoutMs: 20_000,
  maxToolRetries: 2,
  retryBaseDelayMs: 250,
  plannerTimeoutMs: 30_000,
  answerTimeoutMs: 60_000,
  maxLlmRetries: 2,
  llmRetryBaseDelayMs: 1_000,
  runTimeoutMs: 120_000,
  maxObservationChars: 8_000,
  maxAnswerEvidenceTokens: 12_000,
};

export type AgentProfile = 'agentic-v1' | 'agentic-v1.1';

export type TerminationReason =
  | 'sufficient_evidence'
  | 'max_tool_calls'
  | 'max_iterations'
  | 'no_progress'
  | 'run_timeout'
  | 'planner_error'
  | 'planner_no_action';

export type ToolCallStatus =
  | 'ok'
  | 'error'
  | 'timeout'
  | 'duplicate'
  | 'budget_exhausted'
  | 'unknown_tool'
  // Refused by an input guard before running (no budget spent).
  | 'rejected_input';

export type ToolStepTrace = {
  index: number;
  tool: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  attempts: number;
  errors: string[];
  // Every evidence ID the call returned, and the subset that was new to the store.
  evidenceIds: string[];
  newEvidenceIds: string[];
  truncated: boolean;
  note?: string;
  latencyMs: number;
};

export type LlmCallTrace = {
  phase: 'plan' | 'answer';
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  error?: string;
};

// How much of the gathered evidence reached the answer and was cited. Tokens are chars/4 of the formatted evidence.
export type EvidenceDiagnostics = {
  evidenceItems: number;
  uniqueFiles: number;
  evidenceTokens: number;
  answerEvidenceItems: number;
  answerEvidenceTokens: number;
  citedEvidenceItems: number;
  // Cited items / all gathered items, and / items shown to the answer step.
  utilization: number | null;
  answerUtilization: number | null;
};

export type AgentTrace = {
  runId: string;
  profile: AgentProfile;
  question: string;
  repoId: string;
  commitSha: string;
  limits: AgentLimits;
  startedAt: string;
  latencyMs: number;
  terminationReason: TerminationReason | null;
  // The planner's stated reason when it declared sufficient evidence.
  finishReason?: string;
  steps: ToolStepTrace[];
  llmCalls: LlmCallTrace[];
  tokens: { promptTokens: number; completionTokens: number };
  toolCalls: number;
  retries: number;
  evidenceCount: number;
  answerEvidenceIds: string[];
  citationDiagnostics: CitationDiagnostics | null;
  diagnostics: EvidenceDiagnostics | null;
  errors: string[];
};

export type ToolCallRequest = { tool: string; args: Record<string, unknown> };

export type ToolOutcome = {
  status: ToolCallStatus;
  step: ToolStepTrace;
  // What the planner sees for this call.
  observation: string;
};

export const isToolName = (name: string): name is ToolName =>
  ['semanticSearch', 'grepSearch', 'readFile', 'findDefinition', 'findReferences'].includes(name);
