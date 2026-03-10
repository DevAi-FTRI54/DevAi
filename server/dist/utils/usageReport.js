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
/** Extract "owner/repo" style name from repo URL for display. */
function repoDisplayName(repoUrl) {
    if (!repoUrl)
        return '(no repo)';
    try {
        const u = new URL(repoUrl.startsWith('http') ? repoUrl : `https://${repoUrl}`);
        const path = u.pathname.replace(/^\//, '').replace(/\.git$/, '');
        return path || repoUrl;
    }
    catch {
        return repoUrl;
    }
}
/**
 * Aggregate from Conversation: unique users, session count, query count, and query entries (text + timestamp + repo).
 * Joins User for username (by _id and fallback by username in case of legacy data).
 */
export async function buildUsageReport() {
    const conversations = await Conversation.find({}).lean();
    const userIds = [
        ...new Set(conversations.map((c) => String(c.userId).trim()).filter(Boolean)),
    ];
    const objectIds = userIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    const nonObjectIdIds = userIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    const usersById = objectIds.length > 0
        ? await User.find({ _id: { $in: objectIds } }).lean()
        : [];
    const usersByUsername = nonObjectIdIds.length > 0
        ? await User.find({ username: { $in: nonObjectIdIds } }).lean()
        : [];
    const userMapById = new Map(usersById.map((u) => [u._id.toString(), u.username]));
    const userMapByLegacyId = new Map(usersByUsername.map((u) => [u.username, u.username]));
    const rows = [];
    for (const uid of userIds) {
        const userConvs = conversations.filter((c) => String(c.userId).trim() === uid);
        const sessionIds = new Set(userConvs.map((c) => c.sessionId));
        const queries = [];
        for (const conv of userConvs) {
            const repoUrl = conv.repoUrl || '';
            const repoName = repoDisplayName(repoUrl);
            for (const msg of conv.messages || []) {
                if (msg.role === 'user' && msg.content) {
                    const ts = msg.timestamp instanceof Date
                        ? msg.timestamp.toISOString()
                        : new Date(msg.timestamp).toISOString();
                    queries.push({
                        query: msg.content,
                        timestamp: ts,
                        repoUrl,
                        repoName,
                    });
                }
            }
        }
        const username = userMapById.get(uid) ?? userMapByLegacyId.get(uid) ?? null;
        // Per user: queries most recent first (chronological with newest at top)
        queries.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
        rows.push({
            userId: uid,
            username,
            sessionCount: sessionIds.size,
            queryCount: queries.length,
            queries,
        });
    }
    // Users ordered by most recent activity first (each user's newest query timestamp)
    rows.sort((a, b) => {
        const aLatest = a.queries[0]?.timestamp ?? '';
        const bLatest = b.queries[0]?.timestamp ?? '';
        return bLatest > aLatest ? 1 : bLatest < aLatest ? -1 : 0;
    });
    return rows;
}
/**
 * Format report as plain text and optionally write to logs/usage-report.txt.
 */
export async function writeUsageReportToFile() {
    const rows = await buildUsageReport();
    const lines = [
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
        for (const entry of r.queries) {
            const preview = entry.query.length > 120
                ? entry.query.slice(0, 117) + '...'
                : entry.query;
            const oneLine = preview.replace(/\n/g, ' ');
            lines.push(`  [${entry.timestamp}]  repo: ${entry.repoName}`);
            lines.push(`    ${oneLine}`);
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
export function appendQueryLog(params) {
    try {
        if (!fs.existsSync(LOGS_DIR)) {
            fs.mkdirSync(LOGS_DIR, { recursive: true });
        }
        const isNewFile = !fs.existsSync(QUERY_LOG_PATH);
        if (isNewFile) {
            fs.writeFileSync(QUERY_LOG_PATH, 'timestamp\tuserId\tsessionId\trepoUrl\tquery (repo query = user question about the repo, same as in Conversation)\n', 'utf8');
            console.log('[Query log] File created at:', path.resolve(QUERY_LOG_PATH));
        }
        const preview = params.query.length > 200
            ? params.query.slice(0, 197) + '...'
            : params.query;
        const line = `${new Date().toISOString()}\t${params.userId ?? 'anonymous'}\t${params.sessionId}\t${params.repoUrl}\t${preview.replace(/\n/g, ' ')}\n`;
        fs.appendFileSync(QUERY_LOG_PATH, line, 'utf8');
        console.log('[Query log] Repo query appended. Full path:', path.resolve(QUERY_LOG_PATH));
    }
    catch (err) {
        console.error('Failed to append query log:', err);
    }
}
/**
 * Return the contents of the query log file if it exists (for viewing via API when server runs on Render).
 */
export function readQueryLog() {
    try {
        if (fs.existsSync(QUERY_LOG_PATH)) {
            return fs.readFileSync(QUERY_LOG_PATH, 'utf8');
        }
        return null;
    }
    catch {
        return null;
    }
}
export { USAGE_REPORT_PATH, QUERY_LOG_PATH, LOGS_DIR };
