import { useState } from 'react';
import ChatInput from '../../components/chat/chatinput/chatinput';
import ChatWindow from '../../components/chat/chatwindow/chatwindow';

// Define your message type
type Message = { role: 'user' | 'assistant'; content: string };

const ChatWrap: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  // This is called when ChatInput gets a new answer from the backend
  const handleSetAnswer = (answer: string, userPrompt: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: userPrompt }, { role: 'assistant', content: answer }]);
  };

  return (
    <div>
      <ChatWindow messages={messages} />
      <ChatInput setAnswer={handleSetAnswer} />
    </div>
  );
};

export default ChatWrap;
