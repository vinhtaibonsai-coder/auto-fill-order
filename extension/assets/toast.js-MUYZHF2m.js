(function(){(()=>{function x(r){if(typeof document>"u")return;const o=r||document.head;if(!(o.querySelector&&o.querySelector("#vnpost-toast-styles")))try{const e=document.createElement("style");e.id="vnpost-toast-styles",e.textContent=`
        #vnpost-toast-container {
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: flex-end;
            pointer-events: none;
        }
        .vnpost-toast {
            font-family: 'Be Vietnam Pro', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #f8fafc;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13.5px;
            font-weight: 500;
            min-width: 280px;
            max-width: 380px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
            opacity: 0;
            border-left: 4px solid var(--theme-color, #4f46e5);
            transform: translateX(120%);
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .vnpost-toast.show {
            opacity: 1;
            transform: translateX(0);
        }
        .vnpost-toast-icon {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
            width: 20px !important;
            height: 20px !important;
            min-width: 20px !important;
            min-height: 20px !important;
        }
        .vnpost-toast-icon svg {
            width: 20px !important;
            height: 20px !important;
            display: block !important;
        }
        .vnpost-toast-message {
            flex-grow: 1;
            line-height: 1.4;
            text-align: left;
        }
        .vnpost-toast-close {
            background: none;
            border: none;
            padding: 4px;
            margin: -4px -4px -4px 4px;
            color: rgba(255, 255, 255, 0.4);
            cursor: pointer;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            transition: all 0.2s;
        }
        .vnpost-toast-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
        }
        .vnpost-toast-close svg {
            width: 12px;
            height: 12px;
        }
        .vnpost-toast--success {
            border-left-color: #10b981;
            background: rgba(6, 78, 59, 0.96);
        }
        .vnpost-toast--success .vnpost-toast-icon {
            color: #34d399;
            filter: drop-shadow(0 0 4px rgba(52, 211, 153, 0.4));
        }
        .vnpost-toast--error {
            border-left-color: #ef4444;
            background: rgba(127, 29, 29, 0.96);
        }
        .vnpost-toast--error .vnpost-toast-icon {
            color: #fca5a5;
            filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.4));
        }
        .vnpost-toast--error.show {
            animation: vnpostShakeError 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        .vnpost-toast--warning {
            border-left-color: #f59e0b;
            background: rgba(120, 53, 15, 0.96);
        }
        .vnpost-toast--warning .vnpost-toast-icon {
            color: #fde047;
            filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.4));
        }
        .vnpost-toast--info {
            border-left-color: #3b82f6;
        }
        .vnpost-toast--info .vnpost-toast-icon {
            color: #93c5fd;
            filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));
        }
        .vnpost-toast.light-mode {
            background: rgba(255, 255, 255, 0.95);
            color: #0f172a;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(0, 0, 0, 0.06);
        }
        .vnpost-toast.light-mode .vnpost-toast-close {
            color: rgba(0, 0, 0, 0.4);
        }
        .vnpost-toast.light-mode .vnpost-toast-close:hover {
            background: rgba(0, 0, 0, 0.05);
            color: rgba(0, 0, 0, 0.8);
        }
        .vnpost-toast--success.light-mode { background: #ecfdf5; color: #065f46; }
        .vnpost-toast--error.light-mode { background: #fef2f2; color: #991b1b; }
        .vnpost-toast--warning.light-mode { background: #fffbeb; color: #92400e; }
        @keyframes vnpostShakeError {
          0% { opacity: 0; transform: translateX(120%); }
          30% { opacity: 1; transform: translateX(0) scale(1.02); }
          50% { transform: translateX(-6px); }
          70% { transform: translateX(4px); }
          90% { transform: translateX(-2px); }
          100% { transform: translateX(0); }
        }
      `,o.appendChild(e)}catch{}}function b(r){return String(r||"").replace(/^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}\u200d\ufe0f✓✕⚠⚪●○⇥]+/gu,"").replace(/^[:\-–—\s]+/,"").trim()}function y(r,o){const e=String(r||"").toLowerCase();return/cảnh báo|cần kiểm tra|vui lòng|chưa|không đúng định dạng/.test(e)||/⚠/.test(e)?"warning":o==="success"||o==="error"||o==="warning"||o==="info"?o:"info"}function w(r,o){try{if(typeof document>"u"){console.log("[Auto Fill Order]",r);return}const e=document.getElementById("vnpost-autofill-shadow-host")||document.getElementById("af-react-root")||document.body;if(!e){console.log("[Auto Fill Order]",r);return}const l=e.shadowRoot||e,i=y(r,o),h=b(r);x(l);let n=l.getElementById?l.getElementById("vnpost-toast-container"):null;!n&&l.querySelector&&(n=l.querySelector("#vnpost-toast-container")),n||(n=document.createElement("div"),n.id="vnpost-toast-container",l.appendChild(n));const s=Array.from(n.children).find(m=>{const v=m.querySelector(".vnpost-toast-message");return v&&v.textContent===h});if(s){s.classList.remove("show"),requestAnimationFrame(()=>s.classList.add("show"));return}for(;n.children.length>=2;){const m=n.firstChild;m&&m.remove()}const c=l.getElementById?l.getElementById("vnpost-autofill-panel"):null,g=c&&c.classList.contains("light-mode"),t=document.createElement("div");t.className="vnpost-toast vnpost-toast--"+i,g&&t.classList.add("light-mode");const d=document.createElement("div");d.className="vnpost-toast-icon";let a="";i==="success"?a='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14 9 11"/></svg>':i==="error"?a='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>':i==="warning"?a='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>':a='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',d.innerHTML=a;const p=document.createElement("div");p.className="vnpost-toast-message",p.textContent=h;const f=document.createElement("button");f.className="vnpost-toast-close",f.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',f.onclick=()=>{t.classList.remove("show"),setTimeout(()=>t.remove(),250)},t.appendChild(d),t.appendChild(p),t.appendChild(f),n.appendChild(t),requestAnimationFrame(()=>t.classList.add("show")),setTimeout(()=>{t.parentNode&&(t.classList.remove("show"),setTimeout(()=>t.remove(),250))},i==="error"?3500:2200)}catch(e){console.warn("Toast error:",e)}}function k(r){return new Promise(o=>{try{let f=function(){s.remove(),o(!0)},u=function(){s.remove(),o(!1)};var e=f,l=u;const i=document.getElementById("vnpost-autofill-shadow-host");if(!i){o(!0);return}const h=i.shadowRoot||i,n=h.getElementById("vnpost-confirm-overlay");n&&n.remove();const s=document.createElement("div");s.id="vnpost-confirm-overlay";const c=document.createElement("div");c.id="vnpost-confirm-modal";const g=document.createElement("div");g.id="vnpost-confirm-title",g.textContent="⚠️ Cảnh báo trùng ĐVVC";const t=document.createElement("div");t.id="vnpost-confirm-msg",r.split(`
`).forEach((m,v)=>{v>0&&t.appendChild(document.createElement("br")),t.appendChild(document.createTextNode(m))});const d=document.createElement("div");d.id="vnpost-confirm-actions";const a=document.createElement("button");a.id="vnpost-confirm-btn-cancel",a.textContent="Hủy";const p=document.createElement("button");p.id="vnpost-confirm-btn-ok",p.textContent="Đồng ý",d.appendChild(a),d.appendChild(p),c.appendChild(g),c.appendChild(t),c.appendChild(d),s.appendChild(c),h.appendChild(s),a.onclick=u,p.onclick=f,s.onclick=m=>{m.target===s&&u()}}catch{o(!0)}})}globalThis.showVnpostToast=w,globalThis.showPanelConfirmModal=k})();
})()