import { Node, SyntaxKind, type Identifier } from 'ts-morph';
import { boundedInt, contextWindows, includeFilter, linesLabel } from './matching.js';
import type { RepoSnapshot } from './snapshot.js';
import { repoPath, sourceFiles } from './ts-project.js';
import { ToolError, type ToolEvidence, type ToolResult } from './types.js';

export type FindReferencesInput = {
  symbol: string;
  // Also return the lines where the name is declared.
  includeDeclarations?: boolean;
  include?: string | string[];
  // Maximum lines with a reference returned.
  maxResults?: number;
  contextLines?: number;
};

export const FIND_REFERENCES_DEFAULT_MAX_RESULTS = 50;
const MAX_RESULTS_LIMIT = 200;
const DEFAULT_CONTEXT = 1;
const MAX_CONTEXT = 10;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

// True when the identifier is the name being declared rather than a use of it.
function isDeclarationName(id: Identifier): boolean {
  const parent = id.getParent();
  if (!parent) return false;
  const declares =
    Node.isFunctionDeclaration(parent) ||
    Node.isClassDeclaration(parent) ||
    Node.isInterfaceDeclaration(parent) ||
    Node.isTypeAliasDeclaration(parent) ||
    Node.isEnumDeclaration(parent) ||
    Node.isEnumMember(parent) ||
    Node.isVariableDeclaration(parent) ||
    Node.isParameterDeclaration(parent) ||
    Node.isMethodDeclaration(parent) ||
    Node.isMethodSignature(parent) ||
    Node.isPropertyDeclaration(parent) ||
    Node.isPropertySignature(parent) ||
    Node.isGetAccessorDeclaration(parent) ||
    Node.isSetAccessorDeclaration(parent) ||
    Node.isBindingElement(parent);
  return declares && (parent as Node & { getNameNode(): Node | undefined }).getNameNode() === id;
}

// Syntactic, name-based: every identifier token with this name, never comments or strings.
export async function findReferences(snapshot: RepoSnapshot, input: FindReferencesInput): Promise<ToolResult> {
  const symbol = typeof input?.symbol === 'string' ? input.symbol.trim() : '';
  if (!IDENTIFIER.test(symbol)) {
    throw new ToolError('INVALID_INPUT', 'symbol must be a single identifier', 'findReferences');
  }
  const included = includeFilter(input.include, 'findReferences');
  const maxResults = boundedInt(
    input.maxResults,
    'maxResults',
    FIND_REFERENCES_DEFAULT_MAX_RESULTS,
    1,
    MAX_RESULTS_LIMIT,
    'findReferences',
  );
  const context = boundedInt(input.contextLines, 'contextLines', DEFAULT_CONTEXT, 0, MAX_CONTEXT, 'findReferences');

  const evidence: ToolEvidence[] = [];
  let lineCount = 0;
  let files = 0;
  let truncated = false;

  for (const sf of sourceFiles(snapshot)) {
    const file = repoPath(sf);
    if (!included(file)) continue;
    const lines = new Set<number>();
    for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (id.getText() !== symbol) continue;
      if (!input.includeDeclarations && isDeclarationName(id)) continue;
      lines.add(id.getStartLineNumber());
    }
    if (!lines.size) continue;
    const hits = [...lines].sort((a, b) => a - b);
    const room = maxResults - lineCount;
    if (hits.length > room) {
      truncated = true;
      hits.length = room;
    }
    if (hits.length) {
      files++;
      lineCount += hits.length;
      const total = snapshot.readLines(file).length;
      for (const [start, end, at] of contextWindows(hits, context, total)) {
        evidence.push(snapshot.evidence(file, start, end, 'findReferences', linesLabel(symbol, at)));
      }
    }
    if (truncated) break;
  }

  const summary = `${lineCount} line${lineCount === 1 ? '' : 's'} referencing ${symbol} in ${files} file${files === 1 ? '' : 's'}`;
  return {
    tool: 'findReferences',
    evidence,
    truncated,
    note: `${summary}${truncated ? `; stopped at maxResults=${maxResults}` : ''}. Matches are by name, so same-named symbols are included.`,
  };
}
