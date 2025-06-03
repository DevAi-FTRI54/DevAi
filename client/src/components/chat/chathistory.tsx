import React, { useEffect, useState } from 'react';
import type { ChatHistoryEntry } from '../../types';

const ChatHistory: React.FC = () => {
  const [logs, setLogs] = useState<ChatHistoryEntry[]>([]);

  //! find out where our api/path will be for fetch request
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // const url = 'http://localhost:4000/api/chat/history?userId=USER_ID&limit=10&offset=0'; //static values for limit and offsey
        // const res = await fetch(url); //static values for limit and offset
        const res = await fetch('http://localhost:4000/api/chat/history'); //? where are we storing the data, //added the url
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error('❌ Error fetching history:', err);
      }
    };
    fetchHistory();
  }, []);
  return (
    <div className="tableWrapper">
      <h1>Chat History</h1>
      <h2>Results from Searching Repo</h2>
      repoName
      <table>
        <thead>
          <tr>
            <th>User Question</th>
            <th>Answer</th>
            <th>File Name</th>
            <tr>Start Line</tr>
            <tr>End line</tr>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, idx) => (
            <tr key={idx}>
              <td>{log.userPrompt}</td>
              <td>{log.answer}</td>
              <td>{log.file}</td>
              <td>{log.startLine}</td>
              <td>{log.endLine}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ChatHistory;
