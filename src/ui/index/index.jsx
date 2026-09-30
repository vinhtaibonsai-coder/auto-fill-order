import React from 'react';
import ReactDom from 'react-dom/client';
import '../../application/config.js';
import '../../infrastructure/supabase/supabase-config.js';
import '../../infrastructure/supabase/client.js';
import '../../domain/auth/auth.events.js';
import '../../domain/auth/auth.session.js';
import '../../domain/auth/auth.service.js';
import App from './App.jsx';
import './index-styles.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDom.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
