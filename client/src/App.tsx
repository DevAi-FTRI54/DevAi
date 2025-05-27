import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GitHubLogin from './components/auth/githublogin';
// import NavBar from './components/bars/navbar/navbar';
import FAQ from './wrappers/faqpage/faq';
import ChatWrap from './wrappers/chatbotpage/chatwrap';
import AuthCallback from './components/auth/authcallback';
import MainContent from './wrappers/homepage/homepage';
import InstallAppPrompt from './components/auth/installappprompt';
import RepoSelector from './components/auth/reposelector';
import AppBarHome from './components/bars/appBarHome/appbarhome';

// import AppBarHomeLayout from './layouts/AppBarHomeLayout'; // <-- new
// import NavBarLayout from './layouts/NavBarLayout'; // <-- new

function App() {
  return (
    <Router>
      <AppBarHome />
      <Routes>
        {/* Home/AppBarHome group */}
        <Route path="/" element={<MainContent />} />
        <Route path="/login" element={<GitHubLogin />} />
        <Route path="/githubapp" element={<AuthCallback />} />
        <Route path="/install-github-app" element={<InstallAppPrompt />} />
        <Route path="/select-repo" element={<RepoSelector />} />
        {/* <Route element={<NavBar />}> */}
        <Route path="/chat" element={<ChatWrap />} />
        <Route path="/faq" element={<FAQ />} />
      </Routes>
    </Router>
  );
}

export default App;
