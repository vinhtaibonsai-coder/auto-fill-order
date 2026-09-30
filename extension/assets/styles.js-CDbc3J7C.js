(function(){(()=>{(function(){if(typeof document>"u")return;const o="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700&family=Noto+Sans:wght@300;400;500;600;700&display=swap";if(!document.querySelector(`link[href="${o}"]`))try{const e=document.createElement("link");e.rel="stylesheet",e.href=o,e.crossOrigin="anonymous",document.head.appendChild(e)}catch{}})();const r=`
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
    --bg-panel: rgba(15, 23, 42, 0.94);
    --border-panel: rgba(255, 255, 255, 0.1);
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    
    --btn-parse-bg: linear-gradient(135deg, #10b981 0%, #059669 100%);
    --btn-parse-bg-hover: linear-gradient(135deg, #059669 0%, #047857 100%);
    --btn-parse-border: rgba(255, 255, 255, 0.15);
    --btn-parse-border-hover: rgba(255, 255, 255, 0.3);
    --btn-parse-text: #ffffff;
    
    --btn-clear-bg: rgba(255, 255, 255, 0.05);
    --btn-clear-border: rgba(255, 255, 255, 0.08);
    --btn-clear-text: #94a3b8;
    
    --card-bg: rgba(30, 41, 59, 0.5);
    --card-border: rgba(255, 255, 255, 0.08);
    --card-row-bg: rgba(15, 23, 42, 0.6);
    --card-row-border: rgba(255, 255, 255, 0.08);
    --card-row-hover-bg: rgba(30, 41, 59, 0.85);
    --card-row-hover-border: rgba(16, 185, 129, 0.35);
    
    --input-bg: rgba(15, 23, 42, 0.75);
    --input-border: rgba(255, 255, 255, 0.12);
    --input-text: #f8fafc;
    --input-focus-bg: rgba(15, 23, 42, 0.95);
    
    --cod-bg: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.18) 100%);
    --cod-border: rgba(16, 185, 129, 0.28);
    --cod-text: #34d399;
    --cod-val: #10b981;
    
    --ai-box-bg: rgba(30, 41, 59, 0.6);
    --ai-box-border: rgba(56, 189, 248, 0.25);
    --ai-box-text: #e0f2fe;
    --ai-box-title: #38bdf8;
    --ai-box-accent: #38bdf8;
    --ai-item-bg: rgba(15, 23, 42, 0.7);
    --ai-item-border: rgba(56, 189, 248, 0.2);
    --ai-item-hover-bg: rgba(30, 41, 59, 0.95);
    
    --progress-bg: rgba(16, 185, 129, 0.25);
    
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
    border-radius: 16px;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    overflow: hidden;
    border: 1px solid var(--border-panel);
    transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1), height 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.35s cubic-bezier(0.16, 1, 0.3, 1), background var(--transition-normal), transform var(--transition-fast);
    color: var(--text-primary);
}

#vnpost-autofill-panel.panel-docked {
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    left: auto !important;
    width: 340px !important;
    max-width: 92vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
    border-top: 0 !important;
    border-right: 0 !important;
    border-bottom: 0 !important;
    border-left: 1px solid var(--border-panel) !important;
    box-shadow: -10px 0 36px rgba(0, 0, 0, 0.28), inset 1px 0 0 rgba(255, 255, 255, 0.08) !important;
    transform: translateX(0);
    transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1), background var(--transition-normal), box-shadow var(--transition-normal);
    display: flex !important;
    flex-direction: column !important;
    z-index: 2147483647 !important;
}

#vnpost-autofill-panel.panel-docked #vnpost-panel-header {
    cursor: default;
    flex-shrink: 0;
}

#vnpost-autofill-panel.panel-docked #vnpost-panel-body {
    flex: 1;
    max-height: none;
    overflow-y: auto;
    padding-bottom: 24px;
}

#vnpost-autofill-panel.panel-docked.collapsed {
    transform: translateX(100%) !important;
    box-shadow: none !important;
}

#vnpost-autofill-panel.panel-floating {
    position: fixed !important;
    width: 360px !important;
    height: auto !important;
    max-height: 90vh !important;
    border-radius: 18px !important;
    border: 1px solid var(--border-panel) !important;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.12) !important;
    transform: none !important;
    z-index: 2147483647 !important;
}

#vnpost-dock-toggle-tab {
    position: fixed !important;
    top: 50% !important;
    right: 0 !important;
    transform: translateY(-50%) !important;
    display: none;
    align-items: center;
    justify-content: center;
    min-height: 118px;
    padding: 12px 7px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-right: 0;
    border-radius: 12px 0 0 12px;
    background: var(--theme-color, #0056b3);
    color: #ffffff;
    box-shadow: -6px 0 22px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    font-family: 'Be Vietnam Pro', 'Noto Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0;
    line-height: 1;
    text-orientation: mixed;
    transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), filter 150ms ease;
    user-select: none;
    writing-mode: vertical-rl;
    z-index: 2147483646 !important;
}

#vnpost-dock-toggle-tab.is-visible {
    display: flex !important;
}

#vnpost-dock-toggle-tab:hover {
    filter: brightness(1.08);
    transform: translateY(-50%) scale(1.04) !important;
}

/* Minimized State */
#vnpost-autofill-panel.minimized {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    cursor: pointer;
    background: rgba(15, 23, 42, 0.96);
    border: 2px solid var(--theme-color, #10b981);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), 0 0 12px var(--theme-color, rgba(16, 185, 129, 0.3)), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
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
    color: var(--theme-color, #10b981);
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
    border-color: var(--theme-color, #10b981);
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45), 0 0 18px var(--theme-color, rgba(16, 185, 129, 0.5));
}
#vnpost-autofill-panel.minimized:active {
    transform: scale(0.96);
}

@keyframes pulseGlow {
    0% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 6px var(--theme-color, #10b981)); }
    100% { transform: scale(1); opacity: 0.9; }
}

/* =========================================================================
   HEADER & CONTEXT BAR
   ========================================================================= */
#vnpost-panel-header {
    padding: 11px 14px 10px;
    background: rgba(15, 23, 42, 0.96);
    border-top: 3px solid var(--theme-color, #10b981);
    border-bottom: 1px solid var(--border-panel);
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: move;
    user-select: none;
}

.vnpost-header-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.panel-context-strip {
    display: grid;
    gap: 3px;
    width: 100%;
    padding: 7px 9px;
    border-top: 1px solid var(--border-panel);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    position: relative;
}
.panel-context-shop,
.panel-account-trigger {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--text-primary);
    font-size: 10px;
    font-weight: 700;
}
.panel-account-trigger {
    width: 100%;
    padding: 2px 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
}
.panel-account-trigger:hover { color: #10b981; }
.context-separator { color: var(--text-muted); }
.panel-account-menu {
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    right: 0;
    z-index: 80;
    display: grid;
    gap: 4px;
    padding: 10px;
    border: 1px solid var(--border-panel);
    border-radius: 10px;
    background: var(--bg-panel);
    box-shadow: var(--shadow-md);
    font-size: 11px;
}
.panel-account-menu[hidden] { display: none !important; }
.panel-account-menu span { color: var(--text-secondary); }
.panel-account-menu hr { width: 100%; margin: 4px 0; border: 0; border-top: 1px solid var(--border-panel); }
.panel-account-menu button { padding: 6px; border: 0; border-radius: 6px; background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; }
.panel-account-menu button:hover { background: rgba(16, 185, 129, 0.12); }
.panel-context-row {
    display: grid;
    grid-template-columns: 74px minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    min-width: 0;
    padding: 1px 0;
    font-size: 9.5px;
    line-height: 1.35;
}
.panel-context-label {
    color: var(--text-muted);
    font-weight: 600;
    white-space: nowrap;
}
.panel-context-value {
    min-width: 0;
    color: var(--text-primary);
    font-weight: 700;
    overflow-wrap: anywhere;
}
.panel-context-value.context-missing { color: #f59e0b; font-weight: 600; }
#vnpost-autofill-panel.light-mode .panel-context-value.context-missing { color: #b45309; }

.vnpost-brand-group {
    display: flex;
    align-items: center;
    gap: 7px;
}

.brand-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);
    display: inline-block;
    animation: livePulse 2s infinite ease-in-out;
}
@keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.85); }
}

.brand-title {
    font-family: 'Be Vietnam Pro', sans-serif;
    font-weight: 700;
    font-size: 16px;
    color: var(--text-primary);
    letter-spacing: -0.01em;
}

#vnpost-panel-header-text {
    font-family: 'Be Vietnam Pro', sans-serif;
    font-weight: 700;
    font-size: 16px;
    color: var(--text-primary);
    letter-spacing: -0.01em;
}

.badge-version {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-muted);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid var(--border-panel);
}

.vnpost-header-controls {
    display: flex;
    align-items: center;
    gap: 5px;
}

.status-strip-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    overflow: hidden;
    padding-top: 1px;
}
.status-strip-bar::-webkit-scrollbar {
    display: none;
}

.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
    flex: 1 1 0;
    min-width: 0;
    box-sizing: border-box;
    transition: all 0.15s;
}

.pill-shop {
    background: rgba(16, 185, 129, 0.14);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.28);
}

.pill-carrier {
    background: rgba(56, 189, 248, 0.14);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.28);
}

.pill-user {
    background: rgba(99, 102, 241, 0.14);
    color: #a5b4fc;
    border: 1px solid rgba(99, 102, 241, 0.28);
}

#vnpost-autofill-panel.light-mode .pill-shop {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
}

#vnpost-autofill-panel.light-mode .pill-carrier {
    background: #f0f9ff;
    color: #0369a1;
    border: 1px solid #bae6fd;
}

#vnpost-autofill-panel.light-mode .pill-user {
    background: #eef2ff;
    color: #4338ca;
    border: 1px solid #c7d2fe;
}

/* Header Buttons */
#vnpost-btn-minimize, #vnpost-btn-settings, #vnpost-btn-theme, #vnpost-btn-dock-toggle {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-secondary);
    cursor: pointer;
    width: 27px;
    height: 27px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    outline: none;
}
#vnpost-btn-minimize:hover, #vnpost-btn-settings:hover, #vnpost-btn-theme:hover, #vnpost-btn-dock-toggle:hover { 
    background: rgba(255, 255, 255, 0.12); 
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
}
#vnpost-btn-minimize:active, #vnpost-btn-settings:active, #vnpost-btn-theme:active, #vnpost-btn-dock-toggle:active {
    transform: scale(0.92);
}

/* =========================================================================
   PANEL BODY & INPUT CARD
   ========================================================================= */
#vnpost-panel-body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 80vh;
    overflow-y: auto;
}
#vnpost-panel-body::-webkit-scrollbar {
    width: 4px;
}
#vnpost-panel-body::-webkit-scrollbar-track {
    background: transparent;
}
#vnpost-panel-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
}

.input-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: var(--shadow-sm);
}

.input-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.source-card-header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
}
.source-edit-btn {
    border: 0;
    border-radius: 5px;
    padding: 2px 5px;
    background: rgba(56, 189, 248, 0.1);
    color: #38bdf8;
    font-size: 9.5px;
    font-weight: 700;
    cursor: pointer;
}
.source-edit-btn:hover, .source-edit-btn:focus-visible {
    background: rgba(56, 189, 248, 0.2);
    outline: 1px solid #38bdf8;
}
.source-dirty-badge {
    align-items: center;
    color: #f59e0b;
    font-size: 9px;
    font-weight: 700;
}
.source-dirty-message {
    margin: 6px 0;
    padding: 6px 8px;
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 6px;
    background: rgba(245, 158, 11, 0.08);
    color: #fbbf24;
    font-size: 9.5px;
    line-height: 1.35;
}
.source-collapsed-preview {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
    padding: 9px 10px 7px;
    border: 1px solid var(--border-panel);
    border-radius: 8px;
    background: var(--input-bg);
    color: inherit;
    text-align: left;
    cursor: pointer;
}
.source-collapsed-preview:hover, .source-collapsed-preview:focus-visible {
    border-color: rgba(56, 189, 248, 0.45);
    background: rgba(56, 189, 248, 0.06);
    outline: none;
}
.source-preview-primary {
    color: var(--text-primary);
    font-size: 10px;
    font-weight: 800;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
}
.source-preview-address {
    display: block;
    overflow: visible;
    color: var(--text-primary);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
}
.source-preview-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 2px;
    padding-top: 6px;
    border-top: 1px solid var(--border-panel);
    color: #38bdf8;
    font-size: 9.5px;
    font-weight: 750;
    letter-spacing: 0.01em;
}
.source-collapsed-preview:hover .source-preview-hint,
.source-collapsed-preview:focus-visible .source-preview-hint {
    color: #0ea5e9;
}
#vnpost-autofill-panel.light-mode .source-preview-hint {
    color: #0369a1;
}
.input-card.is-collapsed {
    gap: 5px;
    padding: 9px 10px;
}
.input-card.source-dirty {
    border-color: rgba(245, 158, 11, 0.45);
}
#vnpost-autofill-panel.light-mode .source-edit-btn { color: #0369a1; background: #e0f2fe; }
#vnpost-autofill-panel.light-mode .source-dirty-message { color: #92400e; background: #fffbeb; border-color: #fde68a; }

.input-card-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.input-kbd-shortcut {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-panel);
    padding: 1px 6px;
    border-radius: 4px;
}

#rawOrderText {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border: 1px solid var(--input-border);
    border-radius: 9px;
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    outline: none;
    background: var(--input-bg);
    color: var(--input-text);
    transition: all var(--transition-normal);
}
#rawOrderText::placeholder {
    color: var(--text-muted);
    opacity: 0.75;
}
#rawOrderText:focus {
    background-color: var(--input-focus-bg);
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

#rawOrderText.is-dragover {
    border-color: #3b82f6 !important;
    background-color: rgba(59, 130, 246, 0.08) !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25) !important;
}

.panel-image-paste-preview {
    margin-bottom: 8px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

#vnpost-autofill-panel.light-mode .panel-image-paste-preview {
    background: #f8fafc;
    border-color: #e2e8f0;
}

.image-preview-thumb-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
}

#panel-pasted-img {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: #000;
}

#vnpost-autofill-panel.light-mode #panel-pasted-img {
    border-color: #cbd5e1;
}

.image-preview-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow: hidden;
}

.image-preview-badge {
    font-size: 11px;
    font-weight: 700;
    color: #10b981;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.image-preview-info {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.btn-remove-pasted-img {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
    width: 26px;
    height: 26px;
    border-radius: 50%;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.btn-remove-pasted-img:hover {
    background: #ef4444;
    color: #fff;
}

.panel-image-ocr-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 600;
    color: #3b82f6;
    padding-top: 4px;
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

#vnpost-autofill-panel.light-mode .panel-image-ocr-status {
    border-top-color: #e2e8f0;
}

.input-card-actions {
    display: flex;
    gap: 8px;
    margin-top: 2px;
}

.btn-parse-primary, #btnParseOrder {
    flex: 1;
    padding: 10px 14px;
    background: var(--btn-parse-bg);
    color: var(--btn-parse-text);
    border: 1px solid var(--btn-parse-border);
    border-radius: 9px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow: var(--shadow-md);
    transition: all var(--transition-fast);
}
.btn-parse-primary:hover, #btnParseOrder:hover { 
    background: var(--btn-parse-bg-hover);
    border-color: var(--btn-parse-border-hover);
    box-shadow: var(--shadow-lg);
    transform: translateY(-1px);
}
.btn-parse-primary:active, #btnParseOrder:active {
    transform: translateY(0) scale(0.98);
}

.btn-ai-verify, #btnAiVerify {
    padding: 10px 12px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 9px;
    cursor: pointer;
    font-weight: 700;
    font-size: 12.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    box-shadow: var(--shadow-md);
    transition: all var(--transition-fast);
    white-space: nowrap;
}
.btn-ai-verify:hover, #btnAiVerify:hover {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    box-shadow: var(--shadow-lg);
    transform: translateY(-1px);
}
.btn-ai-verify:active, #btnAiVerify:active {
    transform: translateY(0) scale(0.98);
}
.btn-ai-verify:disabled, #btnAiVerify:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

.btn-clear-secondary, #btnClearOrder {
    min-width: 68px;
    padding: 10px 12px;
    background: var(--btn-clear-bg);
    color: var(--btn-clear-text);
    border: 1px solid var(--btn-clear-border);
    border-radius: 9px;
    cursor: pointer;
    font-weight: 600;
    font-size: 12.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all var(--transition-fast);
}
.btn-clear-secondary:hover, #btnClearOrder:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
    transform: translateY(-1px);
}
.btn-clear-secondary:active, #btnClearOrder:active {
    transform: translateY(0) scale(0.98);
}

/* =========================================================================
   REVIEW BENTO PANEL
   ========================================================================= */
/* =========================================================================
   REVIEW BENTO PANEL (V2 DECISION-FIRST)
   ========================================================================= */
#review-panel {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 12px;
    padding: 11px;
    margin: 0;
    display: none;
    flex-direction: column;
    gap: 0;
}

.panel-empty-state {
    min-height: 92px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 14px;
    border: 1px dashed var(--border-panel);
    border-radius: 10px;
    color: var(--text-muted);
    text-align: center;
    font-size: 11px;
}
.panel-empty-state[hidden], .panel-validation-error[hidden] { display: none !important; }
.panel-empty-state strong { color: var(--text-secondary); font-size: 12px; }
.panel-validation-error {
    display: grid;
    gap: 8px;
    padding: 12px;
    border: 1px solid rgba(245, 158, 11, 0.4);
    border-radius: 10px;
    background: rgba(245, 158, 11, 0.1);
    color: var(--text-primary);
    font-size: 11px;
}
#panel-validation-checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; }
#panel-validation-checklist span { font-weight: 600; }
#panel-validation-checklist .is-valid { color: #10b981; }
#panel-validation-checklist .is-missing { color: #ef4444; }
#panel-validation-message { margin: 0; color: var(--text-secondary); }
#panel-fix-information { padding: 7px 10px; border: 1px solid rgba(245, 158, 11, 0.45); border-radius: 7px; background: transparent; color: #f59e0b; font-weight: 700; cursor: pointer; }
.review-editable.is-invalid { border-color: #ef4444 !important; }
.panel-duplicate-alert {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid #fde68a;
    border-radius: 10px;
    background: #fffbeb;
    color: #0f172a;
    font-size: 11.5px;
    box-shadow: 0 1px 3px rgba(180, 83, 9, 0.05);
}
.duplicate-alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.duplicate-alert-title {
    color: #92400e;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    letter-spacing: 0.2px;
}
.duplicate-alert-header-right {
    display: flex;
    align-items: center;
    gap: 6px;
}
.duplicate-alert-close {
    background: transparent;
    border: none;
    color: #92400e;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
}
.duplicate-alert-close:hover {
    background: rgba(180, 83, 9, 0.15);
    color: #451a03;
}
.duplicate-alert-time {
    font-size: 11px;
    color: #b45309;
    background: #fef3c7;
    padding: 2px 8px;
    border-radius: 999px;
    font-weight: 600;
}
.duplicate-alert-message {
    color: #78350f;
    line-height: 1.5;
    font-size: 11.5px;
}
.duplicate-alert-message strong {
    color: #451a03;
    font-weight: 800;
}
.duplicate-alert-details {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    margin-top: 2px;
    padding: 8px 12px;
    background: #ffffff;
    border: 1px solid #fde68a;
    border-radius: 8px;
    font-size: 11px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.duplicate-detail-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #64748b;
}
.duplicate-detail-tag strong {
    color: #0f172a;
    font-weight: 700;
}
.duplicate-detail-code {
    font-family: 'JetBrains Mono', monospace;
    color: #1d4ed8;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 700;
}

.review-header-v2 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 1px 9px;
    border-bottom: 1px solid var(--border-panel);
}

.review-section-title {
    font-family: 'Be Vietnam Pro', sans-serif;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
}

.review-edit-badge {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
}

.ai-confidence-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    font-weight: 600;
    padding: 1.5px 8px;
    border-radius: 12px;
    transition: all 0.25s ease;
    white-space: nowrap;
}

.ai-confidence-badge.verifying {
    background: rgba(14, 165, 233, 0.12);
    color: #0284c7;
    border: 1px solid rgba(14, 165, 233, 0.3);
    animation: af-pulse-glow 1.5s infinite ease-in-out;
}

.ai-confidence-badge.high {
    background: rgba(16, 185, 129, 0.12);
    color: #059669;
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.ai-confidence-badge.optimized {
    background: rgba(99, 102, 241, 0.12);
    color: #4f46e5;
    border: 1px solid rgba(99, 102, 241, 0.3);
}

.ai-confidence-badge.medium {
    background: rgba(245, 158, 11, 0.12);
    color: #d97706;
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.ai-confidence-badge.offline {
    background: rgba(100, 116, 139, 0.1);
    color: #64748b;
    border: 1px solid rgba(100, 116, 139, 0.25);
}

@keyframes af-pulse-glow {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; filter: brightness(1.1); }
}

.bento-grid-v2 { 
    display: grid; 
    grid-template-columns: repeat(2, 1fr); 
    gap: 0; 
    font-size: 13px; 
}

.bento-cell { 
    display: flex; 
    flex-direction: column;
    gap: 3px;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--border-panel);
    padding: 9px 7px;
    border-radius: 0;
    transition: all var(--transition-fast) ease;
}
.bento-cell:hover {
    background: rgba(56, 189, 248, 0.05);
}
.bento-cell:nth-child(odd) { border-right: 1px solid var(--border-panel); }

.bento-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.bento-label { 
    font-size: 10px;
    color: var(--text-secondary); 
    font-weight: 700; 
    text-transform: uppercase;
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    gap: 4px;
}
.bento-label svg {
    color: var(--text-muted);
}

.bento-val { 
    font-weight: 600; 
    color: var(--text-primary); 
    word-break: break-word;
}

.fee-status { 
    text-transform: uppercase; 
    font-weight: 700; 
    font-size: 12px;
}
.fee-status--yes { 
    color: #10b981; 
}
.fee-status--no { 
    color: var(--text-muted); 
}

/* COD PRIMARY FINANCIAL CARD */
.cod-primary-card {
    background: rgba(16, 185, 129, 0.08);
    border: 0;
    border-bottom: 1px solid rgba(16, 185, 129, 0.24);
    border-radius: 0;
    padding: 10px 7px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: none;
}
#vnpost-autofill-panel.light-mode .cod-primary-card {
    background: #f0fdf4;
    border: 0;
    border-bottom: 1px solid #bbf7d0;
    box-shadow: none;
}

.cod-card-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.cod-card-label {
    font-size: 10.5px;
    font-weight: 700;
    color: #34d399;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
#vnpost-autofill-panel.light-mode .cod-card-label {
    color: #047857;
}

.cod-status-badge {
    font-size: 10px;
    font-weight: 600;
    color: #10b981;
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
#vnpost-autofill-panel.light-mode .cod-status-badge {
    color: #059669;
}

.cod-primary-val, #rev-cod {
    font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #f87171;
    letter-spacing: -0.02em;
}
#vnpost-autofill-panel.light-mode .cod-primary-val, #vnpost-autofill-panel.light-mode #rev-cod {
    color: #dc2626;
}

.customer-history-card {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--border-panel);
    border-radius: 10px;
    background: var(--card-bg);
}
.customer-history-card[hidden] { display: none !important; }
.customer-history-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 11px;
}
.customer-history-title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
}
.customer-history-icon {
    font-size: 12px;
    line-height: 1;
}
.customer-history-count-badge {
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #10b981;
    color: #fff;
    font-size: 9px;
    font-weight: 800;
}
.customer-history-count-badge[hidden] { display: none !important; }
.customer-history-toggle-btn {
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    padding: 2px 5px;
    border-radius: 5px;
    font-size: 11px;
    cursor: pointer;
    opacity: 0.75;
    transition: all 0.15s ease;
}
.customer-history-toggle-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--border-panel);
}
.customer-history-search-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    padding: 6px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.15);
    border: 1px solid var(--border-panel);
}
#customer-history-search {
    min-width: 0;
    padding: 6px 9px;
    border: 1px solid var(--border-panel);
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    font-size: 10.5px;
}
#customer-history-search-btn {
    padding: 6px 12px;
    border: 0;
    border-radius: 6px;
    background: #0f766e;
    color: white;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
}
#customer-history-search-btn:hover { opacity: 0.9; }

.customer-history-result {
    display: grid;
    gap: 7px;
    color: var(--text-secondary);
    font-size: 10px;
    line-height: 1.45;
}
.customer-history-loading {
    padding: 8px;
    text-align: center;
    color: var(--text-muted);
    font-size: 10px;
}
.customer-history-profile {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 7px;
    border-bottom: 1px dashed var(--border-panel);
}
.customer-history-name-row {
    font-size: 11px;
    color: var(--text-primary);
}
.customer-history-phone {
    color: var(--text-secondary);
    font-size: 10px;
}
.customer-history-summary {
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(16,185,129,.08);
    color: #10b981;
    font-size: 9.5px;
    font-weight: 700;
}
.customer-history-summary.risk-warning { background: #fffbeb; color: #b45309; }
.customer-history-summary.risk-blacklist { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

.customer-history-subheading {
    color: var(--text-muted);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin-top: 2px;
}

.customer-history-orders {
    display: grid;
    gap: 6px;
}
.customer-history-order {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-panel);
    border-left: 3px solid #10b981;
    border-radius: 6px;
    background: rgba(16, 185, 129, 0.04);
    overflow: hidden;
    transition: all 0.15s ease;
}
.customer-history-order.is-clickable {
    cursor: pointer;
    outline: none;
}
.customer-history-order.is-clickable:hover {
    background: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.35);
}
.customer-history-order.is-expanded {
    background: rgba(16, 185, 129, 0.07);
    border-color: #10b981;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.customer-history-order-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
}
.customer-history-order-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}
.customer-history-order-code {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
}
.order-code-title {
    font-size: 10px;
    font-weight: 800;
    color: var(--text-primary);
}
.order-tracking-pill {
    font-size: 8px;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    font-weight: 700;
    font-family: monospace;
}
.customer-history-order-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
}
.order-carrier-badge {
    font-size: 8px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 3px;
    text-transform: uppercase;
}
.order-carrier-badge.carrier-vnpost {
    background: rgba(245, 158, 11, 0.18);
    color: #d97706;
}
.order-carrier-badge.carrier-jt {
    background: rgba(239, 68, 68, 0.18);
    color: #ef4444;
}
.order-time-badge {
    color: var(--text-secondary);
    font-size: 9px;
    font-weight: 600;
}

.customer-history-order-right {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}
.customer-history-order-cod {
    font-size: 10px;
    font-weight: 800;
    color: #10b981;
}
.customer-history-chevron {
    font-size: 11px;
    color: var(--text-muted);
    transition: transform 0.15s ease;
    user-select: none;
}

.customer-history-order-details {
    display: grid;
    gap: 5px;
    padding: 7px 9px;
    border-top: 1px dashed var(--border-panel);
    background: rgba(0, 0, 0, 0.12);
    font-size: 9.5px;
    line-height: 1.4;
}
.history-detail-row {
    display: flex;
    gap: 6px;
    align-items: flex-start;
}
.history-detail-label {
    color: var(--text-muted);
    min-width: 54px;
    flex-shrink: 0;
    font-weight: 600;
}
.history-detail-val {
    color: var(--text-primary);
    word-break: break-word;
}
.history-detail-addr-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
}
.btn-history-apply-addr {
    align-self: flex-start;
    padding: 3px 8px;
    border: 1px solid #10b981;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    font-size: 9px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
}
.btn-history-apply-addr:hover {
    background: #10b981;
    color: #fff;
}
.history-detail-timing {
    padding-top: 3px;
    border-top: 1px dotted var(--border-panel);
    font-size: 8.5px;
    color: var(--text-muted);
}
.customer-history-no-orders {
    padding: 8px;
    text-align: center;
    color: var(--text-muted);
    font-size: 9.5px;
    font-style: italic;
}

.customer-history-addresses {
    display: grid;
    gap: 5px;
    padding-top: 5px;
    border-top: 1px solid var(--border-panel);
}
.customer-history-address-title {
    color: var(--text-muted);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
}
.customer-history-address-option {
    width: 100%;
    padding: 6px 7px;
    border: 1px solid var(--border-panel);
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    text-align: left;
    font-size: 9.5px;
    line-height: 1.35;
    cursor: pointer;
}
.customer-history-address-option:hover {
    border-color: #10b981;
    background: rgba(16,185,129,.08);
}

/* Light mode overrides for customer history */
#vnpost-autofill-panel.light-mode .customer-history-search-row {
    background: rgba(0, 0, 0, 0.04);
}
#vnpost-autofill-panel.light-mode .customer-history-order-details {
    background: rgba(0, 0, 0, 0.03);
}
#vnpost-autofill-panel.light-mode .customer-history-order-cod {
    color: #059669;
}
#vnpost-autofill-panel.light-mode .order-time-badge {
    color: #4b5563;
}

/* ADDRESS ENGINE CARD */
.address-engine-card {
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 11px 0 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: none;
}

.address-engine-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.address-title-group {
    display: flex;
    align-items: center;
    gap: 6px;
}

.address-engine-title {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.address-verified-badge {
    font-size: 9.5px;
    font-weight: 700;
    padding: 1.5px 6px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.18);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
}
#vnpost-autofill-panel.light-mode .address-verified-badge {
    background: #ecfdf5;
    color: #047857;
    border-color: #a7f3d0;
}

.address-main-box {
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 8px;
    padding: 8px 10px;
    transition: all var(--transition-fast) ease;
}
.address-main-box:hover {
    border-color: rgba(56, 189, 248, 0.35);
}

.address-text-main, #rev-address {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.45;
    word-break: break-word;
    display: block;
}

.address-reference-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 8px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    margin-top: 6px;
}
.address-reference-disclosure {
    border-top: 1px solid var(--border-panel);
    padding-top: 8px;
    margin-top: 6px;
}
.address-reference-disclosure > summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    list-style: none;
    user-select: none;
}
.address-reference-disclosure > summary::-webkit-details-marker { display: none; }
.address-reference-disclosure > summary::after {
    content: '▾';
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 700;
    transition: transform var(--transition-fast);
}
.address-reference-disclosure:not([open]) > summary::after {
    content: '›';
    font-size: 16px;
}
.address-reference-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.address-reference-title {
    color: #0284c7;
    font-size: 11.5px;
    font-weight: 700;
}
.address-reference-status {
    color: #047857;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    margin-left: auto;
    margin-right: 4px;
}
.address-reference-status.is-loading { color: #f59e0b; }
.address-reference-status.is-ready { color: #047857; }
.address-reference-status.is-warning { color: #fb923c; }
.address-reference-option {
    width: 100%;
    display: grid;
    grid-template-columns: 85px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1.5px solid #38bdf8;
    border-radius: 8px;
    background: #ffffff;
    color: inherit;
    text-align: left;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(14, 165, 233, 0.1);
    transition: all var(--transition-fast) ease;
}
.address-reference-option:hover {
    border-color: #0284c7;
    background: #f0f9ff;
    box-shadow: 0 2px 6px rgba(2, 132, 199, 0.16);
    transform: translateY(-1px);
}
.address-reference-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 6px;
    background: #e0f2fe;
    color: #0284c7;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
}
.address-reference-value {
    color: #0f172a;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    word-break: break-word;
}
.address-reference-help {
    color: #64748b;
    font-size: 10.5px;
    line-height: 1.3;
    padding: 2px 2px 0 2px;
}
#vnpost-autofill-panel.light-mode .address-reference-title {
    color: #475569;
}
#vnpost-autofill-panel.light-mode .address-reference-box {
    background: #f0f9ff;
    border-color: #bae6fd;
}
#vnpost-autofill-panel.light-mode .address-reference-option {
    background: #ffffff;
    border-color: #e2e8f0;
}
#vnpost-autofill-panel.light-mode .address-reference-status.is-ready { color: #047857; }

.address-format-bar {
    display: none;
    align-items: center;
    gap: 6px;
    padding-top: 2px;
}

.format-bar-label {
    font-size: 10px;
    color: var(--text-muted);
    font-weight: 600;
}

.format-pill-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-secondary);
    font-size: 10.5px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all var(--transition-fast) ease;
}
.format-pill-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    transform: translateY(-1px);
}
.format-pill-btn.active {
    background: rgba(56, 189, 248, 0.18);
    border-color: #38bdf8;
    color: #38bdf8;
}
#vnpost-autofill-panel.light-mode .format-pill-btn.active {
    background: #e0f2fe;
    border-color: #0284c7;
    color: #0284c7;
}

/* Collapsible technical accordion */
.address-accordion {
    border-top: 1px dashed var(--border-panel);
    padding-top: 6px;
    margin-top: 2px;
}

.accordion-toggle-btn {
    background: transparent;
    border: none;
    padding: 2px 0;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s;
}
.accordion-toggle-btn:hover {
    color: var(--text-secondary);
}

.accordion-arrow {
    transition: transform 0.2s ease;
    font-size: 11px;
}
.accordion-toggle-btn.open .accordion-arrow {
    transform: rotate(180deg);
}

.accordion-content {
    padding: 6px 0 2px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.accordion-detail-row {
    display: flex;
    gap: 6px;
    font-size: 11px;
    line-height: 1.4;
}
.acc-label {
    color: var(--text-muted);
    flex-shrink: 0;
}
.acc-val {
    color: var(--text-secondary);
    word-break: break-word;
}

.accordion-detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    background: var(--input-bg);
    border: 1px solid var(--border-panel);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 11px;
}
.acc-grid-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
}
.acc-grid-item.acc-full {
    grid-column: span 2;
}
.acc-sublabel {
    font-size: 9.5px;
    color: var(--text-muted);
    text-transform: uppercase;
}
.acc-subval {
    font-weight: 600;
    color: var(--text-secondary);
}

#ai-merger-notice {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.4);
    border-left: 3px solid #f59e0b;
    color: #fde047;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    margin-bottom: 6px;
    line-height: 1.45;
    font-weight: 500;
}
#vnpost-autofill-panel.light-mode #ai-merger-notice {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-left: 3px solid #d97706;
    color: #92400e;
    font-weight: 600;
}

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
.copy-btn.mini-copy {
    padding: 1px 4px;
    border-radius: 4px;
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

/* =========================================================================
   STICKY ACTION FOOTER & READINESS STATUS
   ========================================================================= */
.panel-sticky-footer {
    position: sticky;
    bottom: 0;
    background: var(--bg-panel);
    border-top: 1px solid var(--border-panel);
    padding: 10px 14px 12px 14px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.order-readiness-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 7px;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    transition: all 0.2s ease;
}
.readiness-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
}

.order-readiness-bar.readiness-ready {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #34d399;
}
.order-readiness-bar.readiness-ready .readiness-dot {
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
}
#vnpost-autofill-panel.light-mode .order-readiness-bar.readiness-ready {
    background: #ecfdf5;
    border-color: #a7f3d0;
    color: #047857;
}

.order-readiness-bar.readiness-warn {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
}
.order-readiness-bar.readiness-warn .readiness-dot {
    background: #f59e0b;
    box-shadow: 0 0 8px #f59e0b;
}
#vnpost-autofill-panel.light-mode .order-readiness-bar.readiness-warn {
    background: #fffbeb;
    border-color: #fde68a;
    color: #b45309;
}

.order-readiness-bar.readiness-error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #f87171;
}
.order-readiness-bar.readiness-error .readiness-dot {
    background: #ef4444;
    box-shadow: 0 0 8px #ef4444;
}
#vnpost-autofill-panel.light-mode .order-readiness-bar.readiness-error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
}

.order-readiness-bar.readiness-idle {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-muted);
}
.order-readiness-bar.readiness-idle .readiness-dot {
    background: var(--text-muted);
}
#vnpost-autofill-panel.light-mode .order-readiness-bar.readiness-idle {
    background: #f1f5f9;
    border-color: #e2e8f0;
    color: #64748b;
}

.readiness-confidence-badge {
    margin-left: auto;
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    letter-spacing: 0.01em;
    cursor: default;
    transition: all 0.2s ease;
}
.readiness-confidence-badge.confidence-high {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
}
#vnpost-autofill-panel.light-mode .readiness-confidence-badge.confidence-high {
    background: #dcfce7;
    border-color: #86efac;
    color: #15803d;
}
.readiness-confidence-badge.confidence-medium {
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fbbf24;
}
#vnpost-autofill-panel.light-mode .readiness-confidence-badge.confidence-medium {
    background: #fef3c7;
    border-color: #fcd34d;
    color: #b45309;
}
.readiness-confidence-badge.confidence-low {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #f87171;
}
#vnpost-autofill-panel.light-mode .readiness-confidence-badge.confidence-low {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #b91c1c;
}

.panel-bottom-actions {
    display: flex;
    gap: 8px;
    width: 100%;
}

.btn-fill {
    flex: 1;
    padding: 10px 14px;
    color: white;
    border: none;
    border-radius: 9px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
}
.btn-fill:hover { 
    transform: translateY(-1px); 
    box-shadow: var(--shadow-md);
}
.btn-fill:active {
    transform: translateY(0) scale(0.98);
}
.btn-fill:disabled, #btnParseOrder:disabled { 
    opacity: 0.38;
    filter: grayscale(0.75);
    cursor: not-allowed; 
    transform: none; 
    box-shadow: none; 
}

.btn-fill-vnpost {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}
.btn-fill-vnpost:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.btn-fill-jt {
    background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
}
.btn-fill-jt:hover {
    background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
}

.btn-save-order {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
}
.btn-save-order:hover {
    background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
}

.review-editable {
    cursor: text;
    outline: none;
    border-radius: 5px;
    padding: 2px 5px;
    margin: -2px -5px;
    border: 1px dashed transparent;
    transition: all var(--transition-fast) ease;
    display: inline-block;
}
.review-editable:hover { 
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
}
.review-editable:focus { 
    background: rgba(255, 255, 255, 0.12); 
    border-color: #10b981;
    border-style: solid;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
}

/* Progress bar */
#gemini-progress-container {
    display: none;
    width: 100%;
    padding: 2px 0 0;
}
.ai-progress-header {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    margin-bottom: 6px;
}
#ai-status { font-weight: 500; color: var(--text-secondary); }
#ai-percent { font-weight: 700; color: #10b981; }
.progress-bar-bg {
    width: 100%;
    background-color: var(--progress-bg);
    height: 3px;
    border-radius: 6px;
    overflow: hidden;
}
#gemini-progress-bar {
    width: 0%;
    height: 100%;
    background-color: #10b981;
    transition: width 0.35s ease;
}
.parse-progress-steps {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 8px;
    margin-top: 9px;
    color: var(--text-secondary);
    font-size: 9.5px;
}
.parse-progress-steps span:last-child { color: #10b981; font-weight: 700; }
.parse-progress-steps .is-complete { color: #10b981; }
.parse-progress-steps .is-missing { color: #ef4444; }
.parse-progress-steps .is-active { color: #10b981; font-weight: 700; }

/* Header decision-first: carrier title + account context; secondary tools live outside the primary hierarchy. */
#vnpost-api-status { display: none !important; }

/* Toast styling */
#vnpost-toast-container {
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    pointer-events: none;
}
.vnpost-toast {
    font-family: 'Be Vietnam Pro', 'Noto Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: #fff;
    padding: 9px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    min-width: 250px;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    opacity: 0;
    border-left: 4px solid var(--theme-color, #10b981);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.vnpost-toast.show {
    opacity: 1;
    animation: vnpostSlideDownPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
.vnpost-toast--success {
    border-left-color: #10b981;
}
.vnpost-toast--error {
    border-left-color: #ef4444;
}

@keyframes vnpostSlideDownPop {
  0% { opacity: 0; transform: translateY(-20px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes vnpostShakeError {
  0% { opacity: 0; transform: translateY(-20px) scale(0.96); }
  35% { opacity: 1; transform: translateY(0) scale(1.02); }
  50% { transform: translateX(-5px) scale(1); }
  65% { transform: translateX(5px); }
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
   LIGHT MODE STYLES (CRISP, CLEAN & MODERN)
   ========================================================================= */
#vnpost-autofill-panel.light-mode {
    --bg-panel: rgba(255, 255, 255, 0.98);
    --border-panel: #e2e8f0;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    
    --btn-parse-bg: linear-gradient(135deg, #10b981 0%, #059669 100%);
    --btn-parse-bg-hover: linear-gradient(135deg, #059669 0%, #047857 100%);
    --btn-parse-border: rgba(16, 185, 129, 0.3);
    --btn-parse-border-hover: rgba(5, 150, 105, 0.5);
    --btn-parse-text: #ffffff;
    
    --btn-clear-bg: #f8fafc;
    --btn-clear-border: #e2e8f0;
    --btn-clear-text: #64748b;
    
    --card-bg: #f8fafc;
    --card-border: #e2e8f0;
    --card-row-bg: #ffffff;
    --card-row-border: #e2e8f0;
    --card-row-hover-bg: #ffffff;
    --card-row-hover-border: #10b981;
    
    --input-bg: #ffffff;
    --input-border: #cbd5e1;
    --input-text: #0f172a;
    --input-focus-bg: #ffffff;
    
    --cod-bg: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    --cod-border: #a7f3d0;
    --cod-text: #065f46;
    --cod-val: #047857;
    
    --ai-box-bg: #eff6ff;
    --ai-box-border: #bfdbfe;
    --ai-box-text: #1e40af;
    --ai-box-title: #1d4ed8;
    --ai-box-accent: #3b82f6;
    --ai-item-bg: #ffffff;
    --ai-item-border: #bfdbfe;
    --ai-item-hover-bg: #f0fdf4;
    
    --progress-bg: #e2e8f0;
    
    box-shadow: 0 20px 45px -8px rgba(0, 0, 0, 0.15), 0 0 1px 1px rgba(0, 0, 0, 0.06);
}

#vnpost-autofill-panel.light-mode #vnpost-panel-header {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
}
#vnpost-autofill-panel.light-mode .panel-context-strip {
    background: #ffffff;
    border-color: #e2e8f0;
}
#vnpost-autofill-panel.light-mode #vnpost-panel-header-text,
#vnpost-autofill-panel.light-mode .brand-title {
    color: #0f172a;
}
#vnpost-autofill-panel.light-mode .badge-version {
    background: #f1f5f9;
    color: #64748b;
    border-color: #e2e8f0;
}
#vnpost-autofill-panel.light-mode .pill-shop {
    background: #ecfdf5;
    color: #047857;
    border-color: #a7f3d0;
}
#vnpost-autofill-panel.light-mode .pill-carrier {
    background: #f0f9ff;
    color: #0369a1;
    border-color: #bae6fd;
}
#vnpost-autofill-panel.light-mode .pill-user {
    background: #eef2ff;
    color: #4338ca;
    border-color: #c7d2fe;
}
#vnpost-autofill-panel.light-mode #vnpost-btn-minimize,
#vnpost-autofill-panel.light-mode #vnpost-btn-settings,
#vnpost-autofill-panel.light-mode #vnpost-btn-theme,
#vnpost-autofill-panel.light-mode #vnpost-btn-dock-toggle {
    background: #f8fafc;
    border-color: #e2e8f0;
    color: #64748b;
}
#vnpost-autofill-panel.light-mode #vnpost-btn-minimize:hover,
#vnpost-autofill-panel.light-mode #vnpost-btn-settings:hover,
#vnpost-autofill-panel.light-mode #vnpost-btn-theme:hover,
#vnpost-autofill-panel.light-mode #vnpost-btn-dock-toggle:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
}
#vnpost-autofill-panel.light-mode #rawOrderText {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #0f172a;
}
#vnpost-autofill-panel.light-mode #rawOrderText:focus {
    background: #ffffff;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
}
#vnpost-autofill-panel.light-mode .review-editable:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
}
#vnpost-autofill-panel.light-mode .review-editable:focus {
    background: #ffffff;
    border-color: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}
#vnpost-autofill-panel.light-mode.minimized {
    background: #ffffff;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.12), 0 0 12px rgba(16, 185, 129, 0.25);
    border-color: #10b981;
}
#vnpost-autofill-panel.light-mode .copy-btn {
    border-color: #cbd5e1;
    color: #64748b;
}
#vnpost-autofill-panel.light-mode .copy-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #94a3b8;
}
#vnpost-autofill-panel.theme-light,
#vnpost-autofill-panel.light-mode ~ #vnpost-toast-container .vnpost-toast {
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

/* Mini Floating Dock Widget (Phase 4) */
#vnpost-mini-dock {
    position: fixed;
    right: 16px;
    bottom: 80px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.45), 0 2px 6px rgba(0,0,0,0.2);
    display: none;
    align-items: center;
    justify-content: center;
    cursor: grab;
    z-index: 2147483646;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s;
    user-select: none;
}
#vnpost-mini-dock.is-visible {
    display: flex !important;
    animation: vnpostFadeIn 0.2s ease-out;
}
#vnpost-mini-dock:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 22px rgba(16, 185, 129, 0.6);
}
#vnpost-mini-dock:active {
    cursor: grabbing;
}
.mini-dock-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background: #ef4444;
    color: #ffffff;
    font-size: 10px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    border: 2px solid #ffffff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
}

/* DRAFT QUEUE NAVIGATOR (Tách đơn trên web nạp ra panel) */
.draft-queue-container {
    margin: 0 var(--space-md) var(--space-sm) var(--space-md);
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(30, 41, 59, 0.75);
    border: 1px solid rgba(56, 189, 248, 0.3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: vnpostFadeIn 0.2s ease-out;
    transition: all 0.2s ease;
}
#vnpost-autofill-panel.theme-light .draft-queue-container,
#vnpost-autofill-panel.light-mode .draft-queue-container {
    background: #f0f9ff;
    border-color: #bae6fd;
}
.draft-queue-container.is-collapsed {
    padding: 6px 10px;
    gap: 0;
}
.draft-queue-container.is-collapsed .draft-queue-body {
    display: none !important;
}
.draft-queue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.draft-queue-title-group {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
}
.draft-queue-icon {
    font-size: 13px;
    flex-shrink: 0;
}
.draft-queue-title {
    font-size: 11px;
    font-weight: 700;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
}
#vnpost-autofill-panel.theme-light .draft-queue-title,
#vnpost-autofill-panel.light-mode .draft-queue-title {
    color: #0284c7;
}
.draft-queue-badge {
    background: #0284c7;
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 10px;
    flex-shrink: 0;
}
.draft-queue-mini-summary {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-left: 4px;
    max-width: 145px;
}
#vnpost-autofill-panel.theme-light .draft-queue-mini-summary,
#vnpost-autofill-panel.light-mode .draft-queue-mini-summary {
    color: #475569;
}
.draft-queue-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}
.draft-queue-btn-collapse {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 5px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
}
.draft-queue-btn-collapse:hover {
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.15);
}
.draft-queue-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 4px;
}
.draft-queue-close:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
}
.draft-queue-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.draft-queue-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 8px;
    padding: 4px 6px;
}
#vnpost-autofill-panel.theme-light .draft-queue-nav,
#vnpost-autofill-panel.light-mode .draft-queue-nav {
    background: #ffffff;
    border: 1px solid #e2e8f0;
}
.draft-nav-btn {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 10px;
    transition: all 0.15s;
}
.draft-nav-btn:hover:not(:disabled) {
    background: rgba(56, 189, 248, 0.3);
    border-color: #38bdf8;
}
.draft-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}
.draft-current-info {
    flex: 1;
    text-align: center;
    overflow: hidden;
    padding: 0 4px;
}
.draft-index-text {
    font-size: 9px;
    font-weight: 700;
    color: #94a3b8;
}
.draft-summary-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.draft-queue-actions,
.draft-queue-actions-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.draft-queue-primary-row {
    display: flex;
    gap: 8px;
}
.btn-draft-action-primary, 
.btn-draft-action-success {
    flex: 1;
    min-height: 33px;
    padding: 6px 10px;
    border-radius: 7px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: none;
    white-space: nowrap;
    transition: all 0.15s ease-in-out;
}
.btn-draft-action-primary {
    background: #0284c7;
    color: #ffffff;
    box-shadow: 0 1px 3px rgba(2, 132, 199, 0.25);
}
.btn-draft-action-primary:hover {
    background: #0369a1;
    transform: translateY(-1px);
}
.btn-draft-action-success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #ffffff;
    box-shadow: 0 1px 3px rgba(16, 185, 129, 0.25);
}
.btn-draft-action-success:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: translateY(-1px);
}

.draft-queue-secondary-row {
    display: flex;
    gap: 8px;
    align-items: center;
}
.btn-draft-action-danger,
.btn-draft-action-ghost-danger,
.btn-draft-action-warning,
.btn-draft-action-ghost-warning {
    flex: 1;
    min-height: 26px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    white-space: nowrap;
    transition: all 0.15s ease-in-out;
}
.btn-draft-action-ghost-danger,
.btn-draft-action-danger {
    border: 1px solid rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
}
.btn-draft-action-ghost-danger:hover,
.btn-draft-action-danger:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
}
.btn-draft-action-ghost-warning,
.btn-draft-action-warning {
    border: 1px solid rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.08);
    color: #f59e0b;
}
.btn-draft-action-ghost-warning:hover,
.btn-draft-action-warning:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: #f59e0b;
}

#vnpost-autofill-panel.theme-light .btn-draft-action-ghost-danger,
#vnpost-autofill-panel.light-mode .btn-draft-action-ghost-danger {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
}
#vnpost-autofill-panel.theme-light .btn-draft-action-ghost-warning,
#vnpost-autofill-panel.light-mode .btn-draft-action-ghost-warning {
    background: #fffbeb;
    border-color: #fde68a;
    color: #d97706;
}

/* Badge trên Header nút Toggle */
.header-draft-badge {
    position: absolute;
    top: -3px;
    right: -3px;
    background: #ef4444;
    color: #fff;
    font-size: 8.5px;
    font-weight: 700;
    line-height: 1;
    padding: 1px 4px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    min-width: 12px;
    text-align: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

@keyframes afDraftBadgePulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { transform: scale(1.15); box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.header-draft-badge.has-drafts-pulse {
    animation: afDraftBadgePulse 2s infinite;
    background: #ef4444;
}

.panel-header-btn.has-drafts-active {
    background: rgba(239, 68, 68, 0.15) !important;
    border-color: rgba(239, 68, 68, 0.4) !important;
    color: #ef4444 !important;
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
.panel-login-tabs {
    display: flex;
    gap: 6px;
    background: rgba(0, 0, 0, 0.05);
    padding: 4px;
    border-radius: 8px;
    margin: 4px 0 8px 0;
}
#vnpost-autofill-panel.light-mode .panel-login-tabs {
    background: #f1f5f9;
}
.panel-login-tab {
    flex: 1;
    padding: 7px 8px;
    font-size: 11.5px;
    font-weight: 700;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}
.panel-login-tab.active {
    background: var(--surface-bg, #ffffff);
    color: var(--theme-color, #0056b3);
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}
#vnpost-autofill-panel.light-mode .panel-login-tab.active {
    background: #ffffff;
    color: var(--theme-color, #0056b3);
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

.panel-version-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 10px;
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.35);
    letter-spacing: 0.3px;
    display: inline-flex;
    align-items: center;
    margin-left: 6px;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
#vnpost-autofill-panel.theme-light .panel-version-badge,
#vnpost-autofill-panel.light-mode .panel-version-badge {
    background: #e0f2fe;
    color: #0284c7;
    border-color: #bae6fd;
}

@keyframes vnpostFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
/* --- MODAL XÉT DUYỆT & ĐỐI CHIẾU ĐƠN HÀNG (FINTECH LOGISTICS STANDARD - UI/UX PRO MAX) --- */
.af-approval-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(15, 23, 42, 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px;
    box-sizing: border-box;
    font-family: 'Be Vietnam Pro', 'Noto Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: vnpostFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.af-approval-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    width: min(1700px, 98vw);
    max-width: 1700px;
    max-height: calc(100vh - 28px);
    box-shadow: 0 28px 75px -15px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.05);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 22px;
    box-sizing: border-box;
    color: #0f172a;
    animation: vnpostModalPop 0.24s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
}

/* Header Area - Pinned at top */
.af-approval-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #f1f5f9;
    padding-bottom: 12px;
    gap: 14px;
    flex-shrink: 0;
}

.af-approval-title-group {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
}

.af-header-shield-wrap {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 1px solid #bfdbfe;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.12);
}

.af-header-shield-icon {
    color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
}

.af-title-text-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.af-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.af-title-row h3 {
    margin: 0;
    font-size: 19px;
    font-weight: 850;
    color: #0f172a;
    letter-spacing: -0.4px;
    line-height: 1.2;
}

.af-approval-meta-row {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12.5px;
    color: #475569;
    flex-wrap: wrap;
}

/* Carrier Badges with Vibrant Identity */
.af-badge-carrier {
    background: linear-gradient(135deg, #005baa 0%, #004480 100%);
    color: #ffffff;
    font-weight: 800;
    font-size: 11.5px;
    letter-spacing: 0.4px;
    padding: 3px 10px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 2px 6px rgba(0, 91, 170, 0.28);
}
.af-badge-carrier.carrier-jt {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    box-shadow: 0 2px 6px rgba(220, 38, 38, 0.28);
}
.af-carrier-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
}

.af-badge-account {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    padding: 2.5px 8px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #334155;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.af-badge-account-icon {
    color: #64748b;
    display: inline-flex;
    align-items: center;
}
.af-badge-account-label {
    font-weight: 500;
    color: #64748b;
}
.af-badge-account-name {
    font-weight: 750;
    color: #0f172a;
}

.af-approval-pill {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    padding: 2.5px 8px;
    font-weight: 600;
    color: #475569;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
}
.af-approval-pill.pill-shop .pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
}
.af-approval-pill.af-pill-code {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1e40af;
}
.af-approval-pill.af-pill-code strong {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    letter-spacing: 0.3px;
    font-weight: 800;
}

.af-approval-close-btn {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #64748b;
    cursor: pointer;
    font-size: 14px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.16s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.af-approval-close-btn:hover {
    background: #fee2e2;
    color: #ef4444;
    border-color: #fca5a5;
    transform: scale(1.05);
}

/* 2-Column Body Grid (Table 1fr / COD Sidebar 360px) with Smooth Scrollable Area */
.af-approval-body-grid {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 20px;
    align-items: start;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
}

.af-approval-body-grid::-webkit-scrollbar {
    width: 6px;
}
.af-approval-body-grid::-webkit-scrollbar-track {
    background: transparent;
}
.af-approval-body-grid::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 999px;
}
.af-approval-body-grid::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

.af-approval-left-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.af-approval-right-col {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* Hero COD Card - Compact High-Trust Financial Hub */
.af-hero-cod {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 16px;
    border: 2px solid #cbd5e1;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    box-shadow: 0 6px 24px rgba(15, 23, 42, 0.08);
    transition: all 0.2s ease;
}

.af-hero-cod.level-danger {
    background: linear-gradient(180deg, #ffffff 0%, #fff1f2 100%);
    border: 2.5px solid #ef4444;
    box-shadow: 0 8px 28px rgba(239, 68, 68, 0.2);
}

.af-hero-cod.level-warning {
    background: linear-gradient(180deg, #ffffff 0%, #fffbeb 100%);
    border: 2.5px solid #f59e0b;
    box-shadow: 0 8px 28px rgba(245, 158, 11, 0.18);
}

.af-hero-cod.level-success {
    background: linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%);
    border: 2.5px solid #10b981;
    box-shadow: 0 8px 28px rgba(16, 185, 129, 0.18);
}

.af-hero-cod.level-info {
    background: #ffffff;
    border: 2px solid #94a3b8;
}

.af-hero-cod-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.af-hero-cod-label {
    font-size: 12px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #334155;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.af-hero-cod-badge {
    font-size: 12px;
    font-weight: 850;
    padding: 3.5px 11px;
    border-radius: 999px;
    letter-spacing: 0.3px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
}
.level-danger .af-hero-cod-badge { background: #fee2e2; color: #b91c1c; border: 1.5px solid #f87171; }
.level-warning .af-hero-cod-badge { background: #fef3c7; color: #92400e; border: 1.5px solid #f59e0b; }
.level-success .af-hero-cod-badge { background: #dcfce7; color: #166534; border: 1.5px solid #4ade80; }
.level-info .af-hero-cod-badge { background: #f1f5f9; color: #334155; border: 1.5px solid #cbd5e1; }

.af-hero-cod-center {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
    text-align: center;
    background: rgba(248, 250, 252, 0.85);
    border-radius: 12px;
    padding: 10px 8px;
    border: 1px dashed rgba(203, 213, 225, 0.8);
}

.af-hero-cod-amount {
    font-size: 38px;
    font-weight: 950;
    line-height: 1.08;
    letter-spacing: -1.2px;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.level-success .af-hero-cod-amount { color: #047857; }
.level-danger .af-hero-cod-amount { color: #dc2626; }
.level-warning .af-hero-cod-amount { color: #d97706; }

.af-hero-cod-words {
    font-size: 13.5px;
    font-weight: 700;
    font-style: normal;
    color: #475569;
    line-height: 1.4;
    padding: 0 4px;
}

/* Dual COD Comparison Box with Divider */
.af-cod-compare-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 8px;
    align-items: center;
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    padding: 10px 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.af-cod-compare-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.af-cod-source-header {
    display: flex;
    align-items: center;
    gap: 5px;
}
.af-cod-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
.af-cod-dot.carrier-dot { background: #005baa; }
.af-cod-dot.panel-dot { background: #10b981; }

.af-cod-compare-title {
    font-size: 11px;
    color: #64748b;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
}
.af-cod-compare-val {
    font-size: 18px;
    font-weight: 900;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.4px;
}

.af-cod-compare-divider {
    display: flex;
    align-items: center;
    justify-content: center;
}
.af-cod-comp-sign {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #f1f5f9;
    border: 1.5px solid #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 900;
    color: #334155;
}
.is-matched .af-cod-comp-sign {
    background: #dcfce7;
    color: #15803d;
    border-color: #4ade80;
}

/* Alert Message Box */
.af-cod-alert-box {
    border-radius: 8px;
    padding: 8px 11px;
    font-size: 12px;
    line-height: 1.4;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    color: #334155;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}
.af-alert-icon-wrap {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    margin-top: 1px;
}
.af-alert-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.af-alert-title {
    font-size: 12px;
    font-weight: 800;
}
.af-alert-msg {
    font-size: 11.5px;
    opacity: 0.95;
    color: inherit;
}
.level-danger .af-cod-alert-box { background: #fffafa; border-color: #fecaca; color: #991b1b; }
.level-warning .af-cod-alert-box { background: #fffdf5; border-color: #fde68a; color: #92400e; }
.level-success .af-cod-alert-box { background: #fbfdfc; border-color: #a7f3d0; color: #065f46; }
.level-info .af-cod-alert-box { background: #ffffff; border-color: #cbd5e1; color: #334155; }

/* Quick Action Buttons */
.af-cod-quick-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.af-quick-btn {
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12.5px;
    font-weight: 750;
    cursor: pointer;
    transition: all 0.16s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-height: 36px;
    box-sizing: border-box;
}
.af-quick-btn-apply {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(30, 64, 175, 0.28);
}
.af-quick-btn-apply:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    box-shadow: 0 4px 12px rgba(30, 64, 175, 0.38);
    transform: translateY(-1px);
}
.af-quick-btn-zero {
    background: #f8fafc;
    color: #334155;
    border: 1px solid #cbd5e1;
}
.af-quick-btn-zero:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #94a3b8;
}
.af-quick-btn-edit {
    background: #ffffff;
    color: #334155;
    border: 1px solid #cbd5e1;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.af-quick-btn-edit:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #0f172a;
    transform: translateY(-1px);
}
.af-quick-btn-cancel {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
}
.af-quick-btn-cancel:hover {
    background: #e2e8f0;
    color: #0f172a;
}

.af-inline-cod-edit {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
}
.af-inline-cod-input {
    width: 100%;
    box-sizing: border-box;
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 10px;
    color: #0f172a;
    font-size: 14px;
    font-weight: 750;
    outline: none;
    transition: all 0.15s ease;
}
.af-inline-cod-input:focus {
    border-color: #1e40af;
    box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.15);
}
.af-inline-cod-btns {
    display: flex;
    gap: 6px;
}
.af-inline-cod-btns .af-quick-btn {
    flex: 1;
}

/* Raw Text Preview Accordion */
.af-raw-preview-details {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}
.af-raw-preview-details summary {
    cursor: pointer;
    color: #475569;
    font-weight: 700;
    outline: none;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.af-raw-preview-details summary:hover {
    color: #0f172a;
}
.raw-summary-left {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.raw-summary-arrow {
    font-size: 11px;
    color: #94a3b8;
    transition: transform 0.2s ease;
}
.af-raw-preview-details[open] .raw-summary-arrow {
    transform: rotate(180deg);
}
.af-raw-preview-content {
    margin-top: 8px;
    padding: 8px 10px;
    border-top: 1px dashed #cbd5e1;
    white-space: pre-wrap;
    color: #334155;
    max-height: 110px;
    overflow-y: auto;
    line-height: 1.45;
    font-size: 11.5px;
    background: #f8fafc;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Right Column Reconciliation Table - Ultra Roomy */
.af-review-section-title {
    font-size: 12.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #334155;
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 7px;
}
.af-table-title-icon {
    color: #3b82f6;
    display: flex;
    align-items: center;
}

.af-compare-container {
    display: flex;
    flex-direction: column;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    overflow: hidden;
    background: #ffffff;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
}

.af-compare-header {
    display: grid;
    grid-template-columns: 180px 1fr 1fr 115px;
    gap: 0;
    background: #f8fafc;
    border-bottom: 1.5px solid #cbd5e1;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #475569;
    align-items: center;
}
.af-compare-col-th {
    padding: 8px 12px;
}
.af-compare-col-th.carrier {
    color: #0f172a;
    border-right: 1px solid #e2e8f0;
}
.af-compare-col-th.panel {
    color: #0f172a;
    border-right: 1px solid #e2e8f0;
}
.af-compare-col-th.status-col {
    text-align: center;
    color: #475569;
}

.af-compare-list {
    display: flex;
    flex-direction: column;
}

/* Category Dividers: Unified Luxury Enterprise Design */
.af-compare-group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-top: 1px solid #e2e8f0;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
}
.af-compare-group-header:first-child {
    border-top: none;
}
.af-compare-group-header.customer {
    background: #f8fafc;
    border-left: 4px solid #2563eb;
    color: #1e40af;
}
.af-compare-group-header.package {
    background: #f8fafc;
    border-left: 4px solid #7c3aed;
    color: #6d28d9;
}
.af-compare-group-header.service {
    background: #f8fafc;
    border-left: 4px solid #059669;
    color: #065f46;
}
.af-group-icon {
    font-size: 13px;
    display: inline-flex;
    align-items: center;
}
.customer .af-group-icon { color: #2563eb; }
.package .af-group-icon { color: #7c3aed; }
.service .af-group-icon { color: #059669; }

.af-group-title {
    font-weight: 800;
    flex: 1;
}
.af-group-badge {
    font-size: 10px;
    font-weight: 750;
    padding: 1.5px 7px;
    border-radius: 999px;
    letter-spacing: 0.3px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.customer .af-group-badge { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.package .af-group-badge { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
.service .af-group-badge { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }

/* Table Row Design - Roomy & Auto-Sized */
.af-compare-row {
    display: grid;
    grid-template-columns: 180px 1fr 1fr 115px;
    gap: 0;
    border-bottom: 1px solid #f1f5f9;
    align-items: center;
    font-size: 12.5px;
    min-height: 38px;
    transition: background 0.12s ease;
}
.af-compare-row:last-child {
    border-bottom: none;
}
.af-compare-row.is-mismatch {
    background: #fffbeb !important;
    border-left: 4px solid #f59e0b;
}
.af-compare-row.is-match {
    background: #ffffff;
}
.af-compare-row:hover {
    background: #f8fafc;
}

.af-compare-cell-label {
    font-weight: 700;
    color: #334155;
    font-size: 12.5px;
    padding: 7px 10px 7px 12px;
    display: flex;
    align-items: center;
    gap: 7px;
}
.af-field-icon {
    color: #64748b;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.af-field-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.af-compare-cell {
    font-size: 12.5px;
    font-weight: 550;
    word-break: break-word;
    line-height: 1.48;
    padding: 6px 12px;
}
.af-compare-cell.cell-carrier {
    color: #0f172a;
    border-right: 1px solid #f1f5f9;
}
.af-compare-cell.cell-panel {
    color: #0f172a !important;
    background: #ffffff;
    border-right: 1px solid #f1f5f9;
}
.af-text-cell-wrap {
    line-height: 1.45;
}

/* FIX ADDRESS BOX: NO UGLY SCROLLBAR, ROOMY, NO FIXED HEIGHT */
.af-address-cell-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 6px 10px;
    font-size: 12.5px;
    line-height: 1.48;
    color: #0f172a;
    word-break: break-word;
    box-sizing: border-box;
    max-height: none !important;
    overflow: visible !important;
}
.af-address-cell-box.panel-addr {
    background: #ffffff;
    border-color: #cbd5e1;
}

.af-compare-cell-status {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 6px 8px;
}

.af-compare-pill-match {
    font-size: 11px;
    font-weight: 800;
    color: #047857;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 6px;
    padding: 2.5px 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}
.af-compare-pill-mismatch {
    font-size: 11px;
    font-weight: 800;
    color: #b45309;
    background: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 2.5px 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}
.af-compare-pill-compatible {
    font-size: 11px;
    font-weight: 750;
    color: #0369a1;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 6px;
    padding: 2.5px 7px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    max-width: 100%;
}

/* Administrative Divisions Breakdown Chips */
.af-geo-carrier-note {
    font-size: 12px;
    color: #64748b;
    font-style: italic;
}
.af-address-breakdown {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
}
.af-address-sub-pill {
    font-size: 11.5px;
    font-weight: 550;
    padding: 2.5px 7px;
    border-radius: 6px;
    background: #f8fafc;
    color: #1e293b;
    border: 1px solid #cbd5e1;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.af-address-sub-pill .pill-tag {
    font-size: 9.5px;
    font-weight: 750;
    color: #64748b;
    text-transform: uppercase;
}
.af-address-sub-pill .pill-val {
    font-weight: 700;
}
.af-address-sub-pill.pill-street {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
}
.af-address-sub-pill.pill-ward {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1d4ed8;
}
.af-address-sub-pill.pill-ward .pill-tag { color: #3b82f6; }
.af-address-sub-pill.pill-district {
    background: #f0fdf4;
    border-color: #bbf7d0;
    color: #15803d;
}
.af-address-sub-pill.pill-district .pill-tag { color: #22c55e; }
.af-address-sub-pill.pill-province {
    background: #faf5ff;
    border-color: #e9d5ff;
    color: #7e22ce;
}
.af-address-sub-pill.pill-province .pill-tag { color: #a855f7; }

/* Modal Footer Actions - Pinned at Bottom, Always Visible */
.af-modal-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 2px;
    border-top: 1.5px solid #f1f5f9;
    padding-top: 12px;
    gap: 14px;
    flex-wrap: wrap;
    flex-shrink: 0;
}

.af-footer-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 650;
    color: #334155;
}
.af-pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    animation: afPulse 1.8s infinite;
}
.af-pulse-dot.is-warning {
    background: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
}
@keyframes afPulse {
    0% { transform: scale(0.95); opacity: 0.85; }
    50% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.85; }
}

.af-footer-btns {
    display: flex;
    align-items: center;
    gap: 10px;
}

.af-modal-btn-cancel {
    background: #ffffff;
    color: #475569;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.af-modal-btn-cancel:hover {
    background: #f8fafc;
    color: #0f172a;
    border-color: #94a3b8;
}
.af-modal-btn-cancel:active {
    transform: scale(0.98);
}

.af-modal-btn-confirm {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    color: #ffffff;
    border: 1px solid #047857;
    border-radius: 8px;
    padding: 9px 24px;
    font-size: 13.5px;
    font-weight: 800;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    box-shadow: 0 4px 14px rgba(5, 150, 105, 0.32);
    transition: all 0.16s ease;
    letter-spacing: 0.2px;
}
.af-modal-btn-confirm:hover:not(:disabled) {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-color: #059669;
    box-shadow: 0 6px 18px rgba(5, 150, 105, 0.42);
    transform: translateY(-1px);
}
.af-modal-btn-confirm:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
}
.af-modal-btn-confirm:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    background: #94a3b8;
    border-color: #94a3b8;
    box-shadow: none;
}

.af-kbd {
    display: inline-block;
    padding: 2px 5px;
    font-size: 10.5px;
    font-family: inherit;
    font-weight: 750;
    line-height: 1;
    color: #475569;
    background-color: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    box-shadow: inset 0 -1px 0 #cbd5e1;
}
.af-kbd.primary {
    color: #ffffff;
    background-color: rgba(255, 255, 255, 0.22);
}


/* ══════════════════════════════════════════════════════════════════
   DARK THEME OVERRIDES FOR APPROVAL MODAL
   ══════════════════════════════════════════════════════════════════ */
#vnpost-autofill-panel:not(.light-mode) .af-approval-card {
    background: #0f172a;
    border-color: #334155;
    color: #f8fafc;
    box-shadow: 0 28px 75px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1);
}
#vnpost-autofill-panel:not(.light-mode) .af-approval-header {
    border-bottom-color: #1e293b;
}
#vnpost-autofill-panel:not(.light-mode) .af-header-shield-wrap {
    background: rgba(37, 99, 235, 0.15);
    border-color: rgba(37, 99, 235, 0.35);
}
#vnpost-autofill-panel:not(.light-mode) .af-title-row h3 {
    color: #f8fafc;
}
#vnpost-autofill-panel:not(.light-mode) .af-badge-account,
#vnpost-autofill-panel:not(.light-mode) .af-approval-pill {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
}
#vnpost-autofill-panel:not(.light-mode) .af-badge-account-name {
    color: #f8fafc;
}
#vnpost-autofill-panel:not(.light-mode) .af-approval-close-btn {
    background: #1e293b;
    border-color: #334155;
    color: #94a3b8;
}
#vnpost-autofill-panel:not(.light-mode) .af-approval-close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.4);
}
#vnpost-autofill-panel:not(.light-mode) .af-hero-cod {
    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    border-color: #334155;
}
#vnpost-autofill-panel:not(.light-mode) .af-hero-cod.level-success {
    border-color: rgba(16, 185, 129, 0.5);
}
#vnpost-autofill-panel:not(.light-mode) .af-hero-cod.level-danger {
    border-color: rgba(239, 68, 68, 0.5);
}
#vnpost-autofill-panel:not(.light-mode) .af-hero-cod.level-warning {
    border-color: rgba(245, 158, 11, 0.5);
}
#vnpost-autofill-panel:not(.light-mode) .af-hero-cod-amount {
    color: #f8fafc;
}
#vnpost-autofill-panel:not(.light-mode) .level-success .af-hero-cod-amount {
    color: #34d399;
}
#vnpost-autofill-panel:not(.light-mode) .level-danger .af-hero-cod-amount {
    color: #f87171;
}
#vnpost-autofill-panel:not(.light-mode) .level-warning .af-hero-cod-amount {
    color: #fbbf24;
}
#vnpost-autofill-panel:not(.light-mode) .af-hero-cod-words {
    color: #94a3b8;
}
#vnpost-autofill-panel:not(.light-mode) .af-cod-compare-grid {
    background: rgba(15, 23, 42, 0.6);
    border-color: #334155;
}
#vnpost-autofill-panel:not(.light-mode) .af-cod-compare-val {
    color: #f8fafc;
}
#vnpost-autofill-panel:not(.light-mode) .af-cod-comp-sign {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
}
#vnpost-autofill-panel:not(.light-mode) .af-cod-alert-box {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
}
#vnpost-autofill-panel:not(.light-mode) .af-quick-btn-edit {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
}
#vnpost-autofill-panel:not(.light-mode) .af-quick-btn-edit:hover {
    background: #334155;
    color: #f8fafc;
}
#vnpost-autofill-panel:not(.light-mode) .af-raw-preview-details {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
}
#vnpost-autofill-panel:not(.light-mode) .af-raw-preview-content {
    background: #0f172a;
    border-top-color: #334155;
    color: #cbd5e1;
}
#vnpost-autofill-panel:not(.light-mode) .af-review-section-title {
    color: #cbd5e1;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-container {
    background: #1e293b;
    border-color: #334155;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-header {
    background: #0f172a;
    border-bottom-color: #334155;
    color: #94a3b8;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-col-th.carrier,
#vnpost-autofill-panel:not(.light-mode) .af-compare-col-th.panel {
    color: #f8fafc;
    border-right-color: #334155;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-group-header {
    background: #0f172a;
    border-top-color: #334155;
    border-bottom-color: #334155;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-row {
    background: #1e293b;
    border-bottom-color: #334155;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-row.is-match {
    background: #1e293b;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-row.is-mismatch {
    background: rgba(245, 158, 11, 0.12) !important;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-row:hover {
    background: #24344d;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-cell-label {
    color: #e2e8f0;
}
#vnpost-autofill-panel:not(.light-mode) .af-compare-cell.cell-carrier,
#vnpost-autofill-panel:not(.light-mode) .af-compare-cell.cell-panel {
    color: #f8fafc !important;
    background: transparent;
    border-right-color: #334155;
}
#vnpost-autofill-panel:not(.light-mode) .af-address-cell-box {
    background: #0f172a;
    border-color: #334155;
    color: #f8fafc;
}
#vnpost-autofill-panel:not(.light-mode) .af-address-cell-box.panel-addr {
    background: #1e293b;
    border-color: #475569;
}
#vnpost-autofill-panel:not(.light-mode) .af-modal-actions {
    border-top-color: #334155;
}
#vnpost-autofill-panel:not(.light-mode) .af-footer-summary {
    color: #cbd5e1;
}
#vnpost-autofill-panel:not(.light-mode) .af-modal-btn-cancel {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
}
#vnpost-autofill-panel:not(.light-mode) .af-modal-btn-cancel:hover {
    background: #334155;
    color: #f8fafc;
}
#vnpost-autofill-panel:not(.light-mode) .af-approval-body-grid::-webkit-scrollbar-thumb {
    background: #334155;
}
#vnpost-autofill-panel:not(.light-mode) .af-approval-body-grid::-webkit-scrollbar-thumb:hover {
    background: #475569;
}


/* Status badges for panel review card */
.cod-badge-danger { background: rgba(239, 68, 68, 0.2) !important; color: #f87171 !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; }
.cod-badge-warning { background: rgba(245, 158, 11, 0.2) !important; color: #fbbf24 !important; border: 1px solid rgba(245, 158, 11, 0.35) !important; }
.cod-badge-success { background: rgba(16, 185, 129, 0.2) !important; color: #34d399 !important; border: 1px solid rgba(16, 185, 129, 0.35) !important; }
.cod-badge-info { background: rgba(2, 132, 199, 0.2) !important; color: #38bdf8 !important; border: 1px solid rgba(2, 132, 199, 0.35) !important; }


`;globalThis.PANEL_CSS=r})();
})()