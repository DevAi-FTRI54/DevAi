import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
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
  { key: 'timestamp', label: 'Date' }, // ✅ Add timestamp column
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

const ChatHistory: React.FC<Pick<ChatInputProps, 'repoUrl'>> = ({ repoUrl }) => {
  const [logs, setLogs] = useState<ChatHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- Filter states ---
  const [search, setSearch] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  // ✅ Add date filter states
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // --- Sorting states ---
  const [sortKey, setSortKey] = useState<ColumnKey>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ✅ Helper function to check if date falls within filter range
  const isDateInRange = (timestamp: Date | string) => {
    const date = new Date(timestamp);

    switch (dateFilter) {
      case 'today': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
      }

      case 'week': {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date >= weekAgo;
      }

      case 'month': {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return date >= monthAgo;
      }

      case 'custom': {
        if (!customStartDate && !customEndDate) return true;
        const start = customStartDate ? new Date(customStartDate) : new Date('1900-01-01');
        const end = customEndDate ? new Date(customEndDate) : new Date('2100-12-31');
        end.setHours(23, 59, 59, 999); // Include entire end date
        return date >= start && date <= end;
      }

      default: // 'all'
        return true;
    }
  };

  const formatTimestamp = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else {
      return format(date, 'MMM d, yyyy h:mm a');
    }
  };

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
        const res = await fetch('/api/chat/history/flat', {
          // ✅ Use relative URL
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

  // --- Updated Filter & Sort logic ---
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

    // ✅ Filter: date range
    if (dateFilter !== 'all') {
      filtered = filtered.filter((log) => log.timestamp && isDateInRange(log.timestamp));
    }

    // Sort by key/direction
    filtered = [...filtered].sort((a, b) => {
      const aValue = a[sortKey as keyof ChatHistoryEntry];
      const bValue = b[sortKey as keyof ChatHistoryEntry];

      if (sortKey === 'timestamp') {
        const aTime = new Date(aValue as string | Date).getTime();
        const bTime = new Date(bValue as string | Date).getTime();
        return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
      }
      const aStr = String(aValue || '');
      const bStr = String(bValue || '');
      if (sortDir === 'asc') return aStr.localeCompare(bStr);
      else return bStr.localeCompare(aStr);
    });
    return filtered;
  }, [logs, search, fileFilter, dateFilter, customStartDate, customEndDate, sortKey, sortDir, isDateInRange]);

  function handleHeaderSort(column: ColumnKey) {
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
        {error && <div className="text-red-500 mb-4">⚠️ {error}</div>}

        {/* FLEX WRAPPER: Sidebar + Table */}
        <div className="flex gap-10">
          {/* ✅ Updated Sidebar with Date Filter */}
          <aside className="w-64 bg-white rounded-xl shadow p-4 h-fit border border-gray-200">
            <Link
              to="/chat"
              state={repo ? { repo } : undefined}
              className="w-full inline-block mb-6 px-3 py-2 rounded bg-gray-200 text-black text-sm font-semibold text-center hover:bg-gray-400 transition"
            >
              ← Back to Chat
            </Link>

            {/* Search Filter */}
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

            {/* File Filter */}
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Filter by File Name</label>
              <input
                type="text"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1"
                placeholder="E.g. main.js"
              />
            </div>

            {/* ✅ Date Filter */}
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Filter by Date</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
                className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring focus:border-blue-400"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* ✅ Custom Date Range (shown when 'custom' is selected) */}
            {dateFilter === 'custom' && (
              <div className="mb-4 space-y-2">
                <div>
                  <label className="block text-gray-600 text-sm mb-1">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm mb-1">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Clear Filters Button */}
            {(search || fileFilter || dateFilter !== 'all') && (
              <button
                className="w-full mt-2 bg-gray-100 rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 transition"
                onClick={() => {
                  setSearch('');
                  setFileFilter('');
                  setDateFilter('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
              >
                Clear All Filters
              </button>
            )}

            {/* ✅ Show active filters count */}
            <div className="mt-3 text-xs text-gray-500">
              Showing {filteredLogs.length} of {logs.length} results
            </div>
          </aside>

          {/* Table: take up rest of space, centered */}
          <div className="flex-1 min-w-0 overflow-x-auto bg-white shadow-lg rounded-xl border border-gray-200">
            <table className="min-w-full table-auto divide-y divide-gray-200 rounded-xl">
              <colgroup>
                <col style={{ minWidth: '200px', maxWidth: '280px', width: '20%' }} />
                <col style={{ minWidth: '300px', maxWidth: '450px', width: '32%' }} />
                <col style={{ minWidth: '180px', maxWidth: '300px', width: '22%' }} />
                <col style={{ minWidth: '60px', maxWidth: '90px', width: '6%' }} />
                <col style={{ minWidth: '60px', maxWidth: '90px', width: '6%' }} />
                <col style={{ minWidth: '120px', maxWidth: '160px', width: '14%' }} /> {/* ✅ Add timestamp column */}
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
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {/* ✅ Add timestamp display */}
                      {log.timestamp ? formatTimestamp(log.timestamp) : 'N/A'}
                    </td>
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
