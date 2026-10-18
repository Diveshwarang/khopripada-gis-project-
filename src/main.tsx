import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Purge any stale app shell caches from previous runs to ensure fresh code loads
if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key.includes('khopripada-app-v1') || key.includes('khopripada-app-v2')) {
        console.log('Purging legacy cache:', key);
        caches.delete(key);
      }
    });
  });
}

// Register or update Service Worker for offline tile caching and app resilience
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.update();
        console.log('Smart Village GIS Service Worker active:', reg.scope);
      })
      .catch((err) => {
        console.warn('Service Worker registration skipped:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
