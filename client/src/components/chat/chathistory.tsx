import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ChatHistoryEntry } from '../../types';
import type { ChatInputProps, Repo } from '../../types';

const REPO_KEY = 'devai_repo';

const ChatHistory: React.FC<Pick<ChatInputProps, 'repoUrl'>> = ({ repoUrl }) => {
  const [logs, setLogs] = useState<ChatHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Try to find the full repo object by repoUrl from localStorage
  const repo: Repo | null = useMemo(() => {
    try {
      const str = localStorage.getItem(REPO_KEY);
      if (!str) return null;
      const obj = JSON.parse(str);
      // extra safety: verify html_url matches
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
      } catch (err: any) {
        console.error('❌ Error fetching history:', err);
        if (!didCancel) {
          setError(err.message || 'Failed to load chat history');
          setLogs([]);
        }
      }
    };
    fetchHistory();
    return () => {
      didCancel = true;
    };
  }, []);

  return (
    <div className="min-h-screen overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-gray-800">Chat History</h1>
          {repo ? (
            <Link to="/chat" state={{ repo }} className="text-blue-600 hover:underline text-sm font-medium">
              ← Back to Chat
            </Link>
          ) : (
            <Link to="/chat" className="text-blue-600 hover:underline text-sm font-medium">
              ← Back to Chat
            </Link>
          )}
        </div>
        <h2 className="text-lg text-gray-600 mb-6">
          Results from Searching Repo: <span className="font-semibold">{repoUrl}</span>
        </h2>
        {error && <div className="text-red-500 mb-4">⚠️ {error}</div>}
        <div className="overflow-x-auto max-h-[650px] overflow-y-auto bg-white shadow rounded-lg">
          <table className="min-w-full table-auto divide-y divide-gray-200">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Question
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Answer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Line
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End Line
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition duration-150">
                  <td className="px-6 py-4 text-sm text-gray-700">{log.userPrompt}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{log.answer}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{log.file}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{log.startLine}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{log.endLine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;
