import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppBarHomeLayout from './wrappers/Layouts/AppBarLayout';
import NavBarLayout from './wrappers/Layouts/NavBarLayout';
import MainContent from './wrappers/homepage/homepage';
import GitHubLogin from './components/auth/githublogin';
import InstallAppPrompt from './components/auth/installappprompt';
import RepoSelector from './components/auth/reposelector';
import ChatWrap from './wrappers/chatbotpage/chatwrap';
import FAQ from './wrappers/faqpage/faq';

function App() {
  return (
    <Router>
      <Routes>
        {/* All routes with AppBarHome */}
        <Route element={<AppBarHomeLayout />}>
          <Route path="/" element={<MainContent />} />
          <Route path="/login" element={<GitHubLogin />} />
          <Route path="/install-github-app" element={<InstallAppPrompt />} />
          <Route path="/select-repo" element={<RepoSelector />} />
        </Route>

        {/* All routes with NavBar */}
        <Route element={<NavBarLayout />}>
          <Route path="/chat" element={<ChatWrap />} />
          <Route path="/faq" element={<FAQ />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
