// SOURCE: ui/styling/style.css — chỉnh sửa CSS ở file .css, đồng bộ lại vào đây
(() => {
  // Inject Google Fonts vào document head (không dùng @import trong Shadow DOM vì CSP có thể block)
  (function injectGoogleFonts() {
    if (typeof document === 'undefined') return;
    const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700&family=Noto+Sans:wght@300;400;500;600;700&display=swap';
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    } catch (_) {
      // Silent fail — sẽ fallback sang system font
    }
  })();

  const PANEL_CSS = `
/* Font fallback tốt cho cả trường hợp Google Fonts bị block */

#vnpost-autofill-panel {
    /* --- DESIGN SYSTEM TOKENS --- */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 24px;
    --space-xl: 32px;
    
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
    --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
    --shadow-xl: 0 20px 25px rgba(0,0,0,0.15);
    
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
    
    /* True Glassmorphism Deep Midnight */
    --bg-panel: rgba(2, 6, 23, 0.65);
    --border-panel: rgba(255, 255, 255, 0.12);
    --text-primary: #f8fafc;
    --text-secondary: #a7f3d0;
    --text-muted: #64748b;
    
    --btn-parse-bg: linear-gradient(135deg, #34d399 0%, #059669 100%);
    --btn-parse-bg-hover: linear-gradient(135deg, #059669 0%, #047857 100%);
    --btn-parse-border: rgba(255, 255, 255, 0.2);
    --btn-parse-border-hover: rgba(255, 255, 255, 0.4);
    --btn-parse-text: #ffffff;
    
    --btn-clear-bg: rgba(52, 211, 153, 0.12);
    --btn-clear-border: rgba(52, 211, 153, 0.2);
    --btn-clear-text: #34d399;
    
    --card-bg: rgba(255, 255, 255, 0.05);
    --card-border: rgba(255, 255, 255, 0.08);
    --card-row-bg: rgba(30, 41, 59, 0.45);
    --card-row-border: rgba(52, 211, 153, 0.15);
    --card-row-hover-bg: rgba(30, 41, 59, 0.85);
    --card-row-hover-border: rgba(52, 211, 153, 0.35);
    
    --input-bg: rgba(0, 0, 0, 0.3);
    --input-border: rgba(255, 255, 255, 0.15);
    --input-text: #f8fafc;
    --input-focus-bg: rgba(15, 23, 42, 0.9);
    
    --cod-bg: linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(244, 63, 94, 0.2) 100%);
    --cod-border: rgba(244, 63, 94, 0.3);
    --cod-text: #fda4af;
    --cod-val: #ff124d;
    
    --ai-box-bg: rgba(52, 211, 153, 0.1);
    --ai-box-border: rgba(52, 211, 153, 0.25);
    --ai-box-text: #a7f3d0;
    --ai-box-title: #34d399;
    --ai-box-accent: #10b981;
    --ai-item-bg: rgba(30, 41, 59, 0.6);
    --ai-item-border: rgba(52, 211, 153, 0.2);
    --ai-item-hover-bg: rgba(30, 41, 59, 0.9);
    
    --progress-bg: rgba(52, 211, 153, 0.35);
    
    /* --- STRUCTURAL LAYOUT --- */
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: var(--bg-panel);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    width: 360px;
    font-family: 'Be Vietnam Pro', 'Noto Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border-radius: 18px;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    overflow: hidden;
    border: 1px solid var(--border-panel);
    transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1), height 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.35s cubic-bezier(0.16, 1, 0.3, 1), background var(--transition-normal), transform var(--transition-fast);
    color: var(--text-primary);
}

/* Minimized State: Elegant Circular Floating Button with Vector Icon */
#vnpost-autofill-panel.minimized {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    cursor: pointer;
    background: rgba(10, 11, 14, 0.95);
    /* Dùng border solid 2px có độ đục rõ để VNPost và J&T đều nổi bật */
    border: 2px solid var(--theme-color, #4f46e5);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), 0 0 12px var(--theme-color, rgba(79, 70, 229, 0.3)), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
}
#vnpost-autofill-panel.minimized #vnpost-panel-header,
#vnpost-autofill-panel.minimized #vnpost-panel-body {
    display: none !important;
}
.minimized-icon {
    display: none;
    color: var(--theme-color, #4f46e5);
}
#vnpost-autofill-panel.minimized .minimized-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    animation: pulseGlow 2.5s infinite;
}
#vnpost-autofill-panel.minimized .minimized-icon svg {
    width: 22px;
    height: 22px;
}
#vnpost-autofill-panel.minimized:hover {
    transform: scale(1.08);
    background: rgba(20, 22, 28, 0.98);
    border-color: var(--theme-color, #4f46e5);
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45), 0 0 18px var(--theme-color, rgba(79, 70, 229, 0.5));
}
#vnpost-autofill-panel.minimized:active {
    transform: scale(0.96);
}

@keyframes pulseGlow {
    0% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 6px var(--theme-color, #4f46e5)); }
    100% { transform: scale(1); opacity: 0.9; }
}

#vnpost-panel-header {
    padding: 14px var(--space-md);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--border-panel);
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
    user-select: none;
}
#vnpost-panel-header .badge-version {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-primary);
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    border: 1px solid rgba(255, 255, 255, 0.08);
}
#vnpost-panel-header .badge-shop {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.25);
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
#vnpost-panel-header .badge-user {
    background: rgba(99, 102, 241, 0.12);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.25);
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    max-width: 115px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
#vnpost-panel-header .badge-carrier {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.25);
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    max-width: 125px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
#vnpost-panel-header-text {
    font-family: 'Be Vietnam Pro', sans-serif;
    font-weight: 600;
    font-size: 13.5px;
    color: #ffffff;
    letter-spacing: -0.01em;
}
#vnpost-btn-minimize, #vnpost-btn-settings, #vnpost-btn-theme {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--text-secondary);
    cursor: pointer;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    outline: none;
}
#vnpost-btn-minimize:hover, #vnpost-btn-settings:hover, #vnpost-btn-theme:hover { 
    background: rgba(255, 255, 255, 0.12); 
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.1);
    transform: scale(1.05);
}
#vnpost-btn-minimize:active, #vnpost-btn-settings:active, #vnpost-btn-theme:active {
    transform: scale(0.92);
}

#vnpost-panel-body {
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    max-height: 80vh;
    overflow-y: auto;
}
/* Custom Scrollbar */
#vnpost-panel-body::-webkit-scrollbar {
    width: 5px;
}
#vnpost-panel-body::-webkit-scrollbar-track {
    background: transparent;
}
#vnpost-panel-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
}
#vnpost-panel-body::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}

#rawOrderText {
    width: 100%;
    box-sizing: border-box;
    padding: 12px 14px;
    border: 1px solid var(--input-border);
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.6;
    resize: vertical;
    outline: none;
    background: var(--input-bg);
    color: var(--input-text);
    transition: all var(--transition-normal);
}
#rawOrderText::placeholder {
    color: var(--text-muted);
}
#rawOrderText:focus {
    background-color: var(--input-focus-bg);
    border-color: var(--theme-color, #4f46e5);
    box-shadow: 0 0 0 3px var(--theme-color, rgba(79, 70, 229, 0.2));
}

#btnParseOrder {
    width: 100%;
    padding: 11px var(--space-md);
    background: var(--btn-parse-bg);
    color: var(--btn-parse-text);
    border: 1px solid var(--btn-parse-border);
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: all var(--transition-fast);
}
#btnParseOrder:hover { 
    background: var(--btn-parse-bg-hover);
    border-color: var(--btn-parse-border-hover);
    box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
}
#btnParseOrder:active {
    transform: translateY(0) scale(0.97);
}
#btnClearOrder {
    flex: 1;
    background: var(--btn-clear-bg);
    color: var(--btn-clear-text);
    border: 1px solid var(--btn-clear-border);
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    transition: all var(--transition-fast);
}
#btnClearOrder:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
    color: #f87171;
    transform: translateY(-1px);
}
#btnClearOrder:active {
    transform: translateY(0) scale(0.97);
}

/* Bento Style Review Panel */
#review-panel {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 14px;
    padding: var(--space-md);
    display: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}
.review-title {
    font-family: 'Be Vietnam Pro', sans-serif;
    font-weight: 600;
    font-size: 10px;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
}
.review-grid { 
    display: grid; 
    grid-template-columns: repeat(2, 1fr); 
    gap: var(--space-sm); 
    font-size: 13px; 
}
.review-row { 
    display: flex; 
    flex-direction: column;
    gap: var(--space-xs);
    background: var(--card-row-bg);
    border: 1px solid var(--card-row-border);
    padding: 8px 12px;
    border-radius: 10px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.01);
    transition: all var(--transition-fast) ease;
}
.review-row:hover {
    background: var(--card-row-hover-bg);
    border-color: var(--card-row-hover-border);
}
.review-row.address-row { 
    grid-column: span 2; 
}
.review-label { 
    font-size: 10px;
    color: var(--text-secondary); 
    font-weight: 600; 
    text-transform: uppercase;
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    gap: 4px;
}
.review-label svg {
    color: var(--text-muted);
}
.review-value-bold { 
    font-weight: 600; 
    color: var(--text-primary); 
}
.fee-status { text-transform: uppercase; font-weight: 600; }
.fee-status--yes { color: #34d399; font-size: 13px; }
.fee-status--no { color: var(--text-secondary); font-size: 12px; font-weight: 500; }
#rev-address { color: var(--text-primary); line-height: 1.5; }
.copy-btn {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    padding: 3px 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    flex-shrink: 0;
    transition: all var(--transition-fast) ease;
}
.copy-btn:hover {
    background: rgba(255,255,255,0.1);
    color: #ffffff;
    border-color: rgba(255,255,255,0.3);
    transform: scale(1.05);
}
.copy-btn:active {
    transform: scale(0.92);
}

.cod-box {
    grid-column: span 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--cod-bg);
    border: 1px solid var(--cod-border);
    padding: 10px 14px;
    border-radius: 10px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}
.cod-title { color: var(--cod-text); font-weight: 500; }
#rev-cod { font-weight: 700; color: var(--cod-val); font-size: 15px; }

/* Suggestion widget */
#ai-geo-box {
    margin-top: 12px;
    padding: 12px;
    border-radius: 12px;
    font-size: 12.5px;
    color: var(--ai-box-text);
    background: var(--ai-box-bg);
    border: 1px solid var(--ai-box-border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    display: none;
    position: relative;
    overflow: hidden;
}
#ai-geo-box::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: var(--ai-box-accent);
}
.ai-geo-title { 
    font-family: 'Be Vietnam Pro', sans-serif;
    font-weight: 600; 
    color: var(--ai-box-title); 
    margin-bottom: 8px; 
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.geo-suggest-item {
    padding: 8px 12px;
    background: var(--ai-item-bg);
    border: 1px solid var(--ai-item-border);
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 6px;
    font-size: 12px;
    transition: all var(--transition-fast) ease;
    color: var(--text-primary);
    line-height: 1.4;
}
.geo-suggest-item:hover {
    border-color: var(--theme-color, #3b82f6);
    background: var(--ai-item-hover-bg);
    color: var(--text-primary);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);
}
.geo-suggest-item:active {
    transform: translateY(0) scale(0.98);
}
.ai-geo-footer { font-size: 9px; opacity: 0.5; display: block; margin-top: 4px; text-align: right; font-style: italic; color: var(--text-muted); }

/* Fill Action Buttons */
.btn-fill {
    width: 100%;
    padding: 11px var(--space-md);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13.5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: all var(--transition-fast) cubic-bezier(0.16, 1, 0.3, 1);
}
.btn-fill:hover { 
    transform: translateY(-1px); 
    box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.btn-fill:active {
    transform: translateY(0) scale(0.97);
}
.btn-fill:disabled, #btnParseOrder:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

.review-editable {
    cursor: text;
    outline: none;
    border-radius: 6px;
    padding: 2px 6px;
    margin: -2px -6px;
    border: 1px dashed transparent;
    transition: all var(--transition-fast) ease;
    display: inline-block;
}
.review-editable:hover { 
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
}
.review-editable:focus { 
    background: rgba(255, 255, 255, 0.1); 
    border-color: var(--theme-color, #4f46e5);
    border-style: solid;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}
.edit-hint { font-size: 9px; color: var(--text-muted); margin-left: 4px; text-transform: none; font-weight: normal; }

/* Custom Shimmer AI progress line */
#gemini-progress-container {
    display: none;
    padding: 4px 0 0 0;
    border-radius: 12px;
}
.ai-progress-header {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    margin-bottom: 8px;
}
#ai-status { font-weight: 400; color: var(--text-secondary); }
#ai-percent { font-weight: 600; color: var(--theme-color, #4f46e5); }
.progress-bar-bg {
    width: 100%;
    background-color: var(--progress-bg);
    height: 3px;
    border-radius: 8px;
    overflow: hidden;
}
#gemini-progress-bar {
    width: 0%;
    height: 100%;
    background-color: var(--theme-color, #4f46e5);
    transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
}
#gemini-progress-bar::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    background-image: linear-gradient(
        -45deg, 
        rgba(255, 255, 255, .2) 25%, 
        transparent 25%, 
        transparent 50%, 
        rgba(255, 255, 255, .2) 50%, 
        rgba(255, 255, 255, .2) 75%, 
        transparent 75%, 
        transparent
    );
    background-size: 50px 50px;
    animation: moveShimmer 2s linear infinite;
}

@keyframes moveShimmer {
    0% { background-position: 0 0; }
    100% { background-position: 50px 50px; }
}

/* Toast styling */
#vnpost-toast-container {
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    pointer-events: none;
}
.vnpost-toast {
    font-family: 'Be Vietnam Pro', 'Noto Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: rgba(10, 11, 14, 0.9);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: #fff;
    padding: 10px 20px;
    border-radius: 12px;
    font-size: 13.5px;
    font-weight: 500;
    min-width: 260px;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    opacity: 0;
    border-left: 4px solid var(--theme-color, #4f46e5);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.vnpost-toast.show {
    opacity: 1;
    animation: vnpostSlideDownPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
.vnpost-toast--success {
    border-left-color: #10b981;
}
.vnpost-toast--success.show {
    box-shadow: 0 20px 45px rgba(16, 185, 129, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.vnpost-toast--error {
    border-left-color: #ef4444;
}
.vnpost-toast--error.show {
    animation: vnpostShakeError 0.65s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
    box-shadow: 0 20px 45px rgba(239, 68, 68, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

@keyframes vnpostSlideDownPop {
  0% { opacity: 0; transform: translateY(-24px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes vnpostShakeError {
  0% { opacity: 0; transform: translateY(-24px) scale(0.95); }
  35% { opacity: 1; transform: translateY(0) scale(1.02); }
  50% { transform: translateX(-6px) scale(1); }
  65% { transform: translateX(6px); }
  80% { transform: translateX(-3px); }
  90% { transform: translateX(3px); }
  100% { transform: translateX(0); }
}

/* Spinner Rotate Animation for SVG loading */
.spinner-loading {
    animation: spinRotate 1.2s linear infinite;
    transform-origin: center;
}
@keyframes spinRotate {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Skeleton Screen Loading Animation */
.skeleton {
    display: inline-block;
    height: 14px;
    border-radius: 4px;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.08) 25%, rgba(255, 255, 255, 0.22) 37%, rgba(255, 255, 255, 0.08) 63%);
    background-size: 400% 100%;
    animation: skeletonShimmer 1.4s ease-in-out infinite;
    vertical-align: middle;
    pointer-events: none;
    user-select: none;
    color: transparent !important;
}
#vnpost-autofill-panel.light-mode .skeleton {
    background: linear-gradient(90deg, rgba(0, 0, 0, 0.06) 25%, rgba(0, 0, 0, 0.16) 37%, rgba(0, 0, 0, 0.06) 63%);
    background-size: 400% 100%;
}
@keyframes skeletonShimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}

/* =========================================================================
   LIGHT MODE STYLES
   ========================================================================= */
#vnpost-autofill-panel.light-mode {
    /* --- LIGHT GREEN THEME TOKENS OVERRIDE --- */
    --bg-panel: rgba(240, 253, 250, 0.88);
    --border-panel: rgba(167, 243, 208, 0.45);
    --text-primary: #1e293b;
    --text-secondary: #0f766e;
    --text-muted: #64748b;
    
    --btn-parse-bg: linear-gradient(135deg, #a7f3d0 0%, #34d399 100%);
    --btn-parse-bg-hover: linear-gradient(135deg, #34d399 0%, #059669 100%);
    --btn-parse-border: rgba(255, 255, 255, 0.5);
    --btn-parse-border-hover: rgba(255, 255, 255, 0.7);
    --btn-parse-text: #064e3b;
    
    --btn-clear-bg: rgba(52, 211, 153, 0.1);
    --btn-clear-border: rgba(52, 211, 153, 0.2);
    --btn-clear-text: #047857;
    
    --card-bg: rgba(255, 255, 255, 0.75);
    --card-border: rgba(167, 243, 208, 0.35);
    --card-row-bg: rgba(255, 255, 255, 0.5);
    --card-row-border: rgba(167, 243, 208, 0.2);
    --card-row-hover-bg: rgba(255, 255, 255, 0.9);
    --card-row-hover-border: rgba(52, 211, 153, 0.4);
    
    --input-bg: rgba(255, 255, 255, 0.8);
    --input-border: rgba(167, 243, 208, 0.45);
    --input-text: #0f291b;
    --input-focus-bg: rgba(255, 255, 255, 0.95);
    
    --cod-bg: linear-gradient(135deg, rgba(225, 29, 72, 0.04) 0%, rgba(225, 29, 72, 0.07) 100%);
    --cod-border: rgba(225, 29, 72, 0.15);
    --cod-text: #be123c;
    --cod-val: #e11d48;
    
    --ai-box-bg: rgba(52, 211, 153, 0.08);
    --ai-box-border: rgba(52, 211, 153, 0.2);
    --ai-box-text: #047857;
    --ai-box-title: #065f46;
    --ai-box-accent: #10b981;
    --ai-item-bg: rgba(255, 255, 255, 0.6);
    --ai-item-border: rgba(52, 211, 153, 0.15);
    --ai-item-hover-bg: rgba(255, 255, 255, 0.95);
    
    --progress-bg: rgba(167, 243, 208, 0.4);
    
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.6);
}

#vnpost-autofill-panel.light-mode #vnpost-panel-header {
    background: rgba(0, 0, 0, 0.01);
}
#vnpost-autofill-panel.light-mode #vnpost-panel-header-text {
    color: #111827;
}
#vnpost-autofill-panel.light-mode #vnpost-btn-minimize,
#vnpost-autofill-panel.light-mode #vnpost-btn-settings,
#vnpost-autofill-panel.light-mode #vnpost-btn-theme {
    background: rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.04);
    color: #4b5563;
}
#vnpost-autofill-panel.light-mode #vnpost-btn-minimize:hover,
#vnpost-autofill-panel.light-mode #vnpost-btn-settings:hover,
#vnpost-autofill-panel.light-mode #vnpost-btn-theme:hover {
    background: rgba(0, 0, 0, 0.08);
    color: #111827;
    border-color: rgba(0, 0, 0, 0.06);
}
#vnpost-autofill-panel.light-mode #rawOrderText:focus {
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}
#vnpost-autofill-panel.light-mode .review-editable:focus {
    background: #ffffff;
    color: #000000;
}
#vnpost-autofill-panel.light-mode.minimized {
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.15), 0 0 12px var(--theme-color, rgba(79, 70, 229, 0.25)), inset 0 0 0 1px rgba(255, 255, 255, 0.8);
}
#vnpost-autofill-panel.light-mode .copy-btn {
    border-color: rgba(0,0,0,0.15);
    color: #64748b;
}
#vnpost-autofill-panel.light-mode .copy-btn:hover {
    background: rgba(0,0,0,0.05);
    color: #1e293b;
    border-color: rgba(0,0,0,0.25);
}
#vnpost-autofill-panel.light-mode ~ #vnpost-toast-container .vnpost-toast {
    background: rgba(255, 255, 255, 0.95);
    color: #1f2937;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

/* Confirm modal inside Shadow DOM */
#vnpost-confirm-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: vnpostFadeIn 0.2s ease-out;
}
#vnpost-confirm-modal {
    background: #181922;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 16px;
    width: 100%;
    max-width: 290px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    animation: vnpostModalPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15);
}
#vnpost-autofill-panel.light-mode #vnpost-confirm-modal {
    background: #ffffff;
    border-color: rgba(0, 0, 0, 0.08);
    box-shadow: 0 20px 50px rgba(0,0,0,0.15);
    color: #1f2937;
}
#vnpost-confirm-title {
    font-size: 13.5px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 6px;
}
#vnpost-autofill-panel.light-mode #vnpost-confirm-title {
    color: #111827;
}
#vnpost-confirm-msg {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.5;
    margin-bottom: 16px;
}
#vnpost-autofill-panel.light-mode #vnpost-confirm-msg {
    color: #4b5563;
}
#vnpost-confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}
#vnpost-confirm-actions button {
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.15s;
}
#vnpost-confirm-btn-cancel {
    background: #2d3548;
    color: #94a3b8;
}
#vnpost-confirm-btn-cancel:hover {
    background: #3b4459;
    color: #f1f5f9;
}
#vnpost-confirm-btn-ok {
    background: #4f46e5;
    color: #fff;
}
#vnpost-confirm-btn-ok:hover {
    background: #6366f1;
}

#vnpost-autofill-panel.light-mode #vnpost-confirm-btn-cancel {
    background: #e4e4e7;
    color: #4b5563;
}
#vnpost-autofill-panel.light-mode #vnpost-confirm-btn-cancel:hover {
    background: #d4d4d8;
    color: #18181b;
}

/* --- PANEL INLINE LOGIN FORM STYLES --- */
.panel-login-box {
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: left;
}
.panel-login-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.panel-login-subtitle {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 4px;
    line-height: 1.45;
}
.panel-login-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.panel-login-label {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-secondary);
}
.panel-login-input {
    width: 100%;
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s, background-color 0.2s;
}
.panel-login-input:focus {
    border-color: var(--theme-color, #6366f1);
    background: var(--input-focus-bg);
}
#vnpost-autofill-panel.light-mode .panel-login-title {
    color: #0f172a;
}
#vnpost-autofill-panel.light-mode .panel-login-subtitle {
    color: #475569;
}
#vnpost-autofill-panel.light-mode .panel-login-label {
    color: #0f766e;
}
#vnpost-autofill-panel.light-mode .panel-login-input {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #0f172a;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
#vnpost-autofill-panel.light-mode .panel-login-input:focus {
    border-color: var(--theme-color, #0056b3);
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(0, 86, 179, 0.15);
}
.panel-login-error {
    display: none;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    font-size: 12px;
    line-height: 1.4;
}
#vnpost-autofill-panel.light-mode .panel-login-error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
}
.panel-login-btn {
    width: 100%;
    padding: 10px 14px;
    border-radius: 9px;
    border: none;
    background: var(--theme-color, #6366f1);
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: opacity 0.2s, transform 0.1s;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
.panel-login-btn:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
}
.panel-login-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
.panel-login-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 2px;
    font-size: 11.5px;
}
.panel-login-link {
    color: var(--theme-color, #6366f1);
    text-decoration: none;
    cursor: pointer;
    font-weight: 600;
}
.panel-login-link:hover {
    text-decoration: underline;
}

@keyframes vnpostFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes vnpostModalPop {
    from { transform: scale(0.9) translateY(10px); opacity: 0; }
    to { transform: scale(1) translateY(0); opacity: 1; }
}

`;

  globalThis.PANEL_CSS = PANEL_CSS;
})();


