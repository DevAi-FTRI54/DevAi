import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ChatInput from '../../components/chat/chatinput/chatinput';
import ChatWindow from '../../components/chat/chatwindow/chatwindow';
// import ChatMessage from '../../components/chat/chatmessage/chatmessages';
import PersistentDrawerLeft from '../../components/navbar/sidebar/sidebarDrawer';
import TabComps from '../tabpanel/tabpanel';
// import styles from './chatwrap.module.css';

// const drawerWidth = 240; // keep this in sync with sidebarDrawer

type Message = { role: 'user' | 'assistant'; content: string; snippet: string };

const ChatWrap: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  const navigate = useNavigate();

  const handleSetAnswer = (answer: string, userPrompt: string, snippet: string) => {
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userPrompt, snippet: '' },
      { role: 'assistant', content: answer, snippet: snippet },
    ]);
  };

  const handleClick = () => {
    navigate('/chat');
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-slate-100 to-slate-200">
      <PersistentDrawerLeft />
      <main className="flex-1 flex flex-col items-center pt-24 px-4">
        {' '}
        {/* pt-12 = 3rem spacing from top (AppBar) */}
        {/* Top: Chat Button + Tabs */}
        <div className="flex flex-row items-center justify-center gap-4 mb-10">
          <button
            className="px-5 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition"
            onClick={handleClick}
          >
            Chat
          </button>
          <TabComps />
        </div>
        {/* Main chat area */}
        <div className="w-full max-w-2xl flex flex-col gap-8">
          <ChatWindow messages={messages} />
          <ChatInput setAnswer={handleSetAnswer} />
        </div>
      </main>
    </div>
  );
};

export default ChatWrap;
