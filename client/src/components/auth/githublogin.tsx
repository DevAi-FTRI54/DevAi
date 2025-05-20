import React from 'react';

const GitHubLogin: React.FC = () => {
  const handleLogin = () => {
    window.location.href = 'GITHUBAUTHREQ';
  };

  return (
    <div className="loginContainer">
      <h1 className="login">Login to DevAi</h1>
      <button onClick={handleLogin}>🔐 Login with GitHub</button>
    </div>
  );
};

export default GitHubLogin;
