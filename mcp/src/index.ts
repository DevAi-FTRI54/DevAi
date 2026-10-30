import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { readRepo } from './read.js';
import { resolveRepoRoot } from './repo.js';

function createServer(): McpServer {
  const repoRoot = resolveRepoRoot();
  const server = new McpServer({
    name: 'devai',
    version: '0.1.0',
  });

  server.registerTool(
    'read',
    {
      title: 'Read DevAI source',
      description: [
        'Read-only access to the DevAI repository.',
        'Omit path (or pass ".") to list the source tree.',
        'Pass a directory to list files under it.',
        'Pass a file to return its contents.',
        'Pass glob (e.g. "server/src/**/*.ts") to read matching files in one call, up to maxBytes.',
        'Secrets, node_modules, build output, and binaries are skipped. Paths cannot leave the repo.',
      ].join(' '),
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe('Repo-relative path. Omit or "." to list the tree; pass a file to read it.'),
        glob: z
          .string()
          .optional()
          .describe('Optional glob relative to the repo, e.g. server/src/**/*.ts or client/src/**/*.{ts,tsx}.'),
        maxBytes: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum bytes of file contents to return (default 120000). Tree listings are not capped this way.'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path: repoPath, glob, maxBytes }) => {
      try {
        const text = readRepo(repoRoot, { path: repoPath, glob, maxBytes });
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: message }],
          isError: true,
        };
      }
    }
  );

  return server;
}

void serveStdio(createServer);
console.error(`devai MCP server running (repo: ${resolveRepoRoot()})`);
