import React from 'react';

const GitHubLogin: React.FC = () => {
  const handleLogin = () => {
    window.location.href = 'http://localhost:4000/api/auth/github';
  };

  return (
    <div className="loginContainer">
      <h1 className="login">Login to DevAi</h1>
      <button onClick={handleLogin}>🔐 Login with GitHub</button>
    </div>
  );
};

export default GitHubLogin;
