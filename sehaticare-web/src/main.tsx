import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

import { registerServiceWorker } from './pwa/registerServiceWorker';

void registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
