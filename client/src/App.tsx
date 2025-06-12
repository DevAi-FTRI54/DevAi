import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IngestionProvider from './components/ingestion/ingestioncontext'; // import here
import NavBarLayout from './wrappers/Layouts/NavBarLayout';
import MainContent from './wrappers/homepage/homepage';
import GitHubLogin from './components/auth/githublogin';
import InstallAppPrompt from './components/auth/installappprompt';
import FAQ from './wrappers/faqpage/faq';
import NotFound from './components/settings/notfound';
import { AppBarHomeLayout } from './wrappers/Layouts/AppBarLayout';
import IngestionFlow from './components/ingestion/IngestionFlow';
import ChatPage from './components/chat/ChatPage';
import ChatHistory from './components/chat/chathistory';
import AboutUs from './components/about/aboutus';
import OrgSelectorWrapper from './wrappers/orgselectorwrapper/orgselectorwrapper';
import AuthCallback from './components/auth/authcallback'; // adjust if needed
import UserSettings from './components/settings/settings';
import ComingSoon from './components/coming soon/featurescoming';

function App() {
  return (
    <IngestionProvider>
      <Router>
        {/* prettier-ignore */}
        <Routes>
          <Route path="/" element={<AppBarHomeLayout> <MainContent /> </AppBarHomeLayout> } />
          <Route path="/faq"  element={<AppBarHomeLayout> <FAQ /> </AppBarHomeLayout> } />
          <Route path="/about" element={ <AppBarHomeLayout> <AboutUs /> </AppBarHomeLayout> } />
          <Route path="/solutions" element={ <AppBarHomeLayout> <ComingSoon /> </AppBarHomeLayout> } />
          <Route path="/pricing" element={ <AppBarHomeLayout> <ComingSoon /> </AppBarHomeLayout> } />
          <Route path="/login" element={<GitHubLogin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/orgselector" element={<OrgSelectorWrapper /> } />
          <Route path="/install-github-app" element={<InstallAppPrompt />} />
          <Route path="/ingest" element={<IngestionFlow />} />
          <Route path="/select-repo" element={<IngestionFlow />} />
          <Route element={<NavBarLayout />}>
            <Route path='/chat' element={<ChatPage />} />
            <Route path='/chat/history' element={<ChatHistory repoUrl={''} />} />
            <Route path='/settings/account' element={<UserSettings />} />
          </Route>
          <Route path='*' element={<NotFound />} />
        </Routes>
      </Router>
    </IngestionProvider>
  );
}

export default App;
