import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import type { ChatHistoryEntry } from '../../types';
import type { ChatInputProps, Repo } from '../../types';

const REPO_KEY = 'devai_repo';

const COLUMNS = [
  { key: 'userPrompt', label: 'User Question' },
  { key: 'answer', label: 'Answer' },
  { key: 'file', label: 'File Name' },
  { key: 'startLine', label: 'Start Line' },
  { key: 'endLine', label: 'End Line' },
];
type ColumnKey = (typeof COLUMNS)[number]['key']; // "userPrompt" | "answer" | "file" | "startLine" | "endLine"

const ChatHistory: React.FC<Pick<ChatInputProps, 'repoUrl'>> = ({ repoUrl }) => {
  const [logs, setLogs] = useState<ChatHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- Filter states ---
  const [search, setSearch] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  // (Removed start line range)

  // --- Sorting states ---
  const [sortKey, setSortKey] = useState<ColumnKey>('startLine');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Try to find the full repo object by repoUrl from localStorage
  const repo: Repo | null = useMemo(() => {
    try {
      const str = localStorage.getItem(REPO_KEY);
      if (!str) return null;
      const obj = JSON.parse(str);
      if (obj && obj.html_url === repoUrl) return obj;
    } catch (err) {
      console.error('Error', err);
    }
    return null;
  }, [repoUrl]);

  useEffect(() => {
    let didCancel = false;
    const fetchHistory = async () => {
      try {
        const res = await fetch('https://a59d8fd60bb0.ngrok.app/api/chat/history/flat', {
          method: 'GET',
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid response format: expected an array');
        if (!didCancel) setLogs(data);
      } catch (err: unknown) {
        console.error('❌ Error fetching history:', err);
        if (!didCancel) {
          const errorMessage =
            typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message?: unknown }).message)
              : 'Failed to load chat history';
          setError(errorMessage);
          setLogs([]);
        }
      }
    };
    fetchHistory();
    return () => {
      didCancel = true;
    };
  }, []);

  // --- Filter & Sort logic ---
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Filter: search userPrompt/answer
    if (search.trim()) {
      filtered = filtered.filter(
        (log) =>
          log.userPrompt.toLowerCase().includes(search.toLowerCase()) ||
          log.answer.toLowerCase().includes(search.toLowerCase())
      );
    }
    // Filter: file name
    if (fileFilter.trim()) {
      filtered = filtered.filter((log) => log.file?.toLowerCase().includes(fileFilter.toLowerCase()));
    }
    // Sort by key/direction
    filtered = [...filtered].sort((a, b) => {
      const aValue = a[sortKey as keyof ChatHistoryEntry];
      const bValue = b[sortKey as keyof ChatHistoryEntry];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
      }
      const aStr = String(aValue || '');
      const bStr = String(bValue || '');
      if (sortDir === 'asc') return aStr.localeCompare(bStr);
      else return bStr.localeCompare(aStr);
    });
    return filtered;
  }, [logs, search, fileFilter, sortKey, sortDir]);

  function handleHeaderSort(column: string) {
    if (sortKey === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(column);
      setSortDir('asc');
    }
  }

  // UI
  return (
    <div className="min-h-screen bg-[#41423E]">
      <div className="max-w-[96vw] mx-auto px-2 py-8">
        <div className="mb-6 flex flex-col items-center">
          <h1 className="text-3xl font-bold text-white text-center">Chat History</h1>
        </div>
        <h2 className="text-lg text-white mb-6">
          Results from Searching Repo: <span className="font-semibold">{repoUrl}</span>
        </h2>
        {error && <div className="text-red-500 mb-4">⚠️ {error}</div>}

        {/* FLEX WRAPPER: Sidebar + Table */}
        <div className="flex gap-10">
          {/* Sidebar flush left */}
          <aside className="w-60 bg-white rounded-xl shadow p-4 h-fit border border-gray-200">
            <Link
              to="/chat"
              state={repo ? { repo } : undefined}
              className="w-full inline-block mb-6 px-3 py-2 rounded bg-gray-200 text-black text-sm font-semibold text-center hover:bg-gray-400 transition"
            >
              ← Back to Chat
            </Link>
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Search Question or Answer</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring focus:border-blue-400"
                placeholder="Type to search..."
              />
            </div>
            <div className="mb-2">
              <label className="block text-gray-700 font-semibold mb-2">Filter by File Name</label>
              <input
                type="text"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1"
                placeholder="E.g. main.js"
              />
            </div>
            {(search || fileFilter) && (
              <button
                className="w-full mt-2 bg-gray-100 rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 transition"
                onClick={() => {
                  setSearch('');
                  setFileFilter('');
                }}
              >
                Clear Filters
              </button>
            )}
          </aside>

          {/* Table: take up rest of space, centered */}
          <div className="flex-1 min-w-0 overflow-x-auto bg-white shadow-lg rounded-xl border border-gray-200">
            <table className="min-w-full table-auto divide-y divide-gray-200 rounded-xl">
              <colgroup>
                <col style={{ minWidth: '220px', maxWidth: '300px', width: '24%' }} />
                <col style={{ minWidth: '340px', maxWidth: '540px', width: '38%' }} />
                <col style={{ minWidth: '200px', maxWidth: '400px', width: '26%' }} />
                <col style={{ minWidth: '60px', maxWidth: '90px', width: '6%' }} />
                <col style={{ minWidth: '60px', maxWidth: '90px', width: '6%' }} />
              </colgroup>
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide select-none cursor-pointer group"
                      onClick={() => handleHeaderSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <FaSortUp className="inline text-blue-500" />
                          ) : (
                            <FaSortDown className="inline text-blue-500" />
                          )
                        ) : (
                          <FaSort className="inline text-gray-300 group-hover:text-gray-400" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredLogs.map((log, idx) => (
                  <tr
                    key={idx}
                    className={
                      idx % 2 === 0
                        ? 'bg-white hover:bg-blue-50/70 transition'
                        : 'bg-gray-50 hover:bg-blue-50/70 transition'
                    }
                  >
                    <td className="px-4 py-3 text-sm text-gray-800 break-words whitespace-pre-line font-medium">
                      {log.userPrompt}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 break-words whitespace-pre-line">{log.answer}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 break-all">{log.file}</td>
                    <td className="px-4 py-3 text-sm text-blue-700 font-mono">{log.startLine}</td>
                    <td className="px-4 py-3 text-sm text-blue-700 font-mono">{log.endLine}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLogs.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-lg">No matching results.</div>
            )}
          </div>
        </div>
        {/* END FLEX */}
      </div>
    </div>
  );
};

export default ChatHistory;
