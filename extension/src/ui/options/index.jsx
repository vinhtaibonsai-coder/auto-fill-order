import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../application/config.js'
import '../../infrastructure/supabase/supabase-config.js'
import '../../infrastructure/supabase/client.js'
import '../../domain/auth/auth.events.js'
import '../../domain/auth/auth.session.js'
import '../../domain/auth/auth.service.js'
import App from './App'
import ErrorBoundary from '../components/ErrorBoundary'
import './options-styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
