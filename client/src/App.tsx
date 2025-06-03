import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBarLayout from './wrappers/Layouts/NavBarLayout';
import MainContent from './wrappers/homepage/homepage';
import GitHubLogin from './components/auth/githublogin';
import InstallAppPrompt from './components/auth/installappprompt';
import FAQ from './wrappers/faqpage/faq';
import NotFound from './components/settings/notfound';
import { AppBarHomeLayout } from './wrappers/Layouts/AppBarLayout';
import IngestionFlow from '../src/wrappers/RepoIngestion/IngestionFlow';
import ChatPage from './components/chat/ChatPage';
// import ChatWrap from './wrappers/chatbotpage/chatwrap';
import ChatHistory from './components/chat/chathistory';

function App() {
  return (
    <Router>
      {/* prettier-ignore */}
      <Routes>
        <Route path='/' element={<AppBarHomeLayout> <MainContent /> </AppBarHomeLayout>} />
        <Route path='/faq' element={<AppBarHomeLayout><FAQ /></AppBarHomeLayout>} />
        <Route path='/login' element={<GitHubLogin />} />
        <Route path='/install-github-app' element={<InstallAppPrompt />} />
        <Route path='/ingest' element={<IngestionFlow />} />{' '}
        {/* Use the wrapper flow */}
        {/* <Route path='/select-repo' element={<Navigate to='/ingest' />} />{' '} */}
        <Route path='/select-repo' element={<IngestionFlow />} />{' '}
        {/* For processing */}
        {/* For selecting repo */}
        {/* Optional redirect */}
        {/* Pages with NavBarLayout */}
        <Route element={<NavBarLayout />}>
          <Route path='/chat' element={<ChatPage />} />
          <Route path='/chat/history' element={<ChatHistory />} />
        </Route>
        {/* GLOBAL 404 CATCH-ALL */}
        <Route path='*' element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
