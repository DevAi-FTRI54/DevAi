import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@langchain/core/documents';
import { buildImportGraph, importNeighbors, expansionFiles, dedupeDocs } from '../src/features/queries/expansion.js';

const doc = (filePath: string, startLine: number, content: string) =>
  new Document({ pageContent: content, metadata: { filePath, startLine, endLine: startLine + 1 } });

test('import graph resolves relative static and dynamic imports both ways', () => {
  const src: Record<string, string> = {
    'server/src/app.ts': "import routes from './features/index.routes.js';\nimport express from 'express';",
    'server/src/features/index.routes.ts': "import { indexRepo } from './index.controller.js';",
    'server/src/features/index.controller.ts': "const m = await import('./index.job.js');",
    'server/src/features/index.job.ts': "import { upsert } from './vector.service';",
    'server/src/features/vector.service.ts': '',
    'server/src/features/unused.ts': "import { upsert } from './vector.service.js';",
  };
  const graph = buildImportGraph(Object.keys(src), (f) => src[f]);
  assert.deepEqual([...graph.imports.get('server/src/features/index.controller.ts')!], ['server/src/features/index.job.ts']);
  assert.deepEqual(importNeighbors(graph, ['server/src/features/index.job.ts']), [
    'server/src/features/index.controller.ts',
    'server/src/features/vector.service.ts',
  ]);
  assert.deepEqual(importNeighbors(graph, ['server/src/features/vector.service.ts']), [
    'server/src/features/index.job.ts',
    'server/src/features/unused.ts',
  ]);
});

test('expansion files are the top files plus their neighbors; no graph means same-file only', () => {
  const src: Record<string, string> = { 'a.ts': "import './b.js';", 'b.ts': '', 'c.ts': "import './a';" };
  const graph = buildImportGraph(Object.keys(src), (f) => src[f]);
  const top = [doc('a.ts', 1, 'x'), doc('a.ts', 10, 'y')];
  assert.deepEqual(expansionFiles(top, graph).sort(), ['a.ts', 'b.ts', 'c.ts']);
  assert.deepEqual(expansionFiles(top, null), ['a.ts']);
  assert.equal(dedupeDocs([doc('a.ts', 1, 'x'), doc('a.ts', 1, 'x'), doc('a.ts', 10, 'y')]).length, 2);
});
