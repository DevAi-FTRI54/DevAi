import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppBarHomeLayout from './wrappers/Layouts/AppBarLayout';
import NavBarLayout from './wrappers/Layouts/NavBarLayout';
import MainContent from './wrappers/homepage/homepage';
import GitHubLogin from './components/auth/githublogin';
import InstallAppPrompt from './components/auth/installappprompt';
import RepoSelector from './components/auth/reposelector';
import ChatWrap from './wrappers/chatbotpage/chatwrap';
import FAQ from './wrappers/faqpage/faq';
import NotFound from './components/settings/notfound';

function App() {
  return (
    <Router>
      <Routes>
        {/* Homepage with AppBarHomeLayout */}
        {/* prettier-ignore */}
        <Route path="/" element={<AppBarHomeLayout><MainContent /></AppBarHomeLayout> }/>
        {/* prettier-ignore */}
        <Route path="/faq" element={<AppBarHomeLayout><FAQ /></AppBarHomeLayout> }/>
        <Route path="/login" element={<GitHubLogin />} />
        <Route path="/install-github-app" element={<InstallAppPrompt />} />
        <Route path="/select-repo" element={<RepoSelector />} />

        {/* Pages with NavBarLayout */}
        <Route element={<NavBarLayout />}>
          <Route path="/chat" element={<ChatWrap />} />
        </Route>

        {/* GLOBAL 404 CATCH-ALL */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
