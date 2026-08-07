const fs = require('fs');

let indexHtml = fs.readFileSync('admin-dashboard/index.html', 'utf8');

// The new Tailwind config and style for Glassmorphism Dark Mode
const newHeadCode = 
  <!-- Tailwind CSS CDN & Config -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              // Deep Midnight Background
              neutralBg: '#020617',    // Slate 950
              neutralCard: 'rgba(255, 255, 255, 0.03)',  // Glass card
              darkText: '#F8FAFC',     // Slate 50
              borderLight: 'rgba(255, 255, 255, 0.1)',  // Subtle glass border
              
              // Accent (Emerald Green - preserving brand identity)
              primaryBlue: '#10B981',  // Emerald 500
              primaryBlueLight: 'rgba(16, 185, 129, 0.15)',
              primaryBlueHover: '#059669', // Emerald 600
            }
          },
          backdropBlur: {
            xs: '2px',
          }
        }
      }
    }
  </script>
  <!-- Supabase JS Client CDN (UMD bundle) -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <!-- Chart.js CDN for Revenue and Order Count Charts -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <!-- Phosphor Icons CDN (Minimalist Iconography) -->
  <script src="https://unpkg.com/@phosphor-icons/web"></script>
  <!-- Supabase Config File -->
  <script src="supabase-config.js"></script>

  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
    
    body { 
      font-family: 'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #020617; /* Deep midnight */
      color: #F8FAFC;
      /* Subtle mesh gradient background effect */
      background-image: 
        radial-gradient(circle at 15% 50%, rgba(16, 185, 129, 0.06), transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(56, 189, 248, 0.04), transparent 25%);
    }

    .font-serif-title {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
    }

    .font-mono-code {
      font-family: 'Inter', ui-monospace, SFMono-Regular, monospace;
    }

    /* Minimalist status styling */
    .bg-pastel-blue { background-color: rgba(56, 189, 248, 0.1); color: #38BDF8; border: 1px solid rgba(56, 189, 248, 0.2); }
    .bg-pastel-green { background-color: rgba(16, 185, 129, 0.1); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.2); }
    .bg-pastel-rose { background-color: rgba(244, 63, 94, 0.1); color: #FB7185; border: 1px solid rgba(244, 63, 94, 0.2); }
    .bg-pastel-amber { background-color: rgba(245, 158, 11, 0.1); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.2); }

    /* Custom subtle scrollbar */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
    
    /* Glassmorphism Utilities */
    .glass-card {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    .glass-input {
      background: rgba(0, 0, 0, 0.2) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      color: #F8FAFC !important;
    }
    .glass-input:focus {
      border-color: #10B981 !important;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2) !important;
    }
  </style>
;

// Replace from <!-- Tailwind CSS CDN & Config --> to </style>
indexHtml = indexHtml.replace(/<!-- Tailwind CSS CDN & Config -->[\s\S]*?<\/style>/, newHeadCode);

fs.writeFileSync('admin-dashboard/index.html', indexHtml, 'utf8');
console.log('Applied Glassmorphism Base config to index.html');
