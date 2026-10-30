import { Node } from 'ts-morph';
import type { RepoSnapshot } from './snapshot.js';
import { repoPath, sourceFiles } from './ts-project.js';
import { ToolError, type ToolEvidence, type ToolResult } from './types.js';

export type DefinitionKind =
  | 'function'
  | 'class'
  | 'method'
  | 'property'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable';

export type FindDefinitionInput = {
  // A declaration name ("verify"), or Class.member ("AuthService.verify").
  symbol: string;
  kind?: DefinitionKind;
  maxResults?: number;
};

export const FIND_DEFINITION_MAX_RESULTS = 20;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

type Found = { kind: DefinitionKind; name: string; node: Node };

// Named declarations a definition lookup can land on. Variables count only at module/namespace level.
function declarationOf(node: Node): Found | undefined {
  if (Node.isFunctionDeclaration(node) && node.getName()) {
    return { kind: 'function', name: node.getName()!, node };
  }
  if (Node.isClassDeclaration(node) && node.getName()) return { kind: 'class', name: node.getName()!, node };
  if (Node.isInterfaceDeclaration(node)) return { kind: 'interface', name: node.getName(), node };
  if (Node.isTypeAliasDeclaration(node)) return { kind: 'type', name: node.getName(), node };
  if (Node.isEnumDeclaration(node)) return { kind: 'enum', name: node.getName(), node };
  if (Node.isVariableDeclaration(node) && Node.isIdentifier(node.getNameNode())) {
    const statement = node.getVariableStatement();
    const parent = statement?.getParent();
    if (statement && (Node.isSourceFile(parent) || Node.isModuleBlock(parent))) {
      // A single-declaration statement spans its export keyword and JSDoc.
      const span = statement.getDeclarations().length === 1 ? statement : node;
      return { kind: 'variable', name: node.getName(), node: span };
    }
    return undefined;
  }
  const owner = node.getParent();
  if (Node.isClassDeclaration(owner) && owner.getName()) {
    const member = `${owner.getName()}.`;
    if (Node.isMethodDeclaration(node) || Node.isGetAccessorDeclaration(node) || Node.isSetAccessorDeclaration(node)) {
      return { kind: 'method', name: member + node.getName(), node };
    }
    if (Node.isPropertyDeclaration(node)) return { kind: 'property', name: member + node.getName(), node };
  }
  return undefined;
}

export async function findDefinition(snapshot: RepoSnapshot, input: FindDefinitionInput): Promise<ToolResult> {
  const symbol = typeof input?.symbol === 'string' ? input.symbol.trim() : '';
  const parts = symbol.split('.');
  if (!symbol || parts.length > 2 || !parts.every((p) => IDENTIFIER.test(p))) {
    throw new ToolError('INVALID_INPUT', 'symbol must be an identifier or Class.member', 'findDefinition');
  }
  const maxResults = input.maxResults ?? FIND_DEFINITION_MAX_RESULTS;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > FIND_DEFINITION_MAX_RESULTS) {
    throw new ToolError('INVALID_INPUT', `maxResults must be an integer from 1 to ${FIND_DEFINITION_MAX_RESULTS}`, 'findDefinition');
  }
  // A bare name also matches class members ("verify" finds AuthService.verify).
  const matches = (name: string) => name === symbol || (parts.length === 1 && name.endsWith(`.${symbol}`));

  const found: ToolEvidence[] = [];
  let total = 0;
  for (const sf of sourceFiles(snapshot)) {
    sf.forEachDescendant((node) => {
      const decl = declarationOf(node);
      if (!decl || !matches(decl.name) || (input.kind && decl.kind !== input.kind)) return;
      total++;
      if (found.length >= maxResults) return;
      found.push(
        snapshot.evidence(
          repoPath(sf),
          decl.node.getStartLineNumber(true),
          decl.node.getEndLineNumber(),
          'findDefinition',
          `${decl.kind} ${decl.name}`,
        ),
      );
    });
  }

  const truncated = total > found.length;
  return {
    tool: 'findDefinition',
    evidence: found,
    truncated,
    note: total
      ? `${total} definition${total === 1 ? '' : 's'} of ${symbol}${truncated ? `; showing ${found.length}` : ''}.`
      : `No definition of ${symbol} found in ${snapshot.commitSha.slice(0, 7)}.`,
  };
}
