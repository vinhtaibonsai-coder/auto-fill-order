const fs = require('fs');

let css = fs.readFileSync('frontend/options/options.css', 'utf8');

const newVars = 
:root {
  --side-w: 280px;
  --bg: #020617;
  --card: rgba(255, 255, 255, 0.03);
  --text-p: #F8FAFC;
  --text-s: #94A3B8;
  --border: rgba(255, 255, 255, 0.1);
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
  --shadow-md: 0 8px 16px rgba(0,0,0,0.2);
  
  --blue: #38BDF8;
  --blue-bg: rgba(56, 189, 248, 0.1);
  --purple: #C084FC;
  --purple-bg: rgba(192, 132, 252, 0.1);
  --mint: #34D399;
  --mint-bg: rgba(52, 211, 153, 0.1);
  --amber: #FBBF24;
  --amber-bg: rgba(245, 158, 11, 0.1);
  --red-soft: #FB7185;
  --red-bg: rgba(244, 63, 94, 0.1);
  
  --primary: #10B981;
  --primary-dark: #059669;
  --primary-light: rgba(16, 185, 129, 0.15);
  --primary-glow: rgba(16, 185, 129, 0.2);
  
  --radius: 16px;
  --radius-sm: 10px;
  --radius-xs: 6px;
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

body {
  font-family: 'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg);
  color: var(--text-p);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  background-image: 
        radial-gradient(circle at 15% 50%, rgba(16, 185, 129, 0.06), transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(56, 189, 248, 0.04), transparent 25%);
}

.card, .panel, .sidebar, .topbar, .modal-content {
  background: var(--card) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border: 1px solid var(--border) !important;
}

input, select, textarea {
  background: rgba(0, 0, 0, 0.2) !important;
  border: 1px solid var(--border) !important;
  color: var(--text-p) !important;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 2px var(--primary-glow) !important;
}
;

// Replace from :root{ down to body.dark-mode{ 
css = css.replace(/:root\{[\s\S]*?body\.dark-mode\{/, newVars + '\nbody.dark-mode{');

fs.writeFileSync('frontend/options/options.css', css, 'utf8');
console.log('Updated options.css with Glassmorphism');
