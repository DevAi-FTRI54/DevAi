// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import PermanentSidebar from '../../components/navbar/sidebar/sidebarDrawer';
// import ChatWindow from '../../components/chat/chatwindow/chatwindow';
// import ChatInput from '../../components/chat/chatinput/chatinput';
// // import TabComps from '../tabpanel/tabpanel'; // Uncomment if using tabs

// type Message = {
//   role: 'user' | 'assistant';
//   content: string;
//   snippet: string;
// };

// const ChatWrap: React.FC = () => {
//   const [messages, setMessages] = useState<Message[]>([]);
//   const navigate = useNavigate();

//   const owner = 'Team-Taz-FTRI-54';
//   const repo = 'AI-ML-Project';

//   const handleSetAnswer = (answer: string, userPrompt: string, snippet: string) => {
//     setMessages((prev) => [
//       ...prev,
//       { role: 'user', content: userPrompt, snippet: '' },
//       { role: 'assistant', content: answer, snippet: snippet },
//     ]);
//   };

//   const handleFileSelect = (filePath: string) => {
//     navigate(`/fileviewer?path=${encodeURIComponent(filePath)}`);
//   };

//   return (
//     <div style={{ display: 'flex' }}>
//       <PermanentSidebar owner={owner} repo={repo} onFileSelect={handleFileSelect} />
//       <main className="flex-1 flex flex-col items-center pt-24 px-4">
//         {/* Optional: Top Chat Controls */}
//         {/* <div className="flex flex-row items-center justify-center gap-4 mb-10">
//           <button
//             className="px-5 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition"
//           >
//             Chat
//           </button>
//           <TabComps />
//         </div> */}

//         {/* Chat content */}
//         <div className="w-full max-w-2xl flex flex-col gap-1">
//           <ChatWindow messages={messages} />
//           <ChatInput setAnswer={handleSetAnswer} />
//         </div>
//       </main>
//     </div>
//   );
// };

// export default ChatWrap;

// import { useState } from 'react';
// // import { useNavigate } from 'react-router-dom';

// import ChatInput from '../../components/chat/chatinput/chatinput';
// import ChatWindow from '../../components/chat/chatwindow/chatwindow';
// // import ChatMessage from '../../components/chat/chatmessage/chatmessages';
// import PersistentDrawerLeft from '../../components/navbar/sidebar/sidebarDrawer';
// // import TabComps from '../tabpanel/tabpanel';
// // import styles from './chatwrap.module.css';

// // const drawerWidth = 240; // keep this in sync with sidebarDrawer

// type Message = { role: 'user' | 'assistant'; content: string; snippet: string };

// const ChatWrap: React.FC = () => {
//   const [messages, setMessages] = useState<Message[]>([]);

//   // const navigate = useNavigate();

//   const handleSetAnswer = (answer: string, userPrompt: string, snippet: string) => {
//     setMessages((prev) => [
//       ...prev,
//       { role: 'user', content: userPrompt, snippet: '' },
//       { role: 'assistant', content: answer, snippet: snippet },
//     ]);
//   };

//   // // const handleClick = () => {
//   //   navigate('/chat');
//   // };

//   return (
//     <div className="flex min-h-screen bg-gradient-to-b from-slate-500 to-blue-950">
//       <PersistentDrawerLeft />
//       <main className="flex-1 flex flex-col items-center pt-24 px-4">
//         {' '}
//         {/* pt-12 = 3rem spacing from top (AppBar) */}
//         {/* Top: Chat Button + Tabs */}
//         {/* <div className="flex flex-row items-center justify-center gap-4 mb-10">
//           <button
//             className="px-5 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition"
//             onClick={handleClick}
//           >
//             Chat
//           </button>
//           <TabComps />
//         </div> */}
//         {/* Main chat area */}
//         <div className="w-full max-w-2xl flex flex-col gap-1">
//           <ChatWindow messages={messages} />
//           <ChatInput setAnswer={handleSetAnswer} />
//         </div>
//       </main>
//     </div>
//   );
// };

// export default ChatWrap;

import React, { useState } from 'react';
import PermanentSidebar from '../../components/navbar/sidebar/sidebarDrawer';
import ChatWindow from '../../components/chat/chatwindow/chatwindow';
import ChatInput from '../../components/chat/chatinput/chatinput';
import RepoViewer from '../../components/viewer/filepreview/filepreview';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  snippet: string;
};

const ChatWrap: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const owner = 'Team-Taz-FTRI-54';
  const repo = 'AI-ML-Project';

  const handleSetAnswer = (answer: string, userPrompt: string, snippet: string) => {
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userPrompt, snippet: '' },
      { role: 'assistant', content: answer, snippet: snippet },
    ]);
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFilePath(filePath);
    // Optional: navigate(`/fileviewer?path=${encodeURIComponent(filePath)}`);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen pt-[64px] overflow-hidden ">
      {/* Sidebar - always visible on desktop, top on mobile */}
      <div className="w-full md:w-1/5 border-r border-gray-200">
        <PermanentSidebar owner={owner} repo={repo} onFileSelect={handleFileSelect} />
      </div>

      {/* Chat Area */}
      <div className="w-full md:w-2/5 flex flex-col items-center px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">DevAi Onboarding Assistant</h1>
          <p className="text-sm text-gray-500">Ask anything about this codebase during your onboarding</p>
        </div>

        <div className="w-full max-w-2xl flex-1 flex flex-col gap-2">
          <ChatWindow messages={messages} />

          <ChatInput setAnswer={handleSetAnswer} />
        </div>
      </div>

      {/* File Viewer */}
      <div className="w-full md:w-2/5 border-l border-gray-200 p-4 overflow-y-auto">
        {selectedFilePath ? (
          <RepoViewer repoUrl={`${owner}/${repo}`} selectedPath={selectedFilePath} />
        ) : (
          <div className="text-gray-500 italic">Select a file to view its contents</div>
        )}
      </div>
    </div>
  );
};

export default ChatWrap;
