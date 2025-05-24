import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GitHubLogin from './components/auth/githublogin';
import NavBar from './components/navbar/appbar/navbar';
import './App.css';
import FAQ from './components/faq/faq';
import ChatWrap from './wrappers/chatbotpage/chatwrap';
import AuthCallback from './components/auth/authcallback';
import MainContent from './components/homepage/homepage';
// import { HomePage } from './components/homepage/homepage';
import InstallAppPrompt from './components/onboarding/installappprompt';
import RepoSelector from './components/onboarding/reposelector';

function App() {
  return (
    <Router>
      {/* The components that rely on routing context */}
      <NavBar />
      {/* Define your routes */}
      <Routes>
        <Route path="/" element={<MainContent />} />
        {/* <Route path="/" element={<HomePage />} /> */}
        <Route path="/login" element={<GitHubLogin />} />
        <Route path="/githubapp" element={<AuthCallback />} />
        <Route path="/install-github-app" element={<InstallAppPrompt />} />
        <Route path="select-repo" element={<RepoSelector />} />
        <Route path="/chat" element={<ChatWrap />} />
        <Route path="/faq" element={<FAQ />} />
      </Routes>
    </Router>
  );
}

export default App;
