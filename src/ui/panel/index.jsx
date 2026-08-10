import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from '../components/ErrorBoundary'
import './panel-styles.css'

let root = null;
let rootDiv = null;

function checkUrlAndInject() {
  const url = window.location.href;
  let isCreatePage = false;
  
  if (url.includes('vnpost.vn')) {
    isCreatePage = url.includes('create') || url.includes('tao-don');
  } else if (url.includes('jtexpress.vn')) {
    isCreatePage = url.includes('create') || url.includes('Create') || url.includes('add') || url.includes('new');
  }
  
  if (isCreatePage) {
    if (!document.getElementById('af-react-root')) {
      rootDiv = document.createElement('div');
      rootDiv.id = 'af-react-root';
      document.body.appendChild(rootDiv);
      
      root = createRoot(rootDiv);
      root.render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );
    }
  } else {
    // Nếu chuyển hướng rời xa trang tạo đơn, tháo gỡ panel khỏi DOM
    const existing = document.getElementById('af-react-root');
    if (existing) {
      if (root) {
        root.unmount();
        root = null;
      }
      existing.remove();
      rootDiv = null;
    }
  }
}

// Lắng nghe các sự kiện chuyển trang của Single Page Application (SPA)
window.addEventListener('popstate', checkUrlAndInject);
window.addEventListener('hashchange', checkUrlAndInject);

// Thăm dò định kỳ URL để bắt sự kiện thay đổi route SPA trên các framework (Angular/React/Vue) của hãng
setInterval(checkUrlAndInject, 500);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkUrlAndInject);
} else {
  checkUrlAndInject();
}
