import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

console.log('⚡ main.tsx loading at:', new Date().toISOString());
console.log('🌐 Current URL:', window.location.href);

// Track browser navigation timing
window.addEventListener('load', () => {
  console.log('🏁 Window fully loaded at:', new Date().toISOString());
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM content loaded at:', new Date().toISOString());
});

createRoot(document.getElementById('root')!).render(
  // Temporarily disable StrictMode to test performance
  // <StrictMode>
  <App />
  // </StrictMode>
);

console.log('✅ React app rendered at:', new Date().toISOString());
