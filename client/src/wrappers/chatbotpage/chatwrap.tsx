import { useState } from 'react';
import ChatInput from '../../components/chat/chatinput/chatinput';
import ChatWindow from '../../components/chat/chatwindow/chatwindow';
import ChatMessage from '../../components/chat/chatmessage/chatmessages';
import PersistentDrawerLeft from '../../components/navbar/sidebar/sidebarDrawer';

const drawerWidth = 240; // keep this in sync with sidebarDrawer

type Message = { role: 'user' | 'assistant'; content: string };

const ChatWrap: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSetAnswer = (answer: string, userPrompt: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: userPrompt }, { role: 'assistant', content: answer }]);
  };

  return (
    <div style={{ display: 'flex' }}>
      <PersistentDrawerLeft />
      {/* Main content area */}
      <div style={{ flex: 1, marginLeft: drawerWidth, padding: 24 }}>
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
