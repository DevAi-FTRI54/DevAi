import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import './App.css';
import LoginProfile from './components/usermanagement/profile/profile';
import Login from './components/login/login';
import FAQ from './components/faq/faq';

function App() {
  return (
    <Router>
      {/* The components that rely on routing context */}
      <LoginProfile />

      {/* Define your routes */}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        <Route path="/faq" element={<FAQ />} />
      </Routes>
    </Router>
  );
}

export default App;
