import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

const GitHubLogin: React.FC = () => {
  const handleLogin = () => {
    window.location.href = 'http://localhost:4000/api/auth/github';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#181C20',
      }}
    >
      <h1
        style={{
          fontSize: '1.5rem',
          color: '#fff',
          marginBottom: '1.5rem',
          fontFamily: "'TT Hoves Pro Trial', Arial, sans-serif",
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: '0.01em',
          textAlign: 'center',
        }}
      >
        Get started with DevAi
      </h1>
      <button
        onClick={handleLogin}
        style={{
          padding: '0.75rem 2rem',
          fontSize: '1.0rem',
          background: '#22272E',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = '#2f3541')}
        onMouseOut={(e) => (e.currentTarget.style.background = '#22272E')}
      >
        <FontAwesomeIcon icon={faGithub} />
        Login with GitHub
      </button>
    </div>
  );
};

export default GitHubLogin;
