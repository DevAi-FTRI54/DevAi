import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GitHubLogin from './components/auth/githublogin';
import NavBar from './components/navbar/navbar';
import './App.css';
import FAQ from './components/faq/faq';
import ChatWrap from './wrappers/chatbotpage/chatwrap';

function App() {
  return (
    <Router>
      {/* The components that rely on routing context */}
      <NavBar />
      {/* Define your routes */}
      <Routes>
        <Route path="/login" element={<GitHubLogin />} />
        <Route path="/chat" element={<ChatWrap />} />
        {/* <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/install" element={<InstallAppPrompt />} />
        <Route path="/select-repo" element={<RepoSelector />} /> */}

        <Route path="/faq" element={<FAQ />} />
      </Routes>
    </Router>
  );
}

export default App;
