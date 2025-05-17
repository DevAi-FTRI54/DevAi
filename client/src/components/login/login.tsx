import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import styles from './login.module.css';

const Login: React.FC = () => {
  const [action, setAction] = useState('Login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  //* used to handle
  const navigate = useNavigate(); //*used to redirect after login
  const location = useLocation(); //*used for path/route checks

  //* Set initial action based on current route
  useEffect(() => {
    if (location.pathname === '/signup') {
      setAction('Sign Up');
    } else {
      setAction('Login');
    }
  }, [location.pathname]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); //* preventDefault stops reload of page, attemp to submit form any way besides fetch method.

    //*controls whether you go to the login or signup
    const url = action === 'Login' ? 'http://localhost:3000/login' : 'http://localhost:3000/signup';
    const body = { username, password };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'applicaiton/json' },
        body: JSON.stringify(body),
      });

      //* checks to see if response is successful
      if (!res.ok) {
        throw new Error(`${action} failed!`);
      }

      const data = await res.json();
      window.alert(`Welcome ${username}, You have been successfully logged in`);
      console.log(`${action} success!`, data);

      navigate('/client/src/components/repoingestion/repoinputform/repoinputform.tsx');
    } catch (err) {
      console.error(`Error in ${action}`, err);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.welcome}>{action} for Access</h1>
      <form onSubmit={handleSubmit}>
        <input
          className={styles.userName}
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className={styles.password}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className={styles.btns} type="submit">
          {action}
        </button>
      </form>
      );
    </div>
  );
};

export default Login;
