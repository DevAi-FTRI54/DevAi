# DevAI MCP server

Read-only MCP server for reviewing this repository from Claude. It exposes a single tool, `read`, scoped to the repo root.

## Tool: `read`

| Call | Result |
|---|---|
| `read` or `read({ path: "." })` | Source tree (files Claude can open next) |
| `read({ path: "server/src/app.ts" })` | That file's contents |
| `read({ path: "server/src/features" })` | Listing of that directory |
| `read({ glob: "server/src/**/*.ts" })` | Matching file contents, up to `maxBytes` |

Ignored: `node_modules`, `.git`, `dist`, secrets (`.env`, `*.pem`), binaries, and similar build/cache dirs. Paths cannot leave the repository.

## Setup

```bash
cd mcp
npm install
```

### Cursor

This repo’s project MCP config is `.cursor/mcp.json`. After it is saved, open **Customize → MCPs**. You should see **devai**. If Cursor prompts to enable it, accept. If it still does not show, reload the window.

The entry uses the same Node + tsx stdio pattern as your other local MCP servers. It does not use Claude Desktop’s `.mcp.json`.

### Claude Desktop

Claude Desktop does not read `.cursor/mcp.json`. Add a `devai` entry to `~/Library/Application Support/Claude/claude_desktop_config.json` with absolute paths to this clone (see the root [README](../README.md#mcp-server-read-only)), then fully quit and reopen the app (Cmd+Q). Check **Settings → Developer** (or Connectors) for **devai** and one tool named `read`.

### Claude Code

This repo includes `.mcp.json`. From the repo root:

```bash
claude mcp add --scope project
```

Or start Claude Code in this directory; it will pick up `.mcp.json`.

### Inspector (optional)

```bash
cd mcp
npm run inspector
```

Then call `read` with no arguments to confirm the tree comes back.
