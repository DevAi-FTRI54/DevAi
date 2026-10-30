// Rejects findReferences/findDefinition calls whose symbol is prose or a name that never occurs in the
// snapshot, before they spend tool budget.
import type { RepoSnapshot } from '../tools/index.js';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const TOKEN = /[A-Za-z_$][\w$]*/g;

const identifiers = new WeakMap<RepoSnapshot, Set<string>>();

// Every identifier-shaped token in the snapshot's text files.
export function snapshotIdentifiers(snapshot: RepoSnapshot): Set<string> {
  let set = identifiers.get(snapshot);
  if (set) return set;
  set = new Set<string>();
  for (const file of snapshot.listFiles()) {
    for (const line of snapshot.readLines(file)) for (const m of line.matchAll(TOKEN)) set.add(m[0]);
  }
  identifiers.set(snapshot, set);
  return set;
}

export type ToolGuard = (tool: string, args: Record<string, unknown>) => string | null;

const DISCOVER = 'Use semanticSearch to discover code by description, or grepSearch to find exact text and real names.';

export function symbolGuard(snapshot: RepoSnapshot): ToolGuard {
  return (tool, args) => {
    if (tool !== 'findReferences' && tool !== 'findDefinition') return null;
    const symbol = typeof args.symbol === 'string' ? args.symbol.trim() : '';
    const parts = tool === 'findDefinition' ? symbol.split('.') : [symbol];
    const shaped = parts.length <= 2 && parts.every((p) => IDENTIFIER.test(p));
    if (!shaped) {
      return `${tool} needs one exact identifier from the code${tool === 'findDefinition' ? ' (or Class.member)' : ''}, not "${symbol}". ${DISCOVER}`;
    }
    const known = snapshotIdentifiers(snapshot);
    const missing = parts.filter((p) => !known.has(p));
    if (missing.length) {
      return `"${missing.join('", "')}" does not occur anywhere in the repository at ${snapshot.commitSha.slice(0, 7)}; it is not a real name here. ${DISCOVER}`;
    }
    return null;
  };
}
