import React from 'react';
import { useLocation } from 'react-router-dom';
import ChatWrap from '../../wrappers/chatbotpage/chatwrap';

const ChatPage: React.FC = () => {
  const location = useLocation();
  const repo = location.state?.repo;
  console.log('--- (ChatPage) repo ---------');
  console.log(repo);

  if (!repo) {
    return (
      <div className='min-h-screen bg-[#23262f] flex items-center justify-center'>
        <div className='text-white text-xl'>No repository selected</div>
      </div>
    );
  }

  return <ChatWrap repo={repo} />;
};

export default ChatPage;
