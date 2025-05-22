import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ChatInput from '../../components/chat/chatinput/chatinput';
import ChatWindow from '../../components/chat/chatwindow/chatwindow';
import ChatMessage from '../../components/chat/chatmessage/chatmessages';
import PersistentDrawerLeft from '../../components/navbar/sidebar/sidebarDrawer';
import TabComps from '../tabpanel/tabpanel';
import styles from './chatwrap.module.css';

const drawerWidth = 240; // keep this in sync with sidebarDrawer

type Message = { role: 'user' | 'assistant'; content: string };

const ChatWrap: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  const navigate = useNavigate();

  const handleSetAnswer = (answer: string, userPrompt: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: userPrompt }, { role: 'assistant', content: answer }]);
  };

  const handleClick = () => {
    navigate('/chat');
  };

  return (
    <div style={{ display: 'flex' }}>
      <PersistentDrawerLeft />
      {/* Main content area */}
      <div style={{ flex: 1, marginLeft: drawerWidth, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <button
            className={styles.btn}
            onClick={handleClick}
            style={{ marginRight: 16 }} // gives some space between preview and button
          >
            Chat
          </button>
          <TabComps />
        </div>
        {/* Either render messages inside ChatWindow OR here, not both! */}
        <ChatWindow messages={messages} />

        {/* If ChatWindow already renders messages, you don't need this */}

        <div>
          {messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} />
          ))}
        </div>

        <ChatInput setAnswer={handleSetAnswer} />
      </div>
    </div>
  );
};

export default ChatWrap;
