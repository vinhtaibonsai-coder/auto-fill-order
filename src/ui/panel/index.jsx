import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from '../components/ErrorBoundary'
import './panel-styles.css'

// Inject into the carrier page
function injectReactPanel() {
  if (document.getElementById('af-react-root')) return;
  const rootDiv = document.createElement('div');
  rootDiv.id = 'af-react-root';
  document.body.appendChild(rootDiv);

  const root = createRoot(rootDiv);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

// Ensure it loads when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectReactPanel);
} else {
  injectReactPanel();
}
