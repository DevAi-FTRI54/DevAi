import type { Evidence, EvidenceSource } from '../queries/evidence.js';

export type ToolName = EvidenceSource;

// Evidence as produced by a tool, before an EvidenceStore assigns it a citable ID.
export type ToolEvidence = Omit<Evidence, 'id'> & { commitSha: string };

export type ToolResult = {
  tool: ToolName;
  evidence: ToolEvidence[];
  // More matches existed than were returned (result or line caps).
  truncated: boolean;
  note?: string;
};

export type ToolErrorCode =
  | 'INVALID_INPUT'
  | 'SNAPSHOT_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'UNAVAILABLE';

export class ToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
    readonly tool?: ToolName,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}
