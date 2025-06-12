import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import type { ChatHistoryEntry } from '../../types';
import type { ChatInputProps, Repo } from '../../types';
import { getChatHistory } from '../../api';

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

const ChatHistory: React.FC<Pick<ChatInputProps, 'repoUrl'>> = ({
  repoUrl,
}) => {
  const [logs, setLogs] = useState<ChatHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- Filter states ---
  const [search, setSearch] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  // ✅ Add date filter states
  const [dateFilter, setDateFilter] = useState<
    'all' | 'today' | 'week' | 'month' | 'custom'
  >('all');
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
        const start = customStartDate
          ? new Date(customStartDate)
          : new Date('1900-01-01');
        const end = customEndDate
          ? new Date(customEndDate)
          : new Date('2100-12-31');
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
        const data = await getChatHistory();
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
      filtered = filtered.filter((log) =>
        log.file?.toLowerCase().includes(fileFilter.toLowerCase())
      );
    }

    // ✅ Filter: date range
    if (dateFilter !== 'all') {
      filtered = filtered.filter(
        (log) => log.timestamp && isDateInRange(log.timestamp)
      );
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
  }, [
    logs,
    search,
    fileFilter,
    dateFilter,
    customStartDate,
    customEndDate,
    sortKey,
    sortDir,
    isDateInRange,
  ]);

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
    <div className='min-h-screen bg-[#171717] antialiased'>
      <div className='max-w-6xl mx-auto px-6 py-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center gap-3 mb-4'>
            <div className='w-8 h-8 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-lg flex items-center justify-center'>
              <svg
                className='w-5 h-5 text-white'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div>
              <h1 className='text-2xl font-bold text-[#fafafa]'>
                Chat History
              </h1>
              <p className='text-sm text-[#888]'>
                Browse your conversation history
              </p>
            </div>
          </div>

          {repoUrl && (
            <div className='bg-[#212121] border border-[#303030] rounded-lg p-3'>
              <p className='text-sm text-[#888]'>Repository:</p>
              <p className='text-[#fafafa] font-medium'>{repoUrl}</p>
            </div>
          )}
        </div>

        {error && (
          <div className='mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4'>
            <p className='text-red-400'>⚠️ {error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className='mb-6'>
          <div className='bg-[#212121] border border-[#303030] rounded-xl shadow-lg p-5'>
            <div className='flex items-center justify-between mb-4'>
              <Link
                to='/chat'
                state={repo ? { repo } : undefined}
                className='inline-flex items-center gap-2 px-4 py-2 bg-[#5ea9ea] hover:bg-[#4a9ae0] text-white rounded-lg font-medium transition-all duration-200'
              >
                <svg
                  className='w-4 h-4'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z'
                    clipRule='evenodd'
                  />
                </svg>
                Back to Chat
              </Link>
              <h2 className='text-lg font-semibold text-[#fafafa]'>
                Search & Filter
              </h2>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div>
                <label className='block text-[#fafafa] font-medium mb-2 text-sm'>
                  Search Questions & Answers
                </label>
                <input
                  type='text'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='w-full bg-[#303030] border border-[#404040] text-[#fafafa] placeholder-[#888] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5ea9ea] focus:ring-1 focus:ring-[#5ea9ea] transition-all duration-200'
                  placeholder='Type to search...'
                />
              </div>

              <div>
                <label className='block text-[#fafafa] font-medium mb-2 text-sm'>
                  Filter by File
                </label>
                <input
                  type='text'
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  className='w-full bg-[#303030] border border-[#404040] text-[#fafafa] placeholder-[#888] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5ea9ea] focus:ring-1 focus:ring-[#5ea9ea] transition-all duration-200'
                  placeholder='e.g. main.js'
                />
              </div>

              <div className='flex items-end gap-2'>
                {(search || fileFilter) && (
                  <button
                    className='flex-1 bg-[#303030] hover:bg-[#404040] text-[#fafafa] rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200'
                    onClick={() => {
                      setSearch('');
                      setFileFilter('');
                    }}
                  >
                    Clear Filters
                  </button>
                )}
                <div className='text-xs text-[#888] py-2'>
                  Found {filteredLogs.length} result
                  {filteredLogs.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div>
          {/* Table */}
          <div className='w-full'>
            <div className='bg-[#212121] border border-[#303030] rounded-xl shadow-lg overflow-hidden'>
              <div className='overflow-x-auto'>
                <table className='min-w-full'>
                  <colgroup>
                    <col
                      style={{
                        minWidth: '200px',
                        maxWidth: '280px',
                        width: '25%',
                      }}
                    />
                    <col
                      style={{
                        minWidth: '320px',
                        maxWidth: '450px',
                        width: '40%',
                      }}
                    />
                    <col
                      style={{
                        minWidth: '120px',
                        maxWidth: '180px',
                        width: '20%',
                      }}
                    />
                    <col
                      style={{
                        minWidth: '80px',
                        maxWidth: '100px',
                        width: '7.5%',
                      }}
                    />
                    <col
                      style={{
                        minWidth: '80px',
                        maxWidth: '100px',
                        width: '7.5%',
                      }}
                    />
                  </colgroup>
                  <thead className='bg-[#303030] border-b border-[#404040]'>
                    <tr>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className='px-4 py-3 text-left text-xs font-semibold text-[#fafafa] uppercase tracking-wider select-none cursor-pointer group hover:bg-[#404040] transition-all duration-200'
                          onClick={() => handleHeaderSort(col.key)}
                        >
                          <div className='flex items-center gap-2'>
                            {col.label}
                            {sortKey === col.key ? (
                              sortDir === 'asc' ? (
                                <FaSortUp className='text-[#5ea9ea]' />
                              ) : (
                                <FaSortDown className='text-[#5ea9ea]' />
                              )
                            ) : (
                              <FaSort className='text-[#888] group-hover:text-[#aaa]' />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-[#303030]'>
                    {filteredLogs.map((log, idx) => (
                      <tr
                        key={idx}
                        className='hover:bg-[#303030]/50 transition-all duration-200'
                      >
                        <td className='px-4 py-4 text-sm text-[#fafafa] break-words whitespace-pre-line font-medium'>
                          {log.userPrompt}
                        </td>
                        <td className='px-4 py-4 text-sm text-[#ccc] break-words whitespace-pre-line'>
                          {log.answer}
                        </td>
                        <td className='px-4 py-4 text-sm text-[#5ea9ea] break-all font-mono bg-[#303030]/30'>
                          {log.file}
                        </td>
                        <td className='px-4 py-4 text-sm text-[#fafafa] font-mono text-center bg-[#303030]/30 font-semibold'>
                          {log.startLine}
                        </td>
                        <td className='px-4 py-4 text-sm text-[#fafafa] font-mono text-center bg-[#303030]/30 font-semibold'>
                          {log.endLine}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredLogs.length === 0 && (
                <div className='p-12 text-center'>
                  <div className='w-16 h-16 bg-[#303030] rounded-full flex items-center justify-center mx-auto mb-4'>
                    <svg
                      className='w-8 h-8 text-[#888]'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path
                        fillRule='evenodd'
                        d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                  <p className='text-[#888] text-lg'>
                    No matching results found
                  </p>
                  <p className='text-[#666] text-sm mt-1'>
                    Try adjusting your search filters
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;
