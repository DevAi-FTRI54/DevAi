/**
 * Builds a usage report from Conversation and User collections.
 * Use for auditing who is using the app and how much (sessions, queries).
 * Past data comes from existing Conversation documents; run this on-demand or on a schedule.
 * Logs are written to server/logs/ (relative to app code) so they stay in the workspace and are easy to open in Cursor.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Conversation from '../models/conversation.model.js';
import User from '../models/user.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', '..', 'logs');
const USAGE_REPORT_PATH = path.join(LOGS_DIR, 'usage-report.txt');
const QUERY_LOG_PATH = path.join(LOGS_DIR, 'query-log.txt');

export interface UserUsageRow {
  userId: string;
  username: string | null;
  sessionCount: number;
  queryCount: number;
  queries: string[];
}

/**
 * Aggregate from Conversation: unique users, session count, query count, and query texts.
 * Joins User for username when available.
 */
export async function buildUsageReport(): Promise<UserUsageRow[]> {
  const conversations = await Conversation.find({}).lean();
  const userIds = [
    ...new Set(conversations.map((c) => String(c.userId)).filter(Boolean)),
  ];
  const objectIds = userIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const users =
    objectIds.length > 0
      ? await User.find({ _id: { $in: objectIds } }).lean()
      : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), u.username]));

  const rows: UserUsageRow[] = [];
  for (const uid of userIds) {
    const userConvs = conversations.filter((c) => String(c.userId) === uid);
    const sessionIds = new Set(userConvs.map((c) => c.sessionId));
    const queries: string[] = [];
    for (const conv of userConvs) {
      for (const msg of conv.messages || []) {
        if (msg.role === 'user' && msg.content) {
          queries.push(msg.content);
        }
      }
    }
    rows.push({
      userId: uid,
      username: userMap.get(uid) ?? null,
      sessionCount: sessionIds.size,
      queryCount: queries.length,
      queries,
    });
  }
  // Sort by query count descending so heaviest users are first
  rows.sort((a, b) => b.queryCount - a.queryCount);
  return rows;
}

/**
 * Format report as plain text and optionally write to logs/usage-report.txt.
 */
export async function writeUsageReportToFile(): Promise<string> {
  const rows = await buildUsageReport();
  const lines: string[] = [
    '=== DevAI Usage Report ===',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This report lists repo queries: each time a user asked a question about a repo in the app',
    '(the same events stored in Conversation). Sessions = distinct conversation sessions per user.',
    '',
    '--- Summary ---',
    `Unique users: ${rows.length}`,
    `Total queries (all users): ${rows.reduce((s, r) => s + r.queryCount, 0)}`,
    `Total sessions (all users): ${rows.reduce((s, r) => s + r.sessionCount, 0)}`,
    '',
    '--- Per user ---',
  ];
  for (const r of rows) {
    lines.push(`UserId: ${r.userId}`);
    lines.push(`Username: ${r.username ?? '(unknown)'}`);
    lines.push(`Sessions: ${r.sessionCount}  Queries: ${r.queryCount}`);
    lines.push('Queries:');
    for (const q of r.queries) {
      const preview = q.length > 120 ? q.slice(0, 117) + '...' : q;
      lines.push(`  - ${preview.replace(/\n/g, ' ')}`);
    }
    lines.push('');
  }
  const content = lines.join('\n');
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  fs.writeFileSync(USAGE_REPORT_PATH, content, 'utf8');
  return content;
}

/**
 * Append one line to the running query log. Call this only for a repo query:
 * when a user asks a question about a repo in the app (same event stored in Conversation).
 * Format: ISO timestamp, userId, sessionId, repoUrl, query preview.
 */
export function appendQueryLog(params: {
  userId: string | undefined;
  sessionId: string;
  repoUrl: string;
  query: string;
}): void {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const isNewFile = !fs.existsSync(QUERY_LOG_PATH);
    if (isNewFile) {
      fs.writeFileSync(
        QUERY_LOG_PATH,
        'timestamp\tuserId\tsessionId\trepoUrl\tquery (repo query = user question about the repo, same as in Conversation)\n',
        'utf8',
      );
    }
    const preview =
      params.query.length > 200
        ? params.query.slice(0, 197) + '...'
        : params.query;
    const line = `${new Date().toISOString()}\t${params.userId ?? 'anonymous'}\t${params.sessionId}\t${params.repoUrl}\t${preview.replace(/\n/g, ' ')}\n`;
    fs.appendFileSync(QUERY_LOG_PATH, line, 'utf8');
    console.log('[Query log] Repo query appended to', QUERY_LOG_PATH);
  } catch (err) {
    console.error('Failed to append query log:', err);
  }
}

export { USAGE_REPORT_PATH, QUERY_LOG_PATH, LOGS_DIR };
