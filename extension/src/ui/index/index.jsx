import React from 'react';
import ReactDom from 'react-dom/client';
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
