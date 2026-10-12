(function(){(()=>{const H={theme:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/><path d="M12 2a10 10 0 0 0 10 10" fill="currentColor" opacity="0.3"/></svg>',settings:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',minimize:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',maximize:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',dock:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/><path d="m10 9-3 3 3 3"/></svg>',float:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',parse:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',clear:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',copy:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',check:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',user:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',phone:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',orderCode:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>',fee:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',address:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',package:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',fill:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',save:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',apiWaiting:'<svg class="spinner-loading" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',apiWarning:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',apiOk:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',apiUnknown:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',warn:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'},pt=340;function Vt(){if(typeof document>"u")return null;const i=document.getElementById("vnpost-autofill-shadow-host");return i&&i.shadowRoot?i.shadowRoot:document}function k(i){const s=Vt();return s&&s.getElementById?s.getElementById(i):null}function de(i){return String(i??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s])}function ut(i){if(typeof i=="string"){const s=i.toLowerCase();return s.includes("vnpost")?{id:"vnpost",title:"VNPost",themeColor:"#0056b3"}:s.includes("jt")?{id:"jt",title:"J&T Express",themeColor:"#e11d48"}:{id:s,title:s.toUpperCase(),themeColor:"#4f46e5"}}return i||{id:"vnpost",title:"VNPost",themeColor:"#0056b3"}}function Ht(i){return i?String(i).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/\s+/g,"").trim():""}function rn(){try{if((typeof localStorage<"u"?localStorage.getItem("antigravity_ui_theme"):null)==="dark")return"dark"}catch{}return"light"}function Tt(i){i&&(rn()==="dark"?i.classList.remove("light-mode"):i.classList.add("light-mode"))}function Nt(i){const s=i?"light":"dark";try{typeof localStorage<"u"&&localStorage.setItem("antigravity_ui_theme",s)}catch{}let l=!1;try{l=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(l&&chrome.storage&&chrome.storage.local)try{chrome.storage.local.set({antigravity_ui_theme:s})}catch{}}const Ke={get(i,s){try{let d=!1;try{d=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(d&&chrome.storage&&chrome.storage.local){chrome.storage.local.get(i,T=>{chrome.runtime&&chrome.runtime.lastError,s(T||{})});return}}catch{}const l={};i.forEach(d=>{try{const T=typeof localStorage<"u"?localStorage.getItem(d):null;l[d]=T?JSON.parse(T):void 0}catch{l[d]=void 0}}),s(l)},set(i){try{let s=!1;try{s=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(s&&chrome.storage&&chrome.storage.local){chrome.storage.local.set(i,()=>{chrome.runtime&&chrome.runtime.lastError});return}}catch{}typeof localStorage>"u"||Object.entries(i).forEach(([s,l])=>{try{localStorage.setItem(s,JSON.stringify(l))}catch{}})}};function qt(i,s){i&&i.classList.toggle("is-visible",!!s)}function ht(i){if(typeof document>"u"||!document.body)return;const s=document.body,l="vnpost-dock-page-offset-style";let d=document.getElementById(l);if(i){s.dataset.vnpostDockOffsetActive!=="true"&&(s.dataset.vnpostDockOriginalPaddingRight=s.style.paddingRight||"",s.dataset.vnpostDockOriginalTransition=s.style.transition||"");const T=parseFloat(window.getComputedStyle(s).paddingRight||"0")||0,g=s.dataset.vnpostDockOffsetActive==="true"?Math.max(0,T-pt):T;s.style.paddingRight=`${g+pt}px`,s.style.transition||(s.style.transition="padding-right 280ms cubic-bezier(0.4, 0, 0.2, 1)"),s.dataset.vnpostDockOffsetActive="true",d||(d=document.createElement("style"),d.id=l,(document.head||document.documentElement).appendChild(d)),d.textContent=`
        /* Đẩy các thanh công cụ / nút bấm cố định ở đáy trang của VNPost & J&T sang trái khi panel đang ghim */
        .ant-pro-footer-bar,
        .ant-pro-footer-bar-dom,
        .ant-pro-footer-toolbar,
        div[class*="ant-pro-footer-bar"],
        div[class*="ant-pro-footer-toolbar"],
        .fixed-bottom-container,
        div[class*="fixed-bottom-container"],
        .fixed-bottom,
        div[class*="fixed-bottom"],
        .footer-btn,
        div[class*="footer-btn"],
        .page-footer,
        .create-order-footer,
        .order-create-footer,
        .bottom-action-bar,
        .action-bar-fixed,
        .action-bar,
        .order-footer,
        .ant-layout-footer,
        .el-footer,
        footer[class*="fixed" i],
        footer[style*="fixed"],
        div[class*="footer" i][class*="fixed" i],
        div[class*="bottom" i][class*="fixed" i],
        div[class*="footer" i][style*="fixed"],
        div[class*="bottom" i][style*="fixed"],
        div[style*="position: fixed"][style*="bottom: 0"],
        div[style*="position:fixed"][style*="bottom:0"],
        div[style*="position: fixed"][style*="bottom:0"] {
          right: ${pt}px !important;
          width: auto !important;
          max-width: calc(100vw - ${pt}px) !important;
          box-sizing: border-box !important;
          transition: right 280ms cubic-bezier(0.4, 0, 0.2, 1), max-width 280ms cubic-bezier(0.4, 0, 0.2, 1), width 280ms cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        /* Đảm bảo flex container bên trong các thanh footer không bị tràn */
        .ant-pro-footer-bar-right,
        .ant-pro-footer-bar > div,
        .fixed-bottom-container > div {
          padding-right: 12px !important;
          box-sizing: border-box !important;
        }
      `;return}s.dataset.vnpostDockOffsetActive==="true"&&(s.style.paddingRight=s.dataset.vnpostDockOriginalPaddingRight||"",s.style.transition=s.dataset.vnpostDockOriginalTransition||"",delete s.dataset.vnpostDockOffsetActive,delete s.dataset.vnpostDockOriginalPaddingRight,delete s.dataset.vnpostDockOriginalTransition),d&&d.remove()}function gt(i,s,l,d,T={}){const g=d==="floating"?"floating":"docked",N=k("vnpost-btn-minimize");if(g==="docked"){i.classList.remove("panel-floating","minimized"),i.classList.add("panel-docked"),i.classList.toggle("collapsed",!!T.collapsed),i.style.top="",i.style.left="",i.style.right="",i.style.bottom="",qt(s,T.collapsed),ht(!T.collapsed),l&&(l.innerHTML=H.float,l.title="Thả nổi panel"),N&&(N.innerHTML=H.minimize,N.title="Thu vào mép phải");return}i.classList.remove("panel-docked","collapsed"),i.classList.add("panel-floating"),qt(s,!1),ht(!1),l&&(l.innerHTML=H.dock,l.title="Ghim panel vào mép phải"),N&&(N.innerHTML=i.classList.contains("minimized")?H.maximize:H.minimize,N.title="Thu nhỏ panel");const E=T.position||{},P=Number(E.top),f=Number(E.left);Number.isFinite(P)&&Number.isFinite(f)?(i.style.top=`${Math.max(0,P)}px`,i.style.left=`${Math.max(0,f)}px`,i.style.right="auto",i.style.bottom="auto"):(i.style.top="20px",i.style.right="20px",i.style.left="auto",i.style.bottom="auto")}function zt(i,s,l,d,T,g,N,E){var I,r,h,q;try{let rt=function(){if(ve&&(ve.classList.toggle("is-collapsed",ue),We&&(We.textContent=ue?"▼":"▲",We.title=ue?"Mở rộng hàng đợi":"Thu gọn hàng đợi"),ne))if(ue&&Z.length>0){const e=Z[se],t=(e==null?void 0:e.name)||"Khách lẻ",o=e!=null&&e.phone?` (${e.phone})`:"";ne.textContent=`· Đơn ${se+1}: ${t}${o}`,ne.style.display="inline-block"}else ne.style.display="none"},lt=function(){if(!Z.length)return;const e=Z[se];if(e){if($e&&($e.textContent=`Đơn ${se+1}/${Z.length}`),mt){const t=e.name||"Khách lẻ",o=e.phone||"",a=Number(e.codAmount||e.cod_amount||e.cod)||0,c=a>0?` · COD ${a.toLocaleString("vi-VN")}đ`:"";mt.textContent=`${t} (${o})${c}`}Ce&&(Ce.disabled=se<=0),Le&&(Le.disabled=se>=Z.length-1),rt()}},Xe=function(){if(!Z.length)return;const e=Z[se];e&&(globalThis.parsedDataStore={savedOrderId:e.id,name:e.name||"",phone:e.phone||"",address:e.address||"",orderCode:e.orderCode||e.order_code||"",codAmount:Number(e.codAmount||e.cod_amount||e.cod)||0,goodsName:e.goodsName||e.goods_name||e.productItem||e.defaultGoodsName||"",weightGrams:Number(e.weightGrams||e.weight)||200,notes:e.notes||"",collectFee:!!(e.collectFee||e.collect_fee),rawAddress:e.rawAddress||e.address||"",ward:e.ward||"",district:e.district||"",province:e.province||""},D&&(D.value=e.rawText||`${e.name||""} ${e.phone||""} ${e.address||""}`),typeof Ye=="function"&&Ye(globalThis.parsedDataStore),showVnpostToast(`📥 Đã nạp đơn ${se+1}/${Z.length}: ${e.name||"Khách"}`,"info"))},Ot=function(){nn=null,Ct&&(Ct.src=""),kt&&(kt.textContent=""),xt&&(xt.style.display="none"),Fe&&(Fe.style.display="none")};var P=rt,f=lt,w=Xe,_=Ot;if(typeof document>"u")return;const C=ut(i);let B=document.getElementById("vnpost-autofill-shadow-host");const b=B?k("vnpost-autofill-panel"):null;if(b)if(b.dataset&&b.dataset.panelType==="login")b.remove();else return;if(!document.body)return;B||(B=document.createElement("div"),B.id="vnpost-autofill-shadow-host",document.body.appendChild(B));const n=B.shadowRoot||B.attachShadow({mode:"open"}),v=n.querySelector("#vnpost-autofill-panel");v&&v.remove();const p=n.querySelector("#vnpost-dock-toggle-tab");if(p&&p.remove(),!n.querySelector("#vnpost-shadow-style")){const e=document.createElement("style");e.id="vnpost-shadow-style",e.textContent=typeof PANEL_CSS<"u"?PANEL_CSS:"",n.appendChild(e)}const L=document.createElement("div");L.id="vnpost-autofill-panel",L.dataset.panelType="input",Tt(L);let ae=!1;try{ae=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(ae&&chrome.storage&&chrome.storage.local)try{chrome.storage.local.get(["antigravity_ui_theme"],e=>{if(!chrome.runtime.lastError){if(e&&e.antigravity_ui_theme==="dark"){L.classList.remove("light-mode");try{localStorage.setItem("antigravity_ui_theme","dark")}catch{}}else if(e&&e.antigravity_ui_theme==="light"){L.classList.add("light-mode");try{localStorage.setItem("antigravity_ui_theme","light")}catch{}}}})}catch{}const X=C.themeColor||(C.id==="vnpost"?"#0056b3":"#4f46e5");L.style.setProperty("--theme-color",X);const V=C.id==="vnpost",K=V?"display: inline-flex; background-color: #10b981;":"display: none;",pe=V?"display: none;":"display: inline-flex; background-color: #e11d48;";let Ae="v1";try{let e=!1;try{e=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.getManifest}catch{}e&&(Ae="v"+(chrome.runtime.getManifest().version||"1"))}catch{}L.innerHTML=`
        <div class="minimized-icon">${H.parse}</div>
        
        <!-- HEADER TOPBAR -->
        <div id="vnpost-panel-header">
          <div class="vnpost-header-main">
            <div class="vnpost-brand-group">
              <span class="brand-live-dot" title="Sẵn sàng hoạt động"></span>
              <span id="vnpost-panel-header-text" class="brand-title"></span>
              <span id="vnpost-panel-version-badge" class="panel-version-badge" title="Phiên bản Auto Fill Order">${Ae}</span>
            </div>
            <div class="vnpost-header-controls">
              <span id="vnpost-api-status" title="Kiểm tra kết nối..." class="api-status-badge">${H.apiWaiting}</span>
              <button id="vnpost-btn-toggle-draft-queue" class="panel-header-btn" title="Bật / Tắt Hàng đợi đơn nháp" style="position:relative;">📥<span id="header-draft-count-badge" class="header-draft-badge" style="display:none;">0</span></button>
              <button id="vnpost-btn-dock-toggle" title="Thả nổi / Ghim panel">${H.float}</button>
              <button id="vnpost-btn-theme" title="Chuyển chế độ Sáng / Tối">${H.theme}</button>
              <button id="vnpost-btn-settings" title="Cài đặt & Quản lý">${H.settings}</button>
              <button id="vnpost-btn-minimize" title="Thu nhỏ">${H.minimize}</button>
            </div>
          </div>
          <div class="panel-context-strip" aria-label="Ngữ cảnh lên đơn">
            <div class="panel-context-shop">🏪 <span id="panel-shop-name" class="panel-context-value context-missing">Chưa chọn Shop</span></div>
            <button id="panel-account-trigger" class="panel-account-trigger" type="button" aria-expanded="false" aria-haspopup="menu">
              👤 <span id="panel-user-account" class="panel-context-value context-missing">Chưa xác định</span>
              <span class="context-separator">·</span>
              <span id="panel-carrier-account" class="panel-context-value context-missing">Chưa nhận diện</span>
            </button>
            <div id="panel-account-menu" class="panel-account-menu" role="menu" hidden>
              <strong id="panel-menu-user">---</strong><span id="panel-menu-carrier">---</span>
              <hr><span id="panel-menu-shop">---</span><span>${C.title||""}</span>
              <hr><div class="panel-menu-version-row" style="font-size:11px; color:#94a3b8; padding:3px 8px; font-weight:600; display:flex; justify-content:space-between; align-items:center;">
                <span>Phiên bản:</span>
                <span class="menu-version-badge" style="color:#38bdf8; font-weight:700;">${Ae}</span>
              </div><hr>
              <button id="panel-menu-settings" type="button" role="menuitem">⚙ Cài đặt</button>
              <button id="panel-menu-logout" type="button" role="menuitem">⇥ Đăng xuất</button>
            </div>
          </div>
        </div>

        <div id="vnpost-panel-body">
          <!-- HÀNG ĐỢI ĐƠN NHÁP (DRAFT QUEUE NAVIGATOR) -->
          <div id="vnpost-draft-queue" class="draft-queue-container" style="display:none;">
            <div class="draft-queue-header">
              <div class="draft-queue-title-group">
                <span class="draft-queue-icon">📥</span>
                <span class="draft-queue-title">Hàng Đợi Đơn Nháp</span>
                <span id="draft-queue-badge" class="draft-queue-badge">0 đơn</span>
                <span id="draft-queue-mini-summary" class="draft-queue-mini-summary" style="display:none;"></span>
              </div>
              <div class="draft-queue-header-actions">
                <button id="btn-draft-queue-toggle-collapse" class="draft-queue-btn-collapse" type="button" title="Thu gọn / Mở rộng hàng đợi">▲</button>
                <button id="btn-draft-queue-clear" class="draft-queue-close" type="button" title="Ẩn / Tắt hàng đợi này">✕</button>
              </div>
            </div>
            <div class="draft-queue-body">
              <div class="draft-queue-nav">
                <button id="btn-draft-prev" class="draft-nav-btn" title="Đơn trước">◀</button>
                <div class="draft-current-info">
                  <div id="draft-current-index" class="draft-index-text">Đơn 1/1</div>
                  <div id="draft-current-summary" class="draft-summary-text">---</div>
                </div>
                <button id="btn-draft-next" class="draft-nav-btn" title="Đơn kế tiếp">▶</button>
              </div>
              <div class="draft-queue-actions-container">
                <div class="draft-queue-primary-row">
                  <button id="btn-draft-load" class="btn-draft-action-primary" title="Nạp đơn này vào bảng kiểm tra">
                    ⚡ <span>Nạp Vào Bảng</span>
                  </button>
                  <button id="btn-draft-fill-next" class="btn-draft-action-success" title="Điền vào form bưu điện và tự chuyển sang đơn kế tiếp">
                    ⏩ <span>Điền & Đơn Tiếp</span>
                  </button>
                </div>
                <div class="draft-queue-secondary-row">
                  <button id="btn-draft-delete" class="btn-draft-action-ghost-danger" title="Xóa đơn này khỏi hàng đợi nháp">
                    🗑️ <span>Xóa đơn này</span>
                  </button>
                  <button id="btn-draft-clear-all" class="btn-draft-action-ghost-warning" title="Dọn sạch toàn bộ các đơn nháp trong hàng đợi">
                    🧹 <span>Xóa tất cả</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div id="source-order-card" class="input-card" aria-expanded="true">
            <div class="input-card-header">
              <span id="source-card-title" class="input-card-title">📝 Nội dung đơn hàng</span>
              <div class="source-card-header-actions">
                <span id="source-dirty-badge" class="source-dirty-badge" style="display:none;">● Đã thay đổi</span>
                <span class="input-kbd-shortcut" title="Phím tắt tách nhanh">Ctrl + ↵</span>
                <button id="btn-edit-source" class="source-edit-btn" type="button" style="display:none;" title="Mở nội dung gốc để chỉnh sửa">✎ Sửa</button>
              </div>
            </div>
            <div id="source-expanded-content">
              <!-- KHUNG XEM TRƯỚC ẢNH KHI DÁN (Ctrl+V) HOẶC KÉO THẢ VÀO Ô NHẬP LIỆU -->
              <div id="panel-image-paste-preview" class="panel-image-paste-preview" style="display:none;">
                <div class="image-preview-thumb-wrap">
                  <img id="panel-pasted-img" src="" alt="Ảnh đơn hàng đã dán" />
                  <div class="image-preview-meta">
                    <span class="image-preview-badge">📷 Ảnh đơn hàng</span>
                    <span id="panel-pasted-img-info" class="image-preview-info"></span>
                  </div>
                  <button id="btn-remove-pasted-img" class="btn-remove-pasted-img" type="button" title="Gỡ ảnh">✕</button>
                </div>
                <div id="panel-image-ocr-status" class="panel-image-ocr-status" style="display:none;">
                  <span class="spinner-inline">⏳</span> <span id="panel-image-ocr-status-text">Đang nhận diện đơn qua Gemini Vision...</span>
                </div>
              </div>
              <textarea id="rawOrderText" rows="3" placeholder="Dán văn bản hoặc DÁN ẢNH (Ctrl+V) / Kéo thả ảnh đơn hàng vào đây...&#10;(Hỗ trợ ảnh chụp màn hình Zalo, Facebook, hóa đơn, bưu gửi)"></textarea>
              <div id="source-dirty-message" class="source-dirty-message" style="display:none;">Nội dung nguồn đã thay đổi. Kết quả bên dưới chưa được cập nhật.</div>
              <div class="input-card-actions">
                <button id="btnParseOrder" class="btn-parse-primary">
                  ${H.parse} <span>Tách Đơn Tự Động</span>
                </button>
                <button id="btnAiVerify" class="btn-ai-verify" type="button" title="Chạy AI đối soát & thẩm định nâng cao">
                  ✨ <span>Thẩm định AI</span>
                </button>
                <button id="btnClearOrder" class="btn-clear-secondary">
                  ${H.clear} <span>Xóa</span>
                </button>
              </div>
            </div>
            <button id="source-collapsed-preview" class="source-collapsed-preview" type="button" style="display:none;" aria-label="Mở nội dung đơn hàng gốc để đối chiếu và chỉnh sửa">
              <span id="source-preview-primary" class="source-preview-primary">Nội dung đơn hàng gốc</span>
              <span id="source-preview-address" class="source-preview-address">---</span>
              <span class="source-preview-hint"><span>Bấm để chỉnh sửa nội dung thô</span><span aria-hidden="true">→</span></span>
            </button>
          </div>

          <div id="panel-empty-state" class="panel-empty-state">
            <strong>Chưa có đơn hàng</strong>
            <span>Dán nội dung đơn hàng ở trên để bắt đầu xử lý.</span>
          </div>

          <!-- CẢNH BÁO TRÙNG ĐƠN TRONG NGÀY -->
          <div id="panel-duplicate-alert" class="panel-duplicate-alert" style="display:none;" role="alert">
            <div class="duplicate-alert-header">
              <span id="panel-duplicate-title" class="duplicate-alert-title">
                <svg class="duplicate-alert-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span>ĐƠN ĐÃ LÊN TRONG NGÀY</span>
              </span>
              <span class="duplicate-alert-header-right">
                <span id="panel-duplicate-time" class="duplicate-alert-time">Hôm nay</span>
                <button type="button" id="btn-close-duplicate-alert" class="duplicate-alert-close" title="Đóng cảnh báo trùng đơn">✕</button>
              </span>
            </div>
            <div id="panel-duplicate-message" class="duplicate-alert-message"></div>
            <div id="panel-duplicate-details" class="duplicate-alert-details"></div>
          </div>

          <div id="panel-validation-error" class="panel-validation-error" hidden>
            <strong>⚠ CẦN KIỂM TRA</strong>
            <div id="panel-validation-checklist"></div>
            <p id="panel-validation-message"></p>
            <button id="panel-fix-information" type="button">Sửa thông tin</button>
          </div>

          <!-- REVIEW BENTO PANEL (V2 DECISION-FIRST) -->
          <div id="review-panel">
            <div class="review-header-v2">
              <span class="review-section-title">⚡ Dữ liệu đã bóc tách</span>
              <span id="rev-ai-confidence" class="ai-confidence-badge" style="display:none;"></span>
              <span class="review-edit-badge">✏️ Bấm để sửa nhanh</span>
            </div>

            <div class="bento-grid-v2">
              <div class="bento-cell">
                <span class="bento-label" id="rev-customer-label">${H.user} Khách hàng <span id="rev-customer-order-count" class="customer-order-count-badge" style="display:none; background:#dbeafe; color:#0284c7; padding:0.5px 6px; border-radius:10px; font-weight:700; font-size:10.5px; margin-left:3px;">(0)</span></span>
                <span id="rev-name" class="bento-val review-editable" contenteditable="true" title="Bấm để sửa">---</span>
              </div>

              <div class="bento-cell">
                <div class="bento-label-row">
                  <span class="bento-label">${H.phone} Điện thoại</span>
                  <button class="copy-btn mini-copy" data-copy="rev-phone" title="Sao chép SĐT">${H.copy}</button>
                </div>
                <span id="rev-phone" class="bento-val review-editable" contenteditable="true" title="Bấm để sửa">---</span>
              </div>

              <div class="bento-cell">
                <span class="bento-label">${H.orderCode} Mã đơn</span>
                <span id="rev-code" class="bento-val review-editable" contenteditable="true" title="Bấm để sửa">---</span>
              </div>

              <div class="bento-cell">
                <span class="bento-label">${H.fee} Thu cước</span>
                <span id="rev-fee" class="bento-val fee-status fee-status--no">KHÔNG</span>
              </div>
            </div>

            <div class="cod-primary-card">
              <div class="cod-card-left">
                <span class="cod-card-label">💰 TIỀN THU HỘ (COD)</span>
                <span id="rev-cod-status" class="cod-status-badge">✓ Hợp lệ</span>
              </div>
              <div class="cod-card-right">
                <span id="rev-cod" class="cod-primary-val review-editable" contenteditable="true" title="Bấm để chỉnh sửa tiền COD">0 đ</span>
              </div>
            </div>

            <div class="address-engine-card">
              <div class="address-engine-header">
                <div class="address-title-group">
                  <span class="address-engine-title">📍 ĐỊA CHỈ GIAO HÀNG</span>
                  <span id="address-status-badge" class="address-verified-badge">✓ Đã tối ưu</span>
                </div>
                <button class="copy-btn" data-copy="rev-address" title="Sao chép địa chỉ">${H.copy}</button>
              </div>

              <div class="address-main-box">
                <span id="rev-address" class="address-text-main review-editable" contenteditable="true" title="Bấm để chỉnh sửa trực tiếp">---</span>
              </div>

              <details id="address-reference-disclosure" class="address-reference-disclosure">
                <summary>
                  <span class="address-reference-title">Gợi ý tham khảo để đối chiếu</span>
                  <span id="address-reference-status" class="address-reference-status">Đã bóc tách</span>
                </summary>
                <div id="address-reference-box" class="address-reference-box" aria-live="polite">
                <button class="address-reference-option" data-address-format="clean" type="button" title="Áp dụng địa chỉ 3 cấp đầy đủ">
                  <span class="address-reference-label">✨ 3 Cấp đầy đủ</span>
                  <span id="rev-suggest-clean" class="address-reference-value">---</span>
                </button>
                <button class="address-reference-option" data-address-format="2level" type="button" title="Áp dụng địa chỉ 2 cấp mới">
                  <span class="address-reference-label">🎯 2 Cấp mới</span>
                  <span id="rev-suggest-2level" class="address-reference-value">---</span>
                </button>
                  <span class="address-reference-help">Bấm vào gợi ý nếu muốn thay địa chỉ giao hàng.</span>
                </div>
              </details>

              <div class="address-format-bar">
                <span class="format-bar-label">Đổi chuẩn:</span>
                <button id="btn-switch-clean" class="format-pill-btn active" title="Dùng địa chỉ đầy đủ 3 cấp">✨ 3 Cấp đầy đủ</button>
                <button id="btn-switch-2level" class="format-pill-btn" title="Dùng địa chỉ quy đổi 2 cấp">🎯 2 Cấp mới</button>
              </div>

              <div class="address-accordion">
                <button id="address-accordion-btn" class="accordion-toggle-btn" type="button">
                  <span>⚙ Chi tiết chuẩn hóa địa giới</span>
                  <span id="accordion-arrow" class="accordion-arrow">▾</span>
                </button>
                <div id="address-accordion-content" class="accordion-content" style="display: none;">
                  <div id="ai-merger-notice" style="display: none;"></div>
                  <div class="accordion-detail-row">
                    <span class="acc-label">Địa chỉ gốc:</span>
                    <span id="rev-raw-address" class="acc-val">---</span>
                  </div>
                  <div class="accordion-detail-grid">
                    <div class="acc-grid-item">
                      <span class="acc-sublabel">Phường/Xã:</span>
                      <span id="rev-addr-ward" class="acc-subval">---</span>
                    </div>
                    <div class="acc-grid-item">
                      <span class="acc-sublabel">Quận/Huyện:</span>
                      <span id="rev-addr-district" class="acc-subval">---</span>
                    </div>
                    <div class="acc-grid-item acc-full">
                      <span class="acc-sublabel">Tỉnh/TP:</span>
                      <span id="rev-addr-province" class="acc-subval">---</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section id="customer-history-card" class="customer-history-card" hidden>
            <div class="customer-history-heading">
              <div class="customer-history-title-wrap">
                <span class="customer-history-icon">🕒</span>
                <strong>Lịch sử khách hàng</strong>
                <span id="customer-history-count" class="customer-history-count-badge" title="Số đơn đã lên" aria-label="Số đơn đã lên" hidden></span>
              </div>
              <button id="customer-history-search-toggle" type="button" class="customer-history-toggle-btn" title="Tìm kiếm theo SĐT khác">🔍</button>
            </div>
            <div id="customer-history-search-row" class="customer-history-search-row" style="display: none;">
              <input id="customer-history-search" type="search" placeholder="Nhập tên hoặc SĐT khách hàng khác..." autocomplete="off">
              <button id="customer-history-search-btn" type="button">Tìm</button>
            </div>
            <div id="customer-history-result" class="customer-history-result">Đang cập nhật lịch sử khách hàng...</div>
          </section>
        </div>

        <div id="panel-sticky-footer" class="panel-sticky-footer">
          <div id="order-readiness-bar" class="order-readiness-bar readiness-idle">
            <span class="readiness-dot"></span>
            <span id="readiness-text" class="readiness-text">⚪ Chờ bóc tách nội dung đơn</span>
          </div>
          <div class="panel-bottom-actions">
            <button id="btnFillVNPost" class="btn-fill btn-fill-vnpost" style="${K};" disabled>
              ${H.fill} <span>Nhập đơn</span>
            </button>
            <button id="btnFillJT" class="btn-fill btn-fill-jt" style="${pe};" disabled>
              ${H.fill} <span>Nhập đơn</span>
            </button>
            <button id="btnAiVerifyBottom" class="btn-fill btn-ai-verify" type="button" title="Chạy AI đối soát & thẩm định nâng cao" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); flex: 1;">
              ✨ <span>Thẩm định AI</span>
            </button>
            <button id="btnSaveOrder" class="btn-fill btn-save-order" disabled>
              ${H.save} <span>Lưu đơn</span>
            </button>
          </div>
          <div id="gemini-progress-container" aria-label="Tiến trình bóc tách đơn hàng">
            <span id="ai-status" hidden>Đang xử lý</span><span id="ai-percent" hidden>0%</span>
            <span id="parse-step-customer" hidden></span><span id="parse-step-phone" hidden></span>
            <span id="parse-step-cod" hidden></span><span id="parse-step-address" hidden></span>
            <div class="progress-bar-bg"><div id="gemini-progress-bar"></div></div>
          </div>
        </div>
      `,n.appendChild(L);const xe=n.querySelector("#vnpost-dock-toggle-tab");xe&&xe.remove();const u=document.createElement("div");u.id="vnpost-dock-toggle-tab",u.textContent="AUTO FILL",u.title="Mở bảng Auto Fill",u.style.setProperty("--theme-color",X),n.appendChild(u);const M=n.getElementById("vnpost-panel-header-text");M&&(M.textContent=C.title||"");let A="",z="";const G=()=>{try{const e=n.getElementById("panel-shop-name"),t=n.getElementById("panel-user-account"),o=n.getElementById("panel-carrier-account"),a=typeof globalThis.detectCarrierAccount=="function"?globalThis.detectCarrierAccount(C.id):"";if(e&&(z?(e.textContent=z,e.title=`Shop đang làm việc: ${z}`,e.classList.remove("context-missing")):(e.textContent="Chưa chọn Shop",e.title="Chưa xác định Shop đang làm việc",e.classList.add("context-missing"))),t){const O=A&&(A.includes("@")?A.split("@")[0]:A);t.textContent=O||"Chưa xác định tài khoản",t.title=O?`Tài khoản đăng nhập tiện ích: ${A}`:"Chưa xác định tài khoản đăng nhập Extension",t.classList.toggle("context-missing",!O)}o&&(o.textContent=a||"Chưa nhận diện tài khoản",o.title=a?`Tài khoản bưu điện trên ${C.title}: ${a}`:`Chưa nhận diện tài khoản bưu điện trên ${C.title}`,o.classList.toggle("context-missing",!a));const c=A&&(A.includes("@")?A.split("@")[0]:A),y=n.getElementById("panel-menu-user"),$=n.getElementById("panel-menu-carrier"),U=n.getElementById("panel-menu-shop");y&&(y.textContent=c||"Chưa xác định tài khoản"),$&&($.textContent=a||"Chưa nhận diện tài khoản bưu điện"),U&&(U.textContent=z||"Chưa chọn Shop")}catch{}},fe=()=>{try{typeof AuthSession<"u"&&typeof AuthSession.getSession=="function"&&AuthSession.getSession().then(t=>{var o,a,c;t&&(A=((o=t.user)==null?void 0:o.full_name)||((a=t.user)==null?void 0:a.username)||((c=t.user)==null?void 0:c.email)||"",z=t.shop_name||"",G())}).catch(()=>{});let e=!1;try{e=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}e&&chrome.storage&&chrome.storage.local&&chrome.storage.local.get(["vnpost_session","activeShopName","activeShop","currentUser"],t=>{var o,a,c;if(!(chrome.runtime&&chrome.runtime.lastError)&&t){const y=t.vnpost_session;!A&&y&&(A=((o=y.user)==null?void 0:o.full_name)||((a=y.user)==null?void 0:a.username)||((c=y.user)==null?void 0:c.email)||t.currentUser||""),z||(z=(y==null?void 0:y.shop_name)||t.activeShopName||(t.activeShop?typeof t.activeShop=="object"?t.activeShop.name:"Shop #"+t.activeShop:"")),G()}})}catch{}};fe(),setInterval(G,2500),setInterval(fe,4e3);try{typeof chrome<"u"&&chrome.runtime&&chrome.runtime.id&&chrome.storage&&chrome.storage.onChanged&&chrome.storage.onChanged.addListener((e,t)=>{t==="local"&&(e.vnpost_session||e.activeShopName||e.activeShop||e.currentUser)&&fe()})}catch{}Lt(L,n.getElementById("vnpost-panel-header"));const J=n.getElementById("vnpost-btn-dock-toggle");u.addEventListener("click",e=>{e.stopPropagation(),gt(L,u,J,"docked",{collapsed:!1}),Ke.set({panel_display_mode:"docked",panel_dock_collapsed:!1,panelMinimized:!1})}),Ke.get(["panel_display_mode","panel_dock_collapsed","panel_float_position","panelMinimized","antigravity_ui_theme"],(e={})=>{const t=e.panel_display_mode==="floating"?"floating":"docked",o=!!(e.panel_dock_collapsed||e.panel_display_mode===void 0&&e.panelMinimized);if(t==="floating"&&e.panelMinimized&&L.classList.add("minimized"),gt(L,u,J,t,{collapsed:o,position:e.panel_float_position}),e.antigravity_ui_theme!==void 0)if(e.antigravity_ui_theme==="dark"){L.classList.remove("light-mode");try{localStorage.setItem("antigravity_ui_theme","dark")}catch{}}else{L.classList.add("light-mode");try{localStorage.setItem("antigravity_ui_theme","light")}catch{}}}),n.getElementById("btnParseOrder").addEventListener("click",s);const j=n.getElementById("btnAiVerify");j&&j.addEventListener("click",()=>{typeof globalThis.handleAiVerifyManual=="function"&&globalThis.handleAiVerifyManual()});const Q=n.getElementById("btnAiVerifyBottom");Q&&Q.addEventListener("click",()=>{typeof globalThis.handleAiVerifyManual=="function"&&globalThis.handleAiVerifyManual()}),n.getElementById("btnClearOrder").addEventListener("click",d),n.getElementById("btnFillVNPost").addEventListener("click",function(){l("vnpost")}),n.getElementById("btnFillJT").addEventListener("click",function(){l("jt")});const Y=n.getElementById("panel-account-trigger"),m=n.getElementById("panel-account-menu"),x=()=>{!m||!Y||(m.hidden=!0,Y.setAttribute("aria-expanded","false"))};Y==null||Y.addEventListener("click",e=>{e.stopPropagation(),m.hidden=!m.hidden,Y.setAttribute("aria-expanded",String(!m.hidden))}),(I=n.getElementById("panel-menu-settings"))==null||I.addEventListener("click",()=>{x(),typeof g=="function"&&g()}),(r=n.getElementById("panel-menu-logout"))==null||r.addEventListener("click",async()=>{x(),typeof AuthService<"u"&&typeof AuthService.logout=="function"&&(await AuthService.logout(),typeof globalThis.checkUrlAndInject=="function"&&globalThis.checkUrlAndInject())}),document.addEventListener("pointerdown",x),(h=n.getElementById("panel-fix-information"))==null||h.addEventListener("click",()=>{var e;(e=n.querySelector(".review-editable.is-invalid"))==null||e.focus()});const ie=e=>String(e||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim(),oe=async e=>{if(typeof AuthSession>"u"||typeof AuthSession.getSession!="function"||typeof SupabaseCloud>"u")return null;const t=await AuthSession.getSession().catch(()=>null),o=await SupabaseCloud.loadConfig().catch(()=>null);if(!(t!=null&&t.active_shop_id)||!(t!=null&&t.access_token)||!(o!=null&&o.url)||!(o!=null&&o.anonKey))return null;const a=String(e||"").replace(/\D/g,"").replace(/^84(?=\d{9}$)/,"0");if(a.length<9)return null;const c={apikey:o.anonKey,Authorization:`Bearer ${t.access_token}`},y=`${String(o.url).replace(/\/$/,"")}/rest/v1`,$=new AbortController,U=setTimeout(()=>$.abort(),1200);try{const O=await fetch(`${y}/rpc/customer_hub_lookup`,{method:"POST",headers:{...c,"Content-Type":"application/json"},body:JSON.stringify({p_shop_id:t.active_shop_id,p_phone:a}),signal:$.signal});if(!O.ok)return null;const R=await O.json();if(!R)return{customer:null,orders:[],addresses:[]};const[ce,be]=await Promise.all([fetch(`${y}/customer_order_links?shop_id=eq.${encodeURIComponent(t.active_shop_id)}&customer_id=eq.${R.id}&order=ordered_at.desc&limit=5&select=*`,{headers:c,signal:$.signal}),fetch(`${y}/customer_addresses?shop_id=eq.${encodeURIComponent(t.active_shop_id)}&customer_id=eq.${R.id}&order=successful_delivery_count.desc,last_used_at.desc&limit=3&select=*`,{headers:c,signal:$.signal})]);return{customer:R,orders:ce.ok?await ce.json():[],addresses:be.ok?await be.json():[]}}catch{return null}finally{clearTimeout(U)}},ye=e=>{const t=n.getElementById("rev-customer-order-count");if(!t)return;const o=parseInt(e,10)||0;o>0?(t.textContent=`(${o})`,t.style.display="inline-flex",t.title=`Khách hàng này đã từng lên ${o} đơn hàng thành công`):(t.style.display="none",t.textContent="")};globalThis.setPanelCustomerOrderCountBadge=ye;const Ne=e=>{if(!e)return"---";try{const t=new Date(e);if(isNaN(t.getTime()))return String(e);const o=new Date,a=t.toDateString()===o.toDateString(),c=String(t.getHours()).padStart(2,"0"),y=String(t.getMinutes()).padStart(2,"0"),$=`${c}:${y}`,U=String(t.getDate()).padStart(2,"0"),O=String(t.getMonth()+1).padStart(2,"0"),R=t.getFullYear();return a?`Hôm nay ${$}`:`${$} · ${U}/${O}/${R}`}catch{return String(e)}},Be=e=>{if(!e)return"Chưa rõ thời gian";try{const t=new Date(e);if(isNaN(t.getTime()))return String(e);const o=String(t.getHours()).padStart(2,"0"),a=String(t.getMinutes()).padStart(2,"0"),c=String(t.getSeconds()).padStart(2,"0"),y=String(t.getDate()).padStart(2,"0"),$=String(t.getMonth()+1).padStart(2,"0"),U=t.getFullYear();return`${o}:${a}:${c} ngày ${y}/${$}/${U}`}catch{return String(e)}},me=async e=>{var an;const t=n.getElementById("customer-history-card"),o=n.getElementById("customer-history-result"),a=n.getElementById("customer-history-count");if(!t||!o)return;const c=String(e||"").trim();if(!c){t.hidden=!0,o.textContent="Chưa có thông tin khách hàng để xem lịch sử.",a&&(a.textContent="",a.hidden=!0),ye(0);return}t.hidden=!1,o.replaceChildren();const y=document.createElement("div");y.className="customer-history-loading",y.textContent="⏳ Đang tải lịch sử đơn hàng...",o.appendChild(y);const $=c.replace(/\D/g,""),U=ie(c),[O,R]=await Promise.all([oe(c).catch(()=>null),(async()=>{try{if(typeof OrderStorage<"u"){if(typeof OrderStorage._getSubmittedOrdersFromLocal=="function"){const S=await OrderStorage._getSubmittedOrdersFromLocal().catch(()=>[]);if(Array.isArray(S)&&S.length>0)return S}if(typeof OrderStorage.getSubmittedOrders=="function")return await OrderStorage.getSubmittedOrders().catch(()=>[])}}catch{}return[]})()]),ce=(R||[]).filter(S=>{if(!S)return!1;const re=String(S.phone||"").replace(/\D/g,""),F=ie(S.name||S.customer_name||"");return $.length>=7?re===$||re.endsWith($)||$.endsWith(re):U.length>=2&&(F.includes(U)||U.includes(F))}),be=[],nt=new Set,Ee=S=>{var we,Re,ct;if(!S)return;const re=String(S.orderCode||S.order_code||S.source_order_id||"").trim(),F=String(S.trackingCode||S.tracking_code||"").trim(),Te=String(S.id||"").trim(),le=F||re||Te;if(le&&nt.has(le))return;le&&nt.add(le);const ke=S.submittedAt||S.submitted_at||S.ordered_at||S.createdAt||S.created_at||null,ot=Number(S.codAmount??S.cod_amount??S.cod??0),at=String(S.name||S.customer_name||((we=O==null?void 0:O.customer)==null?void 0:we.name)||"").trim(),je=String(S.phone||((Re=O==null?void 0:O.customer)==null?void 0:Re.normalized_phone)||((ct=O==null?void 0:O.customer)==null?void 0:ct.phone)||"").trim(),dt=String(S.address||S.raw_address||"").trim(),Pe=String(S.carrier||S.platform||"").trim(),Ge=String(S.status||"success").trim(),Et=String(S.goods||S.productItem||S.product||S.items||"").trim(),De=String(S.note||S.extraNote||S.notes||"").trim();be.push({id:Te,orderCode:re,trackingCode:F,name:at,phone:je,address:dt,codAmount:ot,carrier:Pe,status:Ge,submittedAt:ke,goods:Et,note:De})};ce.forEach(Ee),((O==null?void 0:O.orders)||[]).forEach(Ee),be.sort((S,re)=>{const F=S.submittedAt?new Date(S.submittedAt).getTime():0;return(re.submittedAt?new Date(re.submittedAt).getTime():0)-F});const W=(O==null?void 0:O.customer)||null,Ie=Math.max(Number((W==null?void 0:W.total_orders)||0),be.length);a&&(a.textContent=`${Ie} đơn`,a.hidden=Ie===0,a.setAttribute("aria-label",`${Ie} đơn đã lên`)),ye(Ie),o.replaceChildren();const Je=document.createElement("div");Je.className="customer-history-profile";const ge=document.createElement("div");ge.className="customer-history-name-row";const it=(W==null?void 0:W.name)||ce[0]&&(ce[0].name||ce[0].customer_name)||c,_t=(W==null?void 0:W.normalized_phone)||(W==null?void 0:W.phone)||$||"";ge.innerHTML=`<strong>${de(it)}</strong>${_t?`<span class="customer-history-phone"> · ${de(_t)}</span>`:""}`,Je.appendChild(ge);const Mt=document.createElement("div");Mt.className=`customer-history-summary risk-${(W==null?void 0:W.risk_level)||"safe"}`;const hn={vip:"VIP",repeat:"Khách quen",churn_risk:"Ngủ đông",risk:"Cần kiểm tra",new:"Khách mới"},gn=(W==null?void 0:W.segment)||(Ie>=5?"vip":Ie>=2?"repeat":"new"),fn=Number((W==null?void 0:W.total_spent)||(W==null?void 0:W.total_cod)||be.reduce((S,re)=>S+(re.codAmount||0),0));if(Mt.textContent=`${hn[gn]||"Khách hàng"} · LTV ${fn.toLocaleString("vi-VN")} đ${W!=null&&W.is_blacklisted?` · ⚠️ CẢNH BÁO: ${W.blacklist_reason||"Danh sách đen"}`:""}`,Je.appendChild(Mt),o.appendChild(Je),be.length>0){const S=document.createElement("div");S.className="customer-history-subheading",S.innerHTML=`<span>Đơn đã lên (${be.length}) — Bấm vào để xem chi tiết:</span>`,o.appendChild(S);const re=document.createElement("div");re.className="customer-history-orders",be.slice(0,10).forEach((F,Te)=>{const le=document.createElement("div");le.className="customer-history-order is-clickable",le.setAttribute("tabindex","0"),le.setAttribute("role","button"),le.setAttribute("aria-expanded","false");const ke=F.orderCode||F.trackingCode||`Đơn #${Te+1}`,ot=Ne(F.submittedAt),at=Number(F.codAmount||0).toLocaleString("vi-VN")+" đ",je=(F.carrier||"").toUpperCase(),dt=document.createElement("div");dt.className="customer-history-order-summary",dt.innerHTML=`
              <div class="customer-history-order-left">
                <div class="customer-history-order-code">
                  <span class="order-code-title">Mã: ${de(ke)}</span>
                  ${F.trackingCode&&F.trackingCode!==F.orderCode?`<span class="order-tracking-pill" title="Mã vận đơn">${de(F.trackingCode)}</span>`:""}
                </div>
                <div class="customer-history-order-meta">
                  ${je?`<span class="order-carrier-badge carrier-${je.toLowerCase()}">${de(je)}</span>`:""}
                  <span class="order-time-badge" title="Thời gian lên đơn">🕒 ${de(ot)}</span>
                </div>
              </div>
              <div class="customer-history-order-right">
                <span class="customer-history-order-cod" title="Tiền COD">${de(at)}</span>
                <span class="customer-history-chevron">▾</span>
              </div>
            `;const Pe=document.createElement("div");Pe.className="customer-history-order-details",Pe.style.display="none";let Ge="";(F.name||F.phone)&&(Ge+=`
                <div class="history-detail-row">
                  <span class="history-detail-label">👤 Khách:</span>
                  <span class="history-detail-val"><strong>${de(F.name||"Người nhận")}</strong> ${F.phone?`(${de(F.phone)})`:""}</span>
                </div>`),F.address&&(Ge+=`
                <div class="history-detail-row history-detail-addr-row">
                  <span class="history-detail-label">📍 Địa chỉ:</span>
                  <div class="history-detail-addr-wrap">
                    <span class="history-detail-val">${de(F.address)}</span>
                    <button type="button" class="btn-history-apply-addr" title="Điền địa chỉ này vào đơn hiện tại">
                      ✨ Áp dụng địa chỉ này
                    </button>
                  </div>
                </div>`),F.goods&&(Ge+=`
                <div class="history-detail-row">
                  <span class="history-detail-label">📦 Hàng:</span>
                  <span class="history-detail-val">${de(F.goods)}</span>
                </div>`),F.note&&(Ge+=`
                <div class="history-detail-row">
                  <span class="history-detail-label">📝 Ghi chú:</span>
                  <span class="history-detail-val">${de(F.note)}</span>
                </div>`),Ge+=`
              <div class="history-detail-row history-detail-timing">
                <span class="history-detail-label">⏰ Ngày giờ:</span>
                <span class="history-detail-val">${de(Be(F.submittedAt))}</span>
              </div>`,Pe.innerHTML=Ge;const Et=Pe.querySelector(".btn-history-apply-addr");Et&&F.address&&Et.addEventListener("click",De=>{var sn;De.stopPropagation();let we=F.address;typeof AddressSanitizer<"u"&&typeof AddressSanitizer.deduplicate=="function"&&(we=AddressSanitizer.deduplicate(we));const Re=n.getElementById("rev-address"),ct=n.getElementById("rev-raw-address");Re&&(Re.textContent=we),ct&&(ct.textContent=we),globalThis.parsedDataStore&&(globalThis.parsedDataStore.address=we),typeof refreshAddressSuggestion=="function"&&refreshAddressSuggestion(we,((sn=globalThis.parsedDataStore)==null?void 0:sn.phone)||""),typeof showVnpostToast=="function"&&showVnpostToast(`✨ Đã áp dụng địa chỉ từ đơn trước (${ke})!`,"success")}),le.addEventListener("click",De=>{if(De.target.closest(".btn-history-apply-addr"))return;const we=Pe.style.display!=="none";Pe.style.display=we?"none":"grid",le.classList.toggle("is-expanded",!we),le.setAttribute("aria-expanded",String(!we));const Re=le.querySelector(".customer-history-chevron");Re&&(Re.textContent=we?"▾":"▴")}),le.addEventListener("keydown",De=>{(De.key==="Enter"||De.key===" ")&&(De.preventDefault(),le.click())}),le.append(dt,Pe),re.appendChild(le)}),o.appendChild(re)}else{const S=document.createElement("div");S.className="customer-history-no-orders",S.textContent="Chưa tìm thấy đơn hàng nào đã từng lên của khách hàng này.",o.appendChild(S)}if((an=O==null?void 0:O.addresses)!=null&&an.length){const S=document.createElement("div");S.className="customer-history-addresses";const re=document.createElement("span");re.className="customer-history-address-title",re.textContent="Địa chỉ từng giao — bấm để áp dụng",S.appendChild(re),O.addresses.forEach(F=>{const Te=document.createElement("button");Te.type="button",Te.className="customer-history-address-option",Te.textContent=`${F.raw_address} · ${F.use_count||1} lần`,Te.addEventListener("click",le=>{var je;le.stopPropagation();let ke=F.raw_address||F.normalized_address;if(!ke)return;typeof AddressSanitizer<"u"&&typeof AddressSanitizer.deduplicate=="function"&&(ke=AddressSanitizer.deduplicate(ke));const ot=n.getElementById("rev-address"),at=n.getElementById("rev-raw-address");ot&&(ot.textContent=ke),at&&(at.textContent=ke),globalThis.parsedDataStore&&(globalThis.parsedDataStore.address=ke),typeof refreshAddressSuggestion=="function"&&refreshAddressSuggestion(ke,((je=globalThis.parsedDataStore)==null?void 0:je.phone)||""),typeof showVnpostToast=="function"&&showVnpostToast("Đã áp dụng địa chỉ lịch sử theo lựa chọn của bạn.","success")}),S.appendChild(Te)}),o.appendChild(S)}};globalThis.lookupPanelCustomerHistory=me;const ee=n.getElementById("customer-history-search"),Se=n.getElementById("customer-history-search-row"),st=n.getElementById("customer-history-search-toggle");st==null||st.addEventListener("click",e=>{if(e.stopPropagation(),!Se)return;const t=Se.style.display==="none";Se.style.display=t?"grid":"none",t&&ee&&ee.focus()}),(q=n.getElementById("customer-history-search-btn"))==null||q.addEventListener("click",()=>me(ee==null?void 0:ee.value)),ee==null||ee.addEventListener("keydown",e=>{e.key==="Enter"&&(e.preventDefault(),me(ee.value))});const Me=n.getElementById("address-accordion-btn"),et=n.getElementById("address-accordion-content");Me&&et&&Me.addEventListener("click",e=>{e.stopPropagation();const t=et.style.display!=="none";et.style.display=t?"none":"flex",Me.classList.toggle("open",!t)});const Ue=n.getElementById("btn-switch-clean"),Ve=n.getElementById("btn-switch-2level"),He=e=>{const t=e?"rev-suggest-2level":"rev-suggest-clean",o=n.getElementById(t),a=o?o.textContent.trim():"";if(a&&typeof T=="function"){T(a),Ue&&Ve&&(Ue.classList.toggle("active",!e),Ve.classList.toggle("active",e));const c=n.getElementById("address-reference-disclosure")||n.querySelector(".address-reference-disclosure");c&&(c.style.display=e?"none":"");const y=n.getElementById("address-status-badge");y&&(y.textContent=e?"🎯 Địa chỉ 2 Cấp":"✓ Đã tối ưu",y.title=e?"Địa chỉ được nhận diện theo chuẩn 2 cấp (không chèn quận).":"Địa chỉ chuẩn hóa 3 cấp đầy đủ."),showVnpostToast(e?"🎯 Đã áp dụng địa chỉ 2 cấp mới":"✨ Đã chọn địa chỉ 3 cấp đầy đủ","success")}};Ue&&Ue.addEventListener("click",e=>{e.stopPropagation(),He(!1)}),Ve&&Ve.addEventListener("click",e=>{e.stopPropagation(),He(!0)}),n.querySelectorAll(".address-reference-option").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation(),He(e.dataset.addressFormat==="2level")})}),n.querySelectorAll(".copy-btn").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation();const o=e.getAttribute("data-copy"),a=o?n.getElementById(o):null;if(a){const c=a.textContent.trim();c&&navigator.clipboard.writeText(c).then(()=>{const y=e.innerHTML;e.innerHTML=H.check,setTimeout(()=>{e.innerHTML=y},1500),showVnpostToast("📋 Đã sao chép: "+c.substring(0,40)+(c.length>40?"...":""),"success")}).catch(()=>{showVnpostToast("❌ Không thể sao chép","error")})}})}),typeof E=="function"&&n.getElementById("btnSaveOrder").addEventListener("click",E),typeof g=="function"&&n.getElementById("vnpost-btn-settings").addEventListener("click",g),J&&J.addEventListener("click",e=>{e.stopPropagation();const t=L.classList.contains("panel-docked")?"floating":"docked",o=t==="floating"?{top:Math.max(20,L.offsetTop||20),left:Math.max(20,window.innerWidth-400)}:null;gt(L,u,J,t,{collapsed:!1,position:o}),Ke.set({panel_display_mode:t,panel_dock_collapsed:!1,panelMinimized:!1,...o?{panel_float_position:o}:{}})});const qe=n.getElementById("vnpost-btn-theme");qe&&qe.addEventListener("click",e=>{e.stopPropagation();const t=L.classList.toggle("light-mode");Nt(t),showVnpostToast(t?"☀️ Đã chuyển sang giao diện Sáng":"🌙 Đã chuyển sang giao diện Tối","success")});const D=n.getElementById("rawOrderText"),ve=n.getElementById("vnpost-draft-queue"),_e=n.getElementById("draft-queue-badge"),ne=n.getElementById("draft-queue-mini-summary"),We=n.getElementById("btn-draft-queue-toggle-collapse"),$e=n.getElementById("draft-current-index"),mt=n.getElementById("draft-current-summary"),Ce=n.getElementById("btn-draft-prev"),Le=n.getElementById("btn-draft-next"),Gt=n.getElementById("btn-draft-load"),Rt=n.getElementById("btn-draft-fill-next"),Kt=n.getElementById("btn-draft-delete"),Ut=n.getElementById("btn-draft-clear-all"),Wt=n.getElementById("btn-draft-queue-clear");let Z=[],se=0,ue=!1,It=-1;async function ze(){var e,t,o,a;if(ve)try{let c=!0;try{if(typeof chrome<"u"&&((e=chrome.storage)!=null&&e.local)){const R=await new Promise(ce=>chrome.storage.local.get(["draft_queue_enabled","draft_queue_collapsed"],ce));R&&R.draft_queue_enabled!==void 0&&(c=!!R.draft_queue_enabled),R&&R.draft_queue_collapsed!==void 0&&(ue=!!R.draft_queue_collapsed)}else{const R=localStorage.getItem("draft_queue_enabled");R!==null&&(c=R==="true");const ce=localStorage.getItem("draft_queue_collapsed");ce!==null&&(ue=ce==="true")}}catch{}if(typeof OrderStorage>"u"||typeof OrderStorage.getOrders!="function")return;typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),Z=(await OrderStorage.getOrders()||[]).filter(R=>R&&!R.submittedAt&&!R.trackingCode&&!R.tracking_code);const $=n.getElementById("header-draft-count-badge"),U=n.getElementById("vnpost-btn-toggle-draft-queue");if($&&(Z.length>0?($.textContent=String(Z.length),$.style.display="inline-flex",$.classList.add("has-drafts-pulse"),U&&(U.classList.add("has-drafts-active"),U.title=`Hàng đợi có ${Z.length} đơn nháp sẵn sàng lên đơn`)):($.style.display="none",$.classList.remove("has-drafts-pulse"),U&&(U.classList.remove("has-drafts-active"),U.title="Bật / Tắt Hàng đợi đơn nháp"))),Z.length===0){ve.style.display="none",_e&&(_e.textContent="0 đơn"),se=0,It=0,(t=globalThis.parsedDataStore)!=null&&t.savedOrderId&&(globalThis.parsedDataStore=null,D&&(D.value=""),typeof globalThis.resetSourceOrderCard=="function"&&globalThis.resetSourceOrderCard());return}if(It!==Z.length&&(It=Z.length,typeof showVnpostToast=="function"&&showVnpostToast(`📥 Hàng đợi: Có ${Z.length} đơn nháp sẵn sàng lên đơn!`,"info")),!c){c=!0;try{typeof chrome<"u"&&((o=chrome.storage)!=null&&o.local)&&chrome.storage.local.set({draft_queue_enabled:!0}),localStorage.setItem("draft_queue_enabled","true")}catch{}}se>=Z.length&&(se=Math.max(0,Z.length-1)),ve.style.display="flex",_e&&(_e.textContent=`${Z.length} đơn`);const O=(a=globalThis.parsedDataStore)==null?void 0:a.savedOrderId;O&&!Z.some(R=>R.id===O)&&Xe(),lt(),rt()}catch(c){console.warn("refreshDraftQueue error",c)}}Ce&&Ce.addEventListener("click",e=>{e.stopPropagation(),se>0&&(se--,lt(),Xe())}),Le&&Le.addEventListener("click",e=>{e.stopPropagation(),se<Z.length-1&&(se++,lt(),Xe())}),Gt&&Gt.addEventListener("click",e=>{e.stopPropagation(),Xe()}),Rt&&Rt.addEventListener("click",e=>{e.stopPropagation(),Xe();const o=(C.id||"vnpost")==="vnpost"?n.getElementById("btnFillVNPost"):n.getElementById("btnFillJT");o&&!o.disabled&&(o.click(),showVnpostToast(`⚡ Đang điền đơn ${se+1}...`,"info"),se<Z.length-1&&setTimeout(()=>{se++,lt(),Xe()},1200))}),Kt&&Kt.addEventListener("click",async e=>{var o;if(e.stopPropagation(),!Z.length)return;const t=Z[se];if(t&&confirm(`Xóa đơn nháp của "${t.name||t.phone||"khách này"}" khỏi hàng đợi?`))try{if(typeof OrderStorage<"u"&&typeof OrderStorage.deleteOrder=="function"){await OrderStorage.deleteOrder(t.id),typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),showVnpostToast("🗑️ Đã xóa 1 đơn khỏi hàng đợi.","success");try{typeof chrome<"u"&&((o=chrome.runtime)!=null&&o.sendMessage)&&chrome.runtime.sendMessage({action:"draftOrdersUpdated",source:"panel"},()=>{chrome.runtime.lastError}),window.dispatchEvent(new CustomEvent("draft-queue-updated"))}catch{}await ze()}}catch(a){showVnpostToast("Lỗi khi xóa đơn: "+a.message,"error")}}),Ut&&Ut.addEventListener("click",async e=>{var o;if(e.stopPropagation(),!Z.length)return;const t=Z.length;if(confirm(`Bạn có chắc muốn xóa sạch toàn bộ ${t} đơn nháp khỏi hàng đợi?`))try{if(typeof OrderStorage<"u"){const a=Z.map(c=>c.id).filter(Boolean);if(typeof OrderStorage.deleteBulkOrders=="function")await OrderStorage.deleteBulkOrders(a);else if(typeof OrderStorage.deleteOrder=="function")for(const c of a)await OrderStorage.deleteOrder(c);typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),showVnpostToast(`🧹 Đã dọn sạch ${t} đơn nháp khỏi hàng đợi!`,"success");try{typeof chrome<"u"&&((o=chrome.runtime)!=null&&o.sendMessage)&&chrome.runtime.sendMessage({action:"draftOrdersUpdated",source:"panel"},()=>{chrome.runtime.lastError}),window.dispatchEvent(new CustomEvent("draft-queue-updated"))}catch{}await ze()}}catch(a){showVnpostToast("Lỗi khi dọn hàng đợi: "+a.message,"error")}}),We&&We.addEventListener("click",async e=>{var t;e.stopPropagation(),ue=!ue,rt();try{typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local)&&await chrome.storage.local.set({draft_queue_collapsed:ue});try{localStorage.setItem("draft_queue_collapsed",String(ue))}catch{}}catch{}}),Wt&&Wt.addEventListener("click",async e=>{var t;e.stopPropagation();try{typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local)&&await chrome.storage.local.set({draft_queue_enabled:!1});try{localStorage.setItem("draft_queue_enabled","false")}catch{}}catch{}ve.style.display="none",showVnpostToast("Đã ẩn Hàng đợi đơn nháp. Bấm biểu tượng 📥 trên thanh tiêu đề để bật lại.","info")});const Xt=n.getElementById("vnpost-btn-toggle-draft-queue");Xt&&Xt.addEventListener("click",async e=>{var t,o;e.stopPropagation();try{if(ve.style.display==="none"){typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local)&&await chrome.storage.local.set({draft_queue_enabled:!0,draft_queue_collapsed:!1});try{localStorage.setItem("draft_queue_enabled","true"),localStorage.setItem("draft_queue_collapsed","false")}catch{}ue=!1,showVnpostToast("✅ Đã BẬT Hàng đợi đơn nháp","info"),await ze()}else{ue=!ue,rt(),typeof chrome<"u"&&((o=chrome.storage)!=null&&o.local)&&await chrome.storage.local.set({draft_queue_collapsed:ue});try{localStorage.setItem("draft_queue_collapsed",String(ue))}catch{}showVnpostToast(ue?"▾ Đã thu gọn hàng đợi":"▴ Đã mở rộng hàng đợi","info")}}catch(a){console.warn("Lỗi toggle draft queue",a)}}),typeof chrome<"u"&&chrome.storage&&chrome.storage.onChanged&&chrome.storage.onChanged.addListener((e,t)=>{t==="local"&&Object.keys(e).some(a=>a.includes("savedOrders")||a.includes("orders")||a.includes("draft")||a==="vnpost_orders"||a==="draft_queue_updated_at"||a==="draft_queue_enabled"||a==="draft_queue_collapsed")&&(typeof OrderStorage<"u"&&typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),ze())}),window.addEventListener("storage",e=>{e.key&&(e.key.includes("savedOrders")||e.key.includes("orders")||e.key.includes("draft")||e.key==="draft_queue_enabled"||e.key==="draft_queue_collapsed")&&(typeof OrderStorage<"u"&&typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),ze())}),window.addEventListener("draft-queue-updated",()=>{typeof OrderStorage<"u"&&typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),ze()}),typeof chrome<"u"&&chrome.runtime&&chrome.runtime.onMessage&&chrome.runtime.onMessage.addListener(e=>{e&&(e.action==="draftOrdersUpdated"||e.action==="ordersUpdated"||e.action==="refreshDraftQueue")&&(typeof OrderStorage<"u"&&typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),ze())}),setTimeout(ze,500);const he=n.getElementById("source-order-card"),yt=n.getElementById("source-expanded-content"),Qe=n.getElementById("source-collapsed-preview"),Qt=n.getElementById("source-preview-primary"),vt=n.getElementById("source-preview-address"),Zt=n.getElementById("source-dirty-badge"),Jt=n.getElementById("source-dirty-message"),Ze=n.getElementById("btn-edit-source");let bt=!1,Yt=!1,At=!1,Bt={};const $t=e=>{Yt=e,he==null||he.classList.toggle("source-dirty",e),Zt&&(Zt.style.display=e?"inline-flex":"none"),Jt&&(Jt.style.display=e?"block":"none");const t=n.querySelector("#btnParseOrder span");t&&(t.textContent=e?"Bóc tách lại":"Tách Đơn Tự Động")},wt=()=>{yt&&(yt.style.display="block"),Qe&&(Qe.style.display="none"),Ze&&(Ze.style.display="none"),he&&(he.classList.remove("is-collapsed"),he.setAttribute("aria-expanded","true"));const e=n.getElementById("panel-duplicate-alert");e&&(e.style.display="none"),window.setTimeout(()=>D==null?void 0:D.focus(),0)},en=(e={})=>{Bt=e;const t=(D==null?void 0:D.value.trim())||"";Qt&&(Qt.textContent="Nội dung đơn hàng gốc"),vt&&(vt.textContent=t||"Chưa có nội dung"),yt&&(yt.style.display="none"),Qe&&(Qe.style.display="flex"),Ze&&(Ze.style.display="inline-flex"),he&&(he.classList.add("is-collapsed"),he.setAttribute("aria-expanded","false")),bt=!0,$t(!1)};globalThis.collapseSourceOrderCard=en,globalThis.expandSourceOrderCard=wt;const xt=n.getElementById("panel-image-paste-preview"),Ct=n.getElementById("panel-pasted-img"),kt=n.getElementById("panel-pasted-img-info"),tn=n.getElementById("btn-remove-pasted-img"),Fe=n.getElementById("panel-image-ocr-status"),tt=n.getElementById("panel-image-ocr-status-text");let nn=null;tn&&tn.addEventListener("click",e=>{e.stopPropagation(),Ot(),showVnpostToast("🗑️ Đã gỡ bỏ ảnh đơn hàng.","info")});async function un(e){var Je;let t=null;try{typeof AuthSession<"u"&&typeof AuthSession.getSession=="function"&&(t=await AuthSession.getSession())}catch{}let o="",a="";try{if(typeof chrome<"u"&&((Je=chrome.storage)!=null&&Je.local)){const ge=await new Promise(it=>chrome.storage.local.get(["custom_gemini_api_key","custom_vision_api_key"],it));a=(ge==null?void 0:ge.custom_gemini_api_key)||"",o=(ge==null?void 0:ge.custom_vision_api_key)||""}}catch{}const c=await new Promise(ge=>{var it;typeof chrome<"u"&&((it=chrome.runtime)!=null&&it.sendMessage)?chrome.runtime.sendMessage({action:"runGeminiVision",imageBase64:e,token:(t==null?void 0:t.access_token)||(t==null?void 0:t.shop_access_key),shopKey:t==null?void 0:t.shop_access_key,shopId:t==null?void 0:t.active_shop_id,deviceId:t==null?void 0:t.device_id,customApiKey:a},_t=>{chrome.runtime.lastError?ge({ok:!1,error:chrome.runtime.lastError.message}):ge(_t||{ok:!1,error:"Không nhận được phản hồi từ Gemini Vision"})}):ge({ok:!1,error:"Extension runtime không khả dụng."})});if(!c||!c.ok)throw new Error((c==null?void 0:c.error)||"Gemini Vision không bóc tách được đơn hàng từ ảnh.");const y=c.result||{},$=String(y.name||"").trim(),U=String(y.phone||"").trim(),O=String(y.orderCode||"").trim(),R=parseInt(String(y.codAmount||0).replace(/\D/g,""),10)||0,ce=String(y.correctAddress||y.address||"").trim(),be=String(y.productItem||"").trim(),nt=String(y.extraNote||"").trim(),Ee=[];$&&Ee.push(`Khách hàng: ${$}`),U&&Ee.push(`SĐT: ${U}`),ce&&Ee.push(`Địa chỉ: ${ce}`),R>0&&Ee.push(`Thu hộ COD: ${R.toLocaleString("vi-VN")} đ`),O&&Ee.push(`Mã đơn: ${O}`),be&&Ee.push(`Hàng hóa: ${be}`),nt&&Ee.push(`Ghi chú: ${nt}`);const W=Ee.join(`
`);D&&(D.value=W,D.dispatchEvent(new Event("input",{bubbles:!0})),D.dispatchEvent(new Event("change",{bubbles:!0})));const Ie={name:$,phone:U,orderCode:O,codAmount:R,address:ce,productItem:be,extraNote:nt,imageThumbnail:e,rawText:W,addressParts:{ward:"",district:"",province:""}};globalThis.parsedDataStore=Ie,globalThis.__AF_INITIAL_PARSED_DATA__=JSON.parse(JSON.stringify(Ie)),globalThis.__AF_RAW_ORDER_INPUT__=W,typeof Ye=="function"&&Ye(Ie),ce&&typeof globalThis.refreshAddressSuggestion=="function"&&globalThis.refreshAddressSuggestion(ce,U).catch(()=>{}),Fe&&tt&&(tt.textContent=`✅ Bóc tách ảnh thành công (${c.model||"Gemini Flash"})!`,setTimeout(()=>{Fe&&(Fe.style.display="none")},3500)),showVnpostToast(`✨ Đã nhận diện đơn từ ảnh bằng ${c.model||"Gemini Vision"}!`,"success",4e3)}async function St(e){if(!e||!e.type.startsWith("image/"))return;const t=new FileReader;t.onload=async o=>{const a=o.target.result;if(nn=a,Ct&&(Ct.src=a),kt){const c=Math.round(e.size/1024);kt.textContent=`${e.name||"Ảnh dán"} · ${c} KB`}xt&&(xt.style.display="block"),Fe&&tt&&(Fe.style.display="flex",tt.textContent="🚀 Đang nhận diện chữ & bóc tách qua Gemini Vision..."),showVnpostToast("🖼️ Đã nhận ảnh! Đang kích hoạt Gemini Vision bóc tách...","info",3e3);try{await un(a)}catch(c){console.error("[Panel Image Parse] Error:",c),Fe&&tt&&(tt.textContent="⚠️ "+(c.message||"Lỗi bóc tách ảnh")),showVnpostToast("❌ "+(c.message||"Lỗi bóc tách ảnh"),"error",5e3)}},t.readAsDataURL(e)}globalThis.resetSourceOrderCard=()=>{bt=!1,$t(!1),Ot(),D&&(D.value=""),Bt={},vt&&(vt.textContent="---"),wt();const e=n.getElementById("review-panel"),t=n.getElementById("panel-empty-state"),o=n.getElementById("panel-validation-error"),a=n.getElementById("panel-duplicate-alert");e&&(e.style.display="none"),t&&(t.hidden=!1),o&&(o.hidden=!0),a&&(a.style.display="none");const c=n.getElementById("customer-history-card");c&&(c.hidden=!0),typeof ye=="function"&&ye(0),ft(null)},window.addEventListener("autofill:clear-order",()=>{globalThis.parsedDataStore=null,typeof globalThis.resetSourceOrderCard=="function"&&globalThis.resetSourceOrderCard()}),Qe==null||Qe.addEventListener("click",wt),Ze==null||Ze.addEventListener("click",e=>{e.stopPropagation(),wt()});const on=n.getElementById("btn-close-duplicate-alert");on&&on.addEventListener("click",e=>{e.stopPropagation();const t=n.getElementById("panel-duplicate-alert");t&&(t.style.display="none")}),document.addEventListener("pointerdown",e=>{if(!(!bt||At||(he==null?void 0:he.getAttribute("aria-expanded"))!=="true"||(typeof e.composedPath=="function"?e.composedPath():[]).includes(he))){if(!Yt){en(Bt);return}At=!0,window.setTimeout(async()=>{try{await s()}finally{At=!1}},0)}},!0),D&&(D.addEventListener("focus",()=>{D.style.borderColor=X,D.style.boxShadow=`0 0 0 3px ${X}1a`}),D.addEventListener("blur",()=>{D.style.borderColor="rgba(255,255,255,0.08)",D.style.boxShadow="none"}),D.addEventListener("keydown",e=>{(e.ctrlKey||e.metaKey)&&e.key==="Enter"&&(e.preventDefault(),s())}),D.addEventListener("input",()=>{const e=n.getElementById("panel-duplicate-alert");e&&(e.style.display="none"),bt&&$t(!0)}),D.addEventListener("paste",e=>{var a,c;const t=(a=e.clipboardData)==null?void 0:a.items;if(t&&t.length>0){for(let y=0;y<t.length;y++)if(t[y].type&&t[y].type.startsWith("image/")){const $=t[y].getAsFile();if($){e.preventDefault(),e.stopPropagation(),St($);return}}}const o=(c=e.clipboardData)==null?void 0:c.files;if(o&&o.length>0){for(let y=0;y<o.length;y++)if(o[y].type&&o[y].type.startsWith("image/")){e.preventDefault(),e.stopPropagation(),St(o[y]);return}}}),["dragenter","dragover"].forEach(e=>{D.addEventListener(e,t=>{t.preventDefault(),t.stopPropagation(),D.classList.add("is-dragover")})}),["dragleave","drop"].forEach(e=>{D.addEventListener(e,t=>{t.preventDefault(),t.stopPropagation(),D.classList.remove("is-dragover")})}),D.addEventListener("drop",e=>{var o;const t=(o=e.dataTransfer)==null?void 0:o.files;if(t&&t.length>0){for(let a=0;a<t.length;a++)if(t[a].type&&t[a].type.startsWith("image/")){St(t[a]);return}}})),he==null||he.addEventListener("paste",e=>{var t;if(e.target!==D){const o=(t=e.clipboardData)==null?void 0:t.items;if(o&&o.length>0){for(let a=0;a<o.length;a++)if(o[a].type&&o[a].type.startsWith("image/")){const c=o[a].getAsFile();if(c){e.preventDefault(),e.stopPropagation(),St(c);return}}}}});const Pt={"rev-name":"name","rev-phone":"phone","rev-code":"orderCode","rev-address":"address","rev-cod":"codAmount"};Object.keys(Pt).forEach(e=>{const t=n.getElementById(e);if(!t)return;const o=()=>{var a;if(typeof N=="function"){const c=Pt[e];let y=t.textContent.trim(),$=y;c==="codAmount"?$=parseInt(y.replace(/\D/g,""),10)||0:c==="orderCode"&&(typeof getCurrentPlatform=="function"?((a=getCurrentPlatform())==null?void 0:a.id)||getCurrentPlatform():"vnpost")==="vnpost"&&y&&/\d/.test(y)&&($=Ht(y),t.textContent!==$&&(t.textContent=$));try{const U=globalThis.__AF_INITIAL_PARSED_DATA__&&globalThis.__AF_INITIAL_PARSED_DATA__[c]||"";if(U&&String(U).trim()!==String($).trim()&&typeof AddressLearning<"u"&&typeof AddressLearning.recordUserCorrection=="function"){const O=globalThis.__AF_RAW_ORDER_INPUT__||(n.getElementById("rawOrderText")?n.getElementById("rawOrderText").value:""),R=globalThis.parsedDataStore&&globalThis.parsedDataStore.phone||"";AddressLearning.recordUserCorrection({field:c,originalValue:U,correctedValue:$,rawText:O,phone:R}).catch(()=>{})}}catch{}Promise.resolve(N(c,$)).finally(()=>ft(globalThis.parsedDataStore))}};t.addEventListener("blur",o),t.addEventListener("input",()=>{if(globalThis.parsedDataStore){const a=Pt[e];let c=t.textContent.trim(),y=c;a==="codAmount"&&(y=parseInt(c.replace(/\D/g,""),10)||0),globalThis.parsedDataStore[a]=y,ft(globalThis.parsedDataStore)}}),t.addEventListener("keydown",a=>{a.key==="Enter"&&(a.preventDefault(),t.blur())})});const Dt=n.getElementById("vnpost-btn-minimize");Dt.addEventListener("click",e=>{if(e.stopPropagation(),L.classList.contains("panel-docked")){gt(L,u,J,"docked",{collapsed:!0}),Ke.set({panel_display_mode:"docked",panel_dock_collapsed:!0,panelMinimized:!1});return}L.classList.add("minimized"),Dt.innerHTML=H.maximize,Ke.set({panel_display_mode:"floating",panelMinimized:!0})}),L.addEventListener("click",e=>{L.classList.contains("panel-floating")&&L.classList.contains("minimized")&&(L.classList.remove("minimized"),Dt.innerHTML=H.minimize,Ke.set({panel_display_mode:"floating",panelMinimized:!1}))});const Oe=n.getElementById("vnpost-api-status");if(Oe){let a=function(y=!1){return typeof OrderStorage<"u"?OrderStorage.getCacheValue("activeShop")?(Oe.innerHTML=H.apiOk,Oe.title="AI Gateway: Đã kết nối",o&&(clearInterval(o),o=null),!0):(y?(Oe.innerHTML=H.apiWarning,Oe.title="Chưa chọn Shop — không thể dùng AI"):(Oe.innerHTML=H.apiWaiting,Oe.title="Đang kiểm tra kết nối AI Gateway..."),!1):(Oe.innerHTML=H.apiUnknown,Oe.title="Không thể kiểm tra",o&&(clearInterval(o),o=null),!0)};var te=a;let e=0;const t=30;let o=null;a(!1)||(o=setInterval(()=>{e++,(a(e>=t)||e>=t)&&o&&(clearInterval(o),o=null)},300)),typeof chrome<"u"&&chrome.storage&&chrome.storage.onChanged&&chrome.storage.onChanged.addListener((y,$)=>{const U=Object.keys(y).some(O=>O.startsWith("groqApiKey")||O.startsWith("activeShop"));$==="local"&&U&&(o&&(clearInterval(o),o=null),a(!0))})}(function(){const t=n.getElementById("panel-device-name");if(typeof FirebaseCloud>"u")return;const o=()=>{try{let a=FirebaseCloud.deviceName||"";if(!a||a==="Máy không tên"||a.startsWith("dev_")){let c=!1;try{c=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}c&&chrome.storage&&chrome.storage.local&&chrome.storage.local.get(["fbDeviceName"],y=>{chrome.runtime&&chrome.runtime.lastError||y&&y.fbDeviceName&&y.fbDeviceName!=="Máy không tên"&&!y.fbDeviceName.startsWith("dev_")&&t&&(t.textContent="💻 "+y.fbDeviceName,t.style.display="inline")});return}t&&(t.textContent="💻 "+a,t.style.display="inline")}catch{}};(async()=>{try{if(!FirebaseCloud.isConnected){await FirebaseCloud.signIn();try{await FirebaseCloud.registerDevice()}catch{}}o()}catch{}})(),typeof chrome<"u"&&chrome.storage&&chrome.storage.onChanged.addListener(a=>{a.fbDeviceName&&o()})})()}catch(C){console.error(C)}}function Lt(i,s){if(typeof window>"u"||!i||!s)return;let l=0,d=0,T=0,g=0;i.addEventListener("mousedown",E=>{i.classList.contains("panel-floating")&&i.classList.contains("minimized")&&N(E)}),s.onmousedown=function(E){i.classList.contains("panel-floating")&&(E.target.id==="vnpost-btn-minimize"||E.target.id==="vnpost-btn-settings"||E.target.id==="vnpost-btn-theme"||E.target.id==="vnpost-btn-dock-toggle"||N(E))};function N(E){E=E||window.event;const P=E.clientX,f=E.clientY;let w=!1;T=E.clientX,g=E.clientY,document.onmouseup=function(_){document.onmouseup=null,document.onmousemove=null,w&&i.classList.contains("minimized")&&(_.stopPropagation(),_.preventDefault()),w&&i.classList.contains("panel-floating")&&Ke.set({panel_float_position:{top:i.offsetTop,left:i.offsetLeft}})},document.onmousemove=function(_){_=_||window.event,_.preventDefault(),Math.sqrt(Math.pow(_.clientX-P,2)+Math.pow(_.clientY-f,2))>4&&(w=!0),l=T-_.clientX,d=g-_.clientY,T=_.clientX,g=_.clientY;let I=i.offsetTop-d,r=i.offsetLeft-l;const h=window.innerHeight-50,q=window.innerWidth-50;I<0&&(I=0),I>h&&(I=h),r<0&&(r=0),r>q&&(r=q),i.style.top=I+"px",i.style.left=r+"px",i.style.right="auto"}}}function Ft(i,s={}){const l=k("rev-ai-confidence");if(l){if(i==="hidden"){l.style.display="none";return}if(l.style.display="inline-flex",i==="verifying")l.className="ai-confidence-badge verifying",l.textContent="⏳ AI đang thẩm định...",l.title="AI đang đối soát dữ liệu đơn hàng trong nền";else if(i==="verified"){const d=s.score||98;s.optimized||s.corrections&&s.corrections.length>0?(l.className="ai-confidence-badge optimized",l.textContent=`✨ Đã tối ưu (${d}%)`,l.title=`Độ tin cậy: ${d}%
AI đã hiệu chỉnh thông tin:
`+(s.corrections||[]).join(`
`)):(l.className="ai-confidence-badge high",l.textContent=`🛡️ Tin cậy ${d}% (Khớp chuẩn)`,l.title=`Độ tin cậy: ${d}%
Mọi trường thông tin đã được đối soát khớp với quy tắc`)}else if(i==="review_needed"){const d=s.score||70;l.className="ai-confidence-badge medium",l.textContent=`⚠️ Tin cậy ${d}% (Xem lại)`,l.title=`Độ tin cậy: ${d}%
Cần kiểm tra lại một số trường thông tin`}else i==="offline"&&(l.className="ai-confidence-badge offline",l.textContent="⚡ Cục bộ (Chưa qua AI)",l.title="Dữ liệu bóc tách cục bộ (chưa qua thẩm định AI)")}}globalThis.updateAiConfidenceBadge=Ft;function ft(i){const s=k("order-readiness-bar"),l=k("readiness-text");if(!s||!l)return;let d=k("readiness-confidence-badge");!d&&s&&(d=document.createElement("span"),d.id="readiness-confidence-badge",d.className="readiness-confidence-badge",s.appendChild(d));const T=[k("btnFillVNPost"),k("btnFillJT")].filter(Boolean),g=k("btnSaveOrder"),N=k("panel-empty-state"),E=k("panel-validation-error"),P=k("panel-validation-checklist"),f=k("panel-validation-message"),w=v=>{T.forEach(p=>{p.disabled=!v}),g&&(g.disabled=!v)};if(!i){s.className="order-readiness-bar readiness-idle",l.textContent="○ Chờ bóc tách nội dung đơn",d&&(d.style.display="none"),w(!1),N&&(N.hidden=!1),E&&(E.hidden=!0);return}if(d){const v=i.confidence;if(v&&typeof v.score=="number"){d.style.display="inline-flex",d.className=`readiness-confidence-badge confidence-${v.level||"medium"}`;const p=v.level==="high"?"🛡️":v.level==="medium"?"⚡":"⚠️",L=v.level==="high"?"Tin cậy":v.level==="medium"?"Tương đối":"Xem lại";d.textContent=`${p} ${L} ${v.score}%`,d.title=`Độ tin cậy bóc tách: ${v.score}%
`+(v.reasons||[]).join(`
`)}else d.style.display="none"}const _=!!(i.name&&i.name.trim()&&i.name!=="không tìm thấy"),I=(i.phone||"").replace(/\D/g,"").length>=9,r=!!(i.address&&i.address.trim()&&i.address!=="không tìm thấy"),h=!!k("rev-phone-warn"),q=i&&i.rawText||(k("order-raw-input")?k("order-raw-input").value:"");let C=null;typeof OrderValidator<"u"&&typeof OrderValidator.auditCOD=="function"&&(C=OrderValidator.auditCOD(i,q));const B=C?C.canProceed:Number(i.codAmount||0)>0||!!i.codExplicitZero,b=[{label:"Khách hàng",valid:_,target:"rev-name"},{label:"Số điện thoại",valid:I,target:"rev-phone"},{label:"Địa chỉ",valid:r,target:"rev-address"},{label:"COD",valid:B,target:"rev-cod"}],n=b.filter(v=>!v.valid);if(N&&(N.hidden=!0),b.forEach(v=>{var p;return(p=k(v.target))==null?void 0:p.classList.toggle("is-invalid",!v.valid)}),n.length){s.className="order-readiness-bar readiness-error",l.textContent=C&&!B&&n.length===1?C.status==="CRITICAL_MISSING_COD"?"🚨 Đơn thô có COD nhưng chưa nhập COD":"⚠️ Đơn hàng chưa có tiền COD":"⚠ Cần kiểm tra thông tin bắt buộc",w(!1),E&&(E.hidden=!1),P&&(P.innerHTML=b.map(v=>`<span class="${v.valid?"is-valid":"is-missing"}">${v.valid?"✓":"✕"} ${v.label}</span>`).join("")),f&&(C&&C.status==="CRITICAL_MISSING_COD"?f.textContent=`🚨 NGUY HIỂM: Đơn thô có COD ${C.codRaw.toLocaleString("vi-VN")} đ nhưng form đang là 0đ!`:C&&C.status==="NO_COD_WARNING"&&n.length===1?f.textContent="⚠️ Đơn hàng chưa có tiền COD. Vui lòng nhập số tiền hoặc xác nhận đơn 0đ.":f.textContent=n.map(v=>v.label).join(", ")+" chưa được nhận diện.");return}if(E&&(E.hidden=!0),w(!0),h){s.className="order-readiness-bar readiness-warn",l.textContent="⚠️ CẢNH BÁO: SĐT BOM HÀNG";return}_&&I&&r?(s.className="order-readiness-bar readiness-ready",l.textContent="🟢 SẴN SÀNG NHẬP ĐƠN"):!I||!r?(s.className="order-readiness-bar readiness-error",l.textContent="🔴 THIẾU THÔNG TIN: "+(I?"Địa chỉ":"SĐT")):(s.className="order-readiness-bar readiness-warn",l.textContent="🟡 CẦN KIỂM TRA LẠI THÔNG TIN")}function ln(){requestAnimationFrame(()=>{const i=k("rev-name");i&&(i.innerHTML='<span class="skeleton" style="width: 70%; height: 14px;">&nbsp;</span>');const s=k("rev-phone");s&&(s.innerHTML='<span class="skeleton" style="width: 50%; height: 14px;">&nbsp;</span>');const l=k("rev-phone-warn");l&&l.remove();const d=k("rev-code");d&&(d.innerHTML='<span class="skeleton" style="width: 55%; height: 14px;">&nbsp;</span>');const T=k("rev-address");T&&(T.innerHTML='<span class="skeleton" style="width: 90%; height: 14px;">&nbsp;</span>');const g=k("rev-cod");g&&(g.innerHTML='<span class="skeleton" style="width: 40%; height: 18px;">&nbsp;</span>');const N=k("rev-fee");N&&(N.innerHTML='<span class="skeleton" style="width: 35%; height: 14px;">&nbsp;</span>');const E=k("review-panel");E&&(E.style.display="none");const P=k("panel-empty-state"),f=k("panel-validation-error"),w=k("panel-duplicate-alert");P&&(P.hidden=!0),f&&(f.hidden=!0),w&&(w.style.display="none"),[k("btnFillVNPost"),k("btnFillJT"),k("btnSaveOrder")].filter(Boolean).forEach(I=>{I.disabled=!0});const _=k("order-readiness-bar"),te=k("readiness-text");_&&te&&(_.className="order-readiness-bar readiness-idle",te.textContent="⏳ Đang phân tích dữ liệu...")})}function dn(i={}){return new Promise(s=>{const{carrierData:l=null,panelData:d=null,orderData:T={},rawText:g="",platform:N="vnpost",onConfirm:E,onCancel:P,onUpdateCOD:f}=i;let w=document.getElementById("vnpost-autofill-shadow-host");!w&&typeof document<"u"&&document.body&&(w=document.createElement("div"),w.id="vnpost-autofill-shadow-host",document.body.appendChild(w));let _=w&&w.shadowRoot?w.shadowRoot:w&&w.attachShadow?w.attachShadow({mode:"open"}):null;if(_&&_.querySelector&&!_.querySelector("#vnpost-shadow-style")){const u=document.createElement("style");u.id="vnpost-shadow-style",u.textContent=typeof PANEL_CSS<"u"?PANEL_CSS:"",_.appendChild(u)}if(_||(_=typeof document<"u"&&document.body?document.body:null),!_){s({confirmed:!0,orderData:l||T});return}const te=(_.getElementById?_.getElementById("af-order-approval-modal"):null)||(_.querySelector?_.querySelector("#af-order-approval-modal"):null)||(typeof document<"u"&&document.getElementById?document.getElementById("af-order-approval-modal"):null);te&&te.remove();const I=l||T||{},r=d||globalThis.parsedDataStore||globalThis.__AF_LAST_FILLED_ORDER__||{};let h={...I};const q=Number(h.codAmount||0),C=Number(r.codAmount!==void 0?r.codAmount:0);q===0&&C>0&&!r.codExplicitZero&&(h.codAmount=C);let B=!!(h.codExplicitZero||r.codExplicitZero),b=!1;function n(){const u=Number(h.codAmount||0),M=Number(r.codAmount!==void 0?r.codAmount:0),A=!!(r&&(r.name||r.phone||r.codAmount!==void 0||r.orderCode));let z=typeof OrderValidator<"u"&&OrderValidator.readVietnameseCurrency?OrderValidator.readVietnameseCurrency(u):u.toLocaleString("vi-VN")+" đ";if(A&&(M>0||r.codExplicitZero)){if(u===M)return{status:"MATCH",level:"success",badge:"✓ KHỚP HOÀN TOÀN",title:"Tiền thu hộ khớp 100%",message:`Tiền COD trên Form Bưu Điện trùng khớp 100% với Panel Auto Fill (${u.toLocaleString("vi-VN")} đ).`,canProceed:!0,suggestedCod:null,codForm:u,codPanel:M,spelledOutWords:z,hasPanelData:!0};{const G=Math.abs(u-M);return{status:"MISMATCH",level:"danger",badge:`🚨 LỆCH TIỀN (${G.toLocaleString("vi-VN")} đ)`,title:"CẢNH BÁO LỆCH TIỀN COD",message:`Trên Form Bưu Điện đang là ${u.toLocaleString("vi-VN")} đ, lệch ${G.toLocaleString("vi-VN")} đ so với Panel (${M.toLocaleString("vi-VN")} đ). Hãy kiểm tra hoặc bấm đồng bộ bên dưới!`,canProceed:B,suggestedCod:M,codForm:u,codPanel:M,spelledOutWords:z,hasPanelData:!0}}}return u===0&&!B?{status:"NO_COD_WARNING",level:"warning",badge:"⚠️ CHƯA CÓ TIỀN COD",title:"Đơn hàng chưa có tiền thu hộ (0đ)",message:"Form bưu điện đang có COD = 0đ. Nếu khách đã chuyển khoản trước hoặc quà tặng, hãy bấm Xác nhận đơn 0đ.",canProceed:!1,suggestedCod:M>0?M:null,codForm:0,codPanel:M,spelledOutWords:"Không đồng (0 đ)",hasPanelData:A}:typeof OrderValidator<"u"&&typeof OrderValidator.auditCOD=="function"?{...OrderValidator.auditCOD(h,g,{userConfirmedZero:B}),codPanel:M,hasPanelData:A}:{status:"VALID_MATCH",level:"success",badge:"✓ COD HỢP LỆ",title:"Số tiền COD hợp lệ",message:`Đã nhập tiền COD hợp lệ (${u.toLocaleString("vi-VN")} đ).`,canProceed:!0,suggestedCod:null,codForm:u,codPanel:M,spelledOutWords:z,hasPanelData:A}}function v(u,M,A="text"){const z=String(u||"").trim(),G=String(M||"").trim();if(!z||!G||z==="—"||G==="—"||z==="không tìm thấy"||G==="không tìm thấy")return!0;if(A==="phone"){const j=z.replace(/\D/g,""),Q=G.replace(/\D/g,"");return j===Q||j.length>=9&&Q.length>=9&&(j.endsWith(Q)||Q.endsWith(j))}if(A==="code")return z.toLowerCase().replace(/[^a-z0-9]/g,"")===G.toLowerCase().replace(/[^a-z0-9]/g,"");if(A==="address"){const j=z.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d"),Q=G.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");return j===Q||j.includes(Q)||Q.includes(j)}if(A==="note"){const j=z.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d"),Q=G.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");if(j===Q||j.includes(Q)||Q.includes(j))return!0;const Y=j.replace(/^(?:don\s*hang|don|ma\s*don)\s*:\s*[a-z0-9._-]+\s*/i,"").trim(),m=Q.replace(/^(?:don\s*hang|don|ma\s*don)\s*:\s*[a-z0-9._-]+\s*/i,"").trim();return Y===m||Y&&m&&(Y.includes(m)||m.includes(Y))}const fe=z.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d"),J=G.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");return fe===J}const p={shield:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',close:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',user:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',phone:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',location:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',map:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>',tag:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',box:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',scale:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',creditCard:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',note:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',zap:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',truck:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="13" x="1" y="5" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',pin:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',edit:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',fileText:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',check:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',alert:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'};function L(u){return u.includes("Người nhận")?p.user:u.includes("Số điện thoại")||u.includes("SĐT")?p.phone:u.includes("Địa chỉ")?p.location:u.includes("Địa giới")?p.map:u.includes("Mã đơn")||u.includes("SKU")?p.tag:u.includes("hàng hóa")?p.box:u.includes("Khối lượng")?p.scale:u.includes("trả cước")?p.creditCard:u.includes("Ghi chú")?p.note:u.includes("Nguồn")?p.zap:p.pin}function ae(u){const M=String(u||"").trim(),A=M.replace(/\D/g,"");return A.length===10?`${A.slice(0,4)} ${A.slice(4,7)} ${A.slice(7)}`:M||"—"}function X(u,M,A,z,G=!1,fe=null){const J=M&&M!=="không tìm thấy"?M:"—",j=A&&A!=="không tìm thấy"?A:"—",Q=fe||(z?`<span class="af-compare-pill-match">${p.check} Khớp</span>`:`<span class="af-compare-pill-mismatch">${p.alert} Khác biệt</span>`),Y=G?`<div class="af-address-cell-box">${J}</div>`:`<div class="af-text-cell-wrap">${J}</div>`,m=G?`<div class="af-address-cell-box panel-addr">${j}</div>`:`<div class="af-text-cell-wrap">${j}</div>`,x=L(u);return`
          <div class="af-compare-row ${z?"is-match":"is-mismatch"} ${G?"row-address":""}">
            <div class="af-compare-cell-label" title="${u}">
              <span class="af-field-icon">${x}</span>
              <span class="af-field-name">${u}</span>
            </div>
            <div class="af-compare-cell cell-carrier ${G?"highlight-address":""}" title="Form Bưu Điện: ${J}">${Y}</div>
            <div class="af-compare-cell cell-panel ${G?"highlight-address":""}" title="Panel Auto Fill: ${j}">${m}</div>
            <div class="af-compare-cell-status">${Q}</div>
          </div>
        `}let V=n();const K=document.createElement("div");K.id="af-order-approval-modal",K.className="af-approval-overlay";function pe(){V=n();const u=ut(N),M=typeof detectCarrierAccount=="function"?detectCarrierAccount(u.id):"",A=h.shopName||(typeof _lastShopName<"u"?_lastShopName:"")||"",z=Number(h.codAmount||0).toLocaleString("vi-VN")+" đ",G=V.hasPanelData?V.codPanel>0?Number(V.codPanel).toLocaleString("vi-VN")+" đ":r.codExplicitZero?"0 đ (Xác nhận)":"0 đ":V.codRaw>0?Number(V.codRaw).toLocaleString("vi-VN")+" đ":"Chưa có",fe=v(h.name,r.name,"name"),J=v(h.phone,r.phone,"phone"),j=v(h.address,r.address,"address"),Q=v(h.orderCode,r.orderCode,"code"),Y=u.id==="jt",m=Number(h.weightGrams||h.weight||0);let x=0;Y?r.defaultWeightJt&&Number(r.defaultWeightJt)>0?x=Number(r.defaultWeightJt):r.weightGrams&&Number(r.weightGrams)>0?x=Number(r.weightGrams)>=10?Number(r.weightGrams)/1e3:Number(r.weightGrams):r.weight&&Number(r.weight)>0?x=Number(r.weight)>=10?Number(r.weight)/1e3:Number(r.weight):r.defaultWeightVnpost&&Number(r.defaultWeightVnpost)>0&&(x=Number(r.defaultWeightVnpost)>=10?Number(r.defaultWeightVnpost)/1e3:Number(r.defaultWeightVnpost)):x=Number(r.weightGrams||r.defaultWeightVnpost||r.weight||0);const ie=m>0&&m<50&&Y?Math.round(m*1e3):Math.round(m),oe=x>0&&x<50&&Y?Math.round(x*1e3):Math.round(x),ye=Y?m>0?m<50?`${m} kg`:`${m/1e3} kg`:"0.2 kg":m>0?`${m} g`:"200 g",Ne=Y?x>0?x<50?`${x} kg`:`${x/1e3} kg`:"0.2 kg":x>0?`${x} g`:"200 g",Be=ie>0&&oe>0?Math.abs(ie-oe)<=1:!0;let me=String(h.notes||h.extraNote||"").trim();const ee=String(r.notes||r.extraNote||"").trim(),Se=String(h.orderCode||r.orderCode||"").trim();!me&&Y&&h.productItem&&ee&&(v(h.productItem,ee,"note")||h.productItem.toLowerCase().includes(ee.toLowerCase()))&&(me=ee);const st=!!(Se&&me&&(me.toLowerCase()===`đơn hàng: ${Se.toLowerCase()}`||me.toLowerCase()===`đơn: ${Se.toLowerCase()}`||me.toLowerCase().replace(/\s+/g,"")===`đơnhàng:${Se.toLowerCase().replace(/\s+/g,"")}`||me.toLowerCase().includes(Se.toLowerCase()))&&(!ee||ee.toLowerCase()===Se.toLowerCase()||ee==="—"));let Me=!1,et=null,Ue=me||"—",Ve=ee||"—";st?(Me=!0,Ve=ee||`Tự sinh theo mã đơn (${Se})`,et=`<span class="af-compare-pill-compatible">${p.zap} Tự sinh theo mã</span>`):!me&&!ee?(Me=!0,Ue="—",Ve="—"):me&&ee&&(Me=v(me,ee,"note"));const He=r.addressParts||{};let qe=r.street||He.street||"",D=r.ward||He.ward||"",ve=r.district||He.district||"",_e=r.province||He.province||"";if(!D&&!ve&&!_e&&typeof globalThis.AddressParser<"u"&&globalThis.AddressParser.parse)try{const ne=globalThis.AddressParser.parse(h.address||r.address||"");ne&&(qe=ne.street||qe,D=ne.ward||D,ve=ne.district||ve,_e=ne.province||_e)}catch{}K.innerHTML=`
          <div class="af-approval-card" role="dialog" aria-modal="true" aria-labelledby="af-approval-title">
            <div class="af-approval-header">
              <div class="af-approval-title-group">
                <div class="af-header-shield-wrap">
                  <span class="af-header-shield-icon">${p.shield}</span>
                </div>
                <div class="af-title-text-wrap">
                  <div class="af-title-row">
                    <h3 id="af-approval-title">XÉT DUYỆT & ĐỐI CHIẾU ĐƠN HÀNG</h3>
                    <span class="af-badge-carrier ${u.id==="jt"?"carrier-jt":"carrier-vnpost"}">
                      <span class="af-carrier-indicator"></span>${u.title||"VNPost"}
                    </span>
                  </div>
                  <div class="af-approval-meta-row">
                    ${M?`
                      <span class="af-badge-account" title="Tài khoản bưu điện đang đăng nhập">
                        <span class="af-badge-account-icon">${p.user}</span>
                        <span class="af-badge-account-label">Tài khoản:</span>
                        <strong class="af-badge-account-name">${M}</strong>
                      </span>
                    `:""}
                    ${A?`<span class="af-approval-pill pill-shop" title="Cửa hàng"><span class="pill-dot"></span>Shop: <strong>${A}</strong></span>`:""}
                    ${h.orderCode?`<span class="af-approval-pill af-pill-code" title="Mã đơn hàng SKU"><span class="af-pill-lbl">Mã:</span> <strong class="af-pill-val">${h.orderCode}</strong></span>`:""}
                  </div>
                </div>
              </div>
              <button type="button" class="af-approval-close-btn" id="modal-close-icon-btn" title="Đóng (Esc)">${p.close}</button>
            </div>

            <div class="af-approval-body-grid">
              <!-- CỘT TRÁI: BẢNG ĐỐI CHIẾU CHI TIẾT TẤT CẢ CÁC TRƯỜNG -->
              <div class="af-approval-left-col">
                <div class="af-review-section-title">
                  <span class="af-table-title-icon">${p.map}</span>
                  <span>BẢNG ĐỐI CHIẾU CHI TIẾT ĐƠN HÀNG (Form bưu điện ⟷ Panel Auto Fill)</span>
                </div>
                <div class="af-compare-container">
                  <div class="af-compare-header">
                    <div class="af-compare-col-th field-name">Trường thông tin</div>
                    <div class="af-compare-col-th carrier">Form Bưu Điện (${u.title||"VNPost"})</div>
                    <div class="af-compare-col-th panel">Panel Auto Fill</div>
                    <div class="af-compare-col-th status-col">Trạng thái</div>
                  </div>

                  <div class="af-compare-list">
                    <!-- NHÓM 1: THÔNG TIN KHÁCH HÀNG & ĐỊA CHỈ PHÁT -->
                    <div class="af-compare-group-header customer">
                      <span class="af-group-icon">${p.user}</span>
                      <span class="af-group-title">1. Thông tin người nhận & Địa chỉ phát</span>
                      <span class="af-group-badge">Trọng yếu</span>
                    </div>

                    ${X("Người nhận",h.name,r.name,fe)}
                    ${X("Số điện thoại",ae(h.phone),ae(r.phone),J)}
                    ${X("Địa chỉ",h.address,r.address,j,!0)}
                    
                    ${_e||ve||D||qe?`
                      <div class="af-compare-row is-match row-geo">
                        <div class="af-compare-cell-label" title="Địa giới hành chính nhận diện (Panel)">
                          <span class="af-field-icon">${p.map}</span>
                          <span class="af-field-name">Địa giới hành chính</span>
                        </div>
                        <div class="af-compare-cell cell-carrier geo-hint">
                          <span class="af-geo-carrier-note">Bưu điện tự đối chiếu tọa độ</span>
                        </div>
                        <div class="af-compare-cell cell-panel">
                          <div class="af-address-breakdown">
                            ${qe?`<span class="af-address-sub-pill pill-street" title="Số nhà / Đường"><span class="pill-tag">Đường:</span> <strong class="pill-val">${qe}</strong></span>`:""}
                            ${D?`<span class="af-address-sub-pill pill-ward" title="Xã / Phường"><span class="pill-tag">Xã/Phường:</span> <strong class="pill-val">${D}</strong></span>`:""}
                            ${ve?`<span class="af-address-sub-pill pill-district" title="Quận / Huyện"><span class="pill-tag">Quận/Huyện:</span> <strong class="pill-val">${ve}</strong></span>`:""}
                            ${_e?`<span class="af-address-sub-pill pill-province" title="Tỉnh / Thành phố"><span class="pill-tag">Tỉnh/TP:</span> <strong class="pill-val">${_e}</strong></span>`:""}
                          </div>
                        </div>
                        <div class="af-compare-cell-status"><span class="af-compare-pill-match">${p.check} Chuẩn</span></div>
                      </div>
                    `:""}

                    <!-- NHÓM 2: BƯU KIỆN & HÀNG HÓA -->
                    <div class="af-compare-group-header package">
                      <span class="af-group-icon">${p.box}</span>
                      <span class="af-group-title">2. Chi tiết bưu kiện & Hàng hóa</span>
                      <span class="af-group-badge">Bưu kiện</span>
                    </div>

                    ${h.orderCode||r.orderCode?X("Mã đơn (SKU)",h.orderCode,r.orderCode,Q):""}
                    
                    ${(()=>{const ne=String(h.goodsName||h.productItem||"").trim(),We=String(r.goodsName||r.productItem||"").trim(),$e=String(h.orderCode||r.orderCode||"").trim();let mt=ne||"— (Mặc định hệ thống)",Ce=We;Ce||(ne&&$e&&v(ne,$e,"code")?Ce=$e:Ce=r.defaultGoodsName||"Hàng hóa");let Le=!1;return(!ne&&!Ce||v(ne,Ce,"text")||$e&&(v(ne,$e,"code")||ne.includes($e))||!ne||/^(?:hàng hóa|hang hoa)$/i.test(ne)||/^(?:hàng hóa|hang hoa)$/i.test(Ce))&&(Le=!0),X("Tên hàng hóa",mt,Ce||"—",Le)})()}
                    
                    ${X("Khối lượng",ye,Ne,Be)}

                    <!-- NHÓM 3: CƯỚC PHÍ & VẬN CHUYỂN -->
                    <div class="af-compare-group-header service">
                      <span class="af-group-icon">${p.truck}</span>
                      <span class="af-group-title">3. Cước phí & Ghi chú giao hàng</span>
                      <span class="af-group-badge">Vận hành</span>
                    </div>
                    
                    ${X("Người trả cước",h.collectFee?"Người nhận trả cước":"Shop trả cước",r.collectFee?"Người nhận trả cước":"Shop trả cước",!!h.collectFee==!!r.collectFee)}
                    
                    ${X("Ghi chú phát",Ue,Ve,Me,!1,et)}

                    ${X("Nguồn gốc tạo đơn",h.source==="MANUAL"?"Nhập thủ công":"Tách đơn AI (Auto Fill)","Tách đơn AI (Auto Fill)",!0)}
                  </div>
                </div>
              </div>

              <!-- CỘT PHẢI: TIÊU ĐIỂM TIỀN COD & THAO TÁC -->
              <div class="af-approval-right-col">
                <div class="af-hero-cod level-${V.level}">
                  <div class="af-hero-cod-top">
                    <span class="af-hero-cod-label">${p.creditCard} TIỀN THU HỘ (COD)</span>
                    <span class="af-hero-cod-badge">${V.badge}</span>
                  </div>

                  <div class="af-hero-cod-center">
                    <div class="af-hero-cod-amount" id="modal-hero-cod-amount">${z}</div>
                    <div class="af-hero-cod-words" id="modal-hero-cod-words">${V.spelledOutWords}</div>
                  </div>

                  <div class="af-cod-compare-grid">
                    <div class="af-cod-compare-col ${z===G?"is-matched":""}">
                      <div class="af-cod-source-header">
                        <span class="af-cod-dot carrier-dot"></span>
                        <span class="af-cod-compare-title">Form Bưu Điện</span>
                      </div>
                      <span class="af-cod-compare-val">${z}</span>
                    </div>
                    <div class="af-cod-compare-divider">
                      <span class="af-cod-comp-sign">${z===G?"=":"≠"}</span>
                    </div>
                    <div class="af-cod-compare-col ${z===G?"is-matched":""}">
                      <div class="af-cod-source-header">
                        <span class="af-cod-dot panel-dot"></span>
                        <span class="af-cod-compare-title">Panel Auto Fill</span>
                      </div>
                      <span class="af-cod-compare-val">${G}</span>
                    </div>
                  </div>

                  <div class="af-cod-alert-box" id="modal-cod-alert-box">
                    <span class="af-alert-icon-wrap">${V.level==="danger"||V.level==="warning"?p.alert:p.check}</span>
                    <div class="af-alert-text">
                      <strong class="af-alert-title">${V.title}</strong>
                      <span class="af-alert-msg">${V.message}</span>
                    </div>
                  </div>

                  ${b?`
                    <div class="af-inline-cod-edit">
                      <input type="text" class="af-inline-cod-input" id="modal-inline-cod-input" placeholder="Nhập số tiền COD (ví dụ: 350000)" value="${h.codAmount||""}" />
                      <div class="af-inline-cod-btns">
                        <button type="button" class="af-quick-btn af-quick-btn-apply" id="modal-inline-cod-save-btn">Lưu số tiền</button>
                        <button type="button" class="af-quick-btn af-quick-btn-edit" id="modal-inline-cod-cancel-btn">Hủy</button>
                      </div>
                    </div>
                  `:`
                    <div class="af-cod-quick-actions">
                      ${V.suggestedCod&&V.suggestedCod>0&&V.suggestedCod!==Number(h.codAmount||0)?`
                        <button type="button" class="af-quick-btn af-quick-btn-apply" id="modal-quick-apply-panel-btn">
                          ${p.zap} Đồng bộ ${V.suggestedCod.toLocaleString("vi-VN")} đ từ Panel sang Form
                        </button>
                      `:""}

                      ${(Number(h.codAmount||0)===0||V.status==="NO_COD_WARNING")&&!B?`
                        <button type="button" class="af-quick-btn af-quick-btn-zero" id="modal-quick-confirm-zero-btn">
                          ${p.check} Xác nhận đơn 0đ (Khách chuyển khoản / Quà tặng)
                        </button>
                      `:""}

                      <button type="button" class="af-quick-btn af-quick-btn-edit" id="modal-quick-edit-btn">
                        ${p.edit} Sửa số tiền COD
                      </button>
                    </div>
                  `}
                </div>

                ${g?`
                  <details class="af-raw-preview-details">
                    <summary>
                      <span class="raw-summary-left">${p.fileText} Xem lại nội dung đơn thô gốc</span>
                      <span class="raw-summary-arrow">▾</span>
                    </summary>
                    <div class="af-raw-preview-content">${g}</div>
                  </details>
                `:""}
              </div>
            </div>

            <!-- FOOTER NÚT BẤM CHUẨN UX/UI -->
            <div class="af-modal-actions">
              <div class="af-footer-summary">
                <span class="af-pulse-dot ${V.canProceed?"is-ready":"is-warning"}"></span>
                <span class="af-footer-summary-text">
                  ${V.canProceed?"Tất cả dữ liệu đã được đối chiếu • Sẵn sàng gửi đơn":"Cần xác nhận số tiền COD trước khi tiếp tục"}
                </span>
              </div>
              <div class="af-footer-btns">
                <button type="button" class="af-modal-btn-cancel" id="modal-cancel-btn">
                  Quay lại sửa <kbd class="af-kbd">Esc</kbd>
                </button>
                <button type="button" class="af-modal-btn-confirm" id="modal-confirm-btn" ${V.canProceed?"":"disabled"} title="${V.canProceed?"Xác nhận tạo đơn và gửi lên bưu điện (Enter)":"Cần xử lý tiền COD trước khi tạo đơn"}">
                  ${p.zap} Xác Nhận Gửi Lên Bưu Điện <kbd class="af-kbd primary">Enter</kbd>
                </button>
              </div>
            </div>
          </div>
        `,Ae()}function Ae(){const u=K.querySelector("#modal-close-icon-btn"),M=K.querySelector("#modal-cancel-btn"),A=K.querySelector("#modal-confirm-btn"),z=K.querySelector("#modal-quick-edit-btn"),G=K.querySelector("#modal-quick-apply-panel-btn"),fe=K.querySelector("#modal-quick-confirm-zero-btn"),J=K.querySelector("#modal-inline-cod-save-btn"),j=K.querySelector("#modal-inline-cod-cancel-btn"),Q=K.querySelector("#modal-inline-cod-input"),Y=m=>{document.removeEventListener("keydown",xe,!0),K.remove(),m?(typeof E=="function"&&E(h),s({confirmed:!0,orderData:h,carrierData:h})):(typeof P=="function"&&P(),s({confirmed:!1,orderData:h,carrierData:h}))};if(u&&(u.onclick=()=>Y(!1)),M&&(M.onclick=()=>Y(!1)),A&&(A.onclick=()=>{if(!V.canProceed){typeof showVnpostToast=="function"&&showVnpostToast("⚠️ Vui lòng kiểm tra hoặc xác nhận tiền COD trước khi lên đơn!","warning");return}A.disabled=!0,A.classList.add("is-submitting"),A.innerHTML=`
              <span class="af-btn-spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:af-spin 0.8s linear infinite;margin-right:6px;vertical-align:middle;"></span>
              Đang gửi lên bưu điện...
            `,M&&(M.disabled=!0),u&&(u.disabled=!0),setTimeout(()=>Y(!0),150)}),z&&(z.onclick=()=>{b=!0,pe();const m=K.querySelector("#modal-inline-cod-input");m&&(m.focus(),m.select())}),j&&(j.onclick=()=>{b=!1,pe()}),J&&Q){const m=()=>{const x=parseInt(Q.value.replace(/\D/g,""),10)||0;h.codAmount=x,x===0?B=!0:B=!1,b=!1,typeof f=="function"&&f(x),pe()};J.onclick=m,Q.onkeydown=x=>{x.key==="Enter"?(x.preventDefault(),m()):x.key==="Escape"&&(x.preventDefault(),b=!1,pe())}}G&&V.suggestedCod!==null&&(G.onclick=()=>{h.codAmount=V.suggestedCod,B=V.suggestedCod===0,typeof f=="function"&&f(V.suggestedCod),pe(),typeof showVnpostToast=="function"&&showVnpostToast(`✓ Đã đồng bộ COD ${V.suggestedCod.toLocaleString("vi-VN")} đ từ Panel sang Form!`,"success")}),fe&&(fe.onclick=()=>{h.codAmount=0,h.codExplicitZero=!0,B=!0,typeof f=="function"&&f(0),pe(),typeof showVnpostToast=="function"&&showVnpostToast("✓ Đã xác nhận đơn 0đ (Khách chuyển khoản/Quà tặng)!","info")})}function xe(u){if(u.key==="Escape")u.preventDefault(),u.stopPropagation(),document.removeEventListener("keydown",xe,!0),K.remove(),typeof P=="function"&&P(),s({confirmed:!1,orderData:h});else if(u.key==="Enter"&&!u.shiftKey&&!u.ctrlKey&&!u.metaKey){const M=_.activeElement||document.activeElement;if(M&&M.id==="modal-inline-cod-input")return;V.canProceed?(u.preventDefault(),u.stopPropagation(),document.removeEventListener("keydown",xe,!0),K.remove(),typeof E=="function"&&E(h),s({confirmed:!0,orderData:h})):typeof showVnpostToast=="function"&&showVnpostToast("⚠️ Vui lòng kiểm tra tiền COD hoặc xác nhận đơn 0đ trước khi lên đơn!","warning")}}document.addEventListener("keydown",xe,!0),K.addEventListener("click",u=>{u.target===K&&(document.removeEventListener("keydown",xe,!0),K.remove(),typeof P=="function"&&P(),s({confirmed:!1,orderData:h}))}),pe(),_&&typeof _.appendChild=="function"&&_!==document?_.appendChild(K):typeof document<"u"&&document.body&&document.body.appendChild(K)})}function Ye(i){requestAnimationFrame(()=>{var B,b;const s=k("rev-name");s&&(s.textContent=i.name?i.name.trim():"không tìm thấy");const l=k("rev-phone");l&&(l.textContent=i.phone?i.phone.trim():"không tìm thấy",l.style.color="",l.style.fontWeight="",l.title="");const d=k("rev-phone-warn");if(d&&d.remove(),i.phone){const n=i.phone.replace(/\D/g,"");if(typeof OrderStorage<"u"){const p=(OrderStorage.getCacheValue("blacklistPhones")||[]).find(L=>L.phone===n);if(p&&l){l.style.color="#dc2626",l.style.fontWeight="700",l.title="SĐT nằm trong danh sách đen! Lý do: "+p.reason;const L=document.createElement("span");L.id="rev-phone-warn",L.innerHTML=" "+H.warn,L.style.color="#dc2626",L.style.cursor="help",L.style.display="inline-flex",L.style.alignItems="center",L.title="Lịch sử bom hàng: "+p.reason,l.parentElement.appendChild(L),showVnpostToast("⚠️ CẢNH BÁO: Khách hàng này có lịch sử BOM HÀNG! Lý do: "+p.reason,"error")}}}const T=k("rev-code"),g=(typeof getCurrentPlatform=="function"?((B=getCurrentPlatform())==null?void 0:B.id)||getCurrentPlatform():"vnpost")==="vnpost";if(T){let n=i.orderCode?i.orderCode.trim():g?"LuaThuySinh":"Lũa Thuỷ Sinh";g&&n&&(n=Ht(n)),T.textContent=n}let N=i.address?i.address.trim():"không tìm thấy";typeof AddressSanitizer<"u"&&typeof AddressSanitizer.deduplicate=="function"&&N!=="không tìm thấy"&&(N=AddressSanitizer.deduplicate(N));const E=k("rev-address");E&&(E.textContent=N);const P=k("rev-raw-address");P&&(P.textContent=N||"---");const f=k("address-reference-disclosure")||typeof root<"u"&&((b=root==null?void 0:root.querySelector)==null?void 0:b.call(root,".address-reference-disclosure"));if(f){const n=i.addressLevel===2;if(f.style.display=n?"none":"",!n){f.open=!0;const v=f.querySelector(".address-reference-title");v&&(v.textContent="🎯 Gợi ý địa chỉ 2 cấp mới");const p=f.querySelector(".address-reference-status");p&&(p.textContent="Bấm để áp dụng",p.className="address-reference-status is-ready")}}if(i.twoLevelAddress){const n=k("rev-suggest-2level");n&&(n.textContent=i.twoLevelAddress)}if(i.cleanAddress){const n=k("rev-suggest-clean");n&&(n.textContent=i.cleanAddress)}if(i.addressLevel){const n=k("address-status-badge");n&&(n.textContent=i.addressLevel===2?"🎯 Địa chỉ 2 Cấp":"✓ Đã tối ưu",n.title=i.addressLevel===2?"Địa chỉ được nhận diện theo chuẩn 2 cấp (không chèn quận).":"Địa chỉ chuẩn hóa 3 cấp đầy đủ.");const v=k("btn-switch-clean"),p=k("btn-switch-2level");v&&p&&(v.classList.toggle("active",i.addressLevel!==2),p.classList.toggle("active",i.addressLevel===2))}const w=k("rev-cod"),_=k("rev-cod-status"),te=i&&i.rawText||(k("order-raw-input")?k("order-raw-input").value:"");let I=null;typeof OrderValidator<"u"&&typeof OrderValidator.auditCOD=="function"&&(I=OrderValidator.auditCOD(i,te)),w&&(w.textContent=i.codAmount?Number(i.codAmount).toLocaleString("vi-VN")+" đ":"0 đ",I&&(I.status==="CRITICAL_MISSING_COD"?w.style.color="#ef4444":I.status==="NO_COD_WARNING"||I.status==="MISMATCH"?w.style.color="#f59e0b":I.status==="EXPLICIT_ZERO"?w.style.color="#0284c7":w.style.color="#10b981")),_&&(I?(_.textContent=I.badge,_.title=I.message,_.className="cod-status-badge "+(I.level==="danger"?"cod-badge-danger":I.level==="warning"?"cod-badge-warning":I.level==="info"?"cod-badge-info":"cod-badge-success")):_.textContent=i.codAmount&&i.codAmount>0?"✓ COD hợp lệ":"⚠️ Chưa có COD");const r=k("rev-fee");if(r){const n=!!i.collectFee;r.textContent=n?"CÓ":"KHÔNG",r.classList.toggle("fee-status--yes",n),r.classList.toggle("fee-status--no",!n)}const h=k("review-panel");if(h&&(h.style.display="flex"),i&&i.confidence){const n=i.confidence,v=n.level==="verifying"?"verifying":n.level==="optimized"||n.level==="high"?"verified":n.level==="offline"?"offline":"review_needed";Ft(v,{score:n.score,optimized:n.level==="optimized",corrections:n.reasons})}ft(i),typeof globalThis.lookupPanelCustomerHistory=="function"&&globalThis.lookupPanelCustomerHistory(i.phone||i.name||"");const q=String(i.phone||"").replace(/\D/g,""),C=String(i.name||"").trim().toLowerCase();typeof OrderStorage<"u"&&typeof OrderStorage.getSubmittedOrders=="function"&&(q.length>=9||C.length>=2)?OrderStorage.getSubmittedOrders().then(n=>{const v=(n||[]).filter(p=>{const L=String(p.phone||"").replace(/\D/g,""),ae=String(p.name||p.customer_name||"").trim().toLowerCase();return q.length>=9?L===q:C.length>=2&&ae===C});typeof setCustomerOrderCountBadge=="function"&&setCustomerOrderCountBadge(v.length)}).catch(()=>{}):typeof setCustomerOrderCountBadge=="function"&&setCustomerOrderCountBadge(0),jt(i)})}async function jt(i){const s=k("panel-duplicate-alert");if(!s||(s.style.display="none",!i||!i.orderCode&&!i.phone))return null;try{if(typeof OrderStorage>"u")return null;let l=[];if(typeof OrderStorage._getSubmittedOrdersFromLocal=="function"&&(l=await OrderStorage._getSubmittedOrdersFromLocal().catch(()=>[])),(!Array.isArray(l)||l.length===0)&&typeof OrderStorage.getSubmittedOrders=="function"&&(l=await Promise.race([OrderStorage.getSubmittedOrders().catch(()=>[]),new Promise(w=>setTimeout(()=>w([]),1500))])),!Array.isArray(l)||l.length===0)return null;const d=new Date().toISOString().slice(0,10),T=new Date().toLocaleDateString("vi-VN"),g=String(i.orderCode||"").trim().toLowerCase(),N=g.replace(/[\s\.\-_]/g,""),E=String(i.phone||"").replace(/\D/g,""),P=String(i.name||"").trim().toLowerCase();let f=null;for(const w of l){const _=String(w.trackingCode||w.tracking_code||"").trim();if(_&&(_===globalThis.__AF_JUST_SUBMITTED_TRACKING__||_===(i==null?void 0:i.trackingCode))||w.id&&(w.id===globalThis.__AF_JUST_SUBMITTED_ID__||w.id===(i==null?void 0:i.id)||w.id===(i==null?void 0:i.savedOrderId)))continue;const te=w.submittedAt||w.createdAt||w.updatedAt||"";let I=!1,r="Hôm nay",h="";if(te)try{const ae=new Date(te);if(!isNaN(ae.getTime())){const X=ae.toISOString().slice(0,10),V=ae.toLocaleDateString("vi-VN");(X===d||V===T)&&(I=!0),r=I?"hôm nay":`ngày ${ae.toLocaleDateString("vi-VN")}`,h=ae.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}}catch{}else I=!0,r="hôm nay",h="";const q=String(w.orderCode||w.order_code||"").trim().toLowerCase(),C=q.replace(/[\s\.\-_]/g,""),B=String(w.phone||"").replace(/\D/g,""),b=String(w.name||w.customer_name||"").trim().toLowerCase();if(!!(g&&g!=="—"&&g!=="-"&&q&&q!=="—"&&q!=="-")&&g!==q&&N!==C)continue;const v=!!(g&&g!=="—"&&g!=="-"&&q&&g===q||N&&N!=="—"&&N!=="-"&&C&&N===C),p=!!(E&&E.length>=9&&B&&E===B);if(v||(p||!!(E&&P&&E===B&&P===b))&&I){f={order:w,matchCode:v,matchPhone:p,isToday:I,trackingCode:w.trackingCode||w.tracking_code||"",carrierAccount:w.carrierAccount||w.carrier_account||"",orderCode:w.orderCode||w.order_code||"",customerName:w.name||w.customer_name||"",phone:w.phone||"",submittedDate:r,submittedTime:h?`${h}`:I?"Hôm nay":r};break}}if(f){const w=k("panel-duplicate-time"),_=k("panel-duplicate-message"),te=k("panel-duplicate-details"),I=k("panel-duplicate-title");I&&(I.innerHTML=`
            <svg class="duplicate-alert-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>${f.isToday?"ĐƠN ĐÃ LÊN TRONG NGÀY":"ĐƠN ĐÃ TỪNG ĐƯỢC LÊN"}</span>
          `),w&&(w.textContent=f.isToday?`Lên đơn lúc ${f.submittedTime}`:`Đã lên ${f.submittedDate}${f.submittedTime?` lúc ${f.submittedTime}`:""}`);const r=de(f.orderCode),h=de(f.phone),q=de(f.customerName||"Khách hàng"),C=de(f.trackingCode),B=de(f.carrierAccount);let b="";return f.matchCode&&f.matchPhone?b=`Trùng mã đơn hàng <strong>${r}</strong> và SĐT <strong>${h}</strong>`:f.matchCode?b=`Trùng mã đơn hàng <strong>${r}</strong>`:b=`Trùng người nhận/SĐT <strong>${h}</strong> (${q})`,_&&(_.innerHTML=`⚠️ Đơn này đã được lên đơn thành công ${f.submittedDate}! (${b})`),te&&(te.innerHTML=`
            ${f.orderCode?`<span class="duplicate-detail-tag">Mã đơn: <strong>${r}</strong></span>`:""}
            ${f.customerName?`<span class="duplicate-detail-tag">Khách: <strong>${q}</strong></span>`:""}
            ${f.trackingCode?`<span class="duplicate-detail-tag">Mã VĐ: <code class="duplicate-detail-code">${C}</code></span>`:""}
            ${f.carrierAccount?`<span class="duplicate-detail-tag">Người gửi: <strong>${B}</strong></span>`:""}
          `),s.style.display="flex",showVnpostToast(`⚠️ CẢNH BÁO: Đơn (${f.orderCode||f.phone}) đã được lên ${f.isToday?"hôm nay lúc "+f.submittedTime:f.submittedDate+(f.submittedTime?" lúc "+f.submittedTime:"")}${f.trackingCode?` (Mã VĐ: ${f.trackingCode})`:""}!`,"warning",6e3),f}else return s.style.display="none",null}catch(l){return console.warn("[checkAndDisplayDuplicateAlert] Error:",l),s.style.display="none",null}}globalThis.getVnpostPanelRoot=Vt,globalThis.getVnpostEl=k,globalThis.createInputPanel=zt,globalThis.showPanelSkeleton=ln,globalThis.displayParsedData=Ye,globalThis.checkAndDisplayDuplicateAlert=jt;function cn(i,s){try{if(typeof document>"u")return;ht(!1);const l=ut(i);let d=document.getElementById("vnpost-autofill-shadow-host");const T=d?k("vnpost-autofill-panel"):null;if(T&&T.dataset&&T.dataset.panelType==="login")return;d||(d=document.createElement("div"),d.id="vnpost-autofill-shadow-host",document.body.appendChild(d));const g=d.shadowRoot||d.attachShadow({mode:"open"}),N=g.querySelector("#vnpost-autofill-panel");N&&N.remove();const E=g.querySelector("#vnpost-dock-toggle-tab");if(E&&E.remove(),!g.querySelector("#vnpost-shadow-style")){const m=document.createElement("style");m.id="vnpost-shadow-style",m.textContent=typeof PANEL_CSS<"u"?PANEL_CSS:"",g.appendChild(m)}const P=document.createElement("div");P.id="vnpost-autofill-panel",P.dataset.panelType="login",P.classList.add("panel-floating"),Tt(P);let f=!1;try{f=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(f&&chrome.storage&&chrome.storage.local)try{chrome.storage.local.get(["antigravity_ui_theme"],m=>{if(!chrome.runtime.lastError){if(m&&m.antigravity_ui_theme==="dark"){P.classList.remove("light-mode");try{localStorage.setItem("antigravity_ui_theme","dark")}catch{}}else if(m&&m.antigravity_ui_theme==="light"){P.classList.add("light-mode");try{localStorage.setItem("antigravity_ui_theme","light")}catch{}}}})}catch{}const w=l.themeColor||(l.id==="vnpost"?"#0056b3":"#4f46e5");P.style.setProperty("--theme-color",w);let _="v1";try{let m=!1;try{m=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.getManifest}catch{}m&&(_="v"+(chrome.runtime.getManifest().version||"1"))}catch{}P.innerHTML=`
        <div class="minimized-icon">${H.user}</div>
        <div id="vnpost-panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="vnpost-panel-header-text"></span>
            <span class="badge-version">${_} (Xác thực)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="vnpost-btn-theme" title="Chuyển chế độ Sáng/Tối">${H.theme}</button>
            <button id="vnpost-btn-minimize">${H.minimize}</button>
          </div>
        </div>

        <div id="vnpost-panel-body">
          <div class="panel-login-box">
            <div class="panel-login-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--theme-color, #16a34a);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Đăng Nhập Máy Trạm
            </div>
            
            <!-- TABS CHỌN ĐĂNG NHẬP -->
            <div class="panel-login-tabs">
              <button type="button" id="panel-tab-btn-pin" class="panel-login-tab active">🔑 Nhân Viên (PIN)</button>
              <button type="button" id="panel-tab-btn-owner" class="panel-login-tab">👑 Chủ Shop / Admin</button>
            </div>

            <div id="panel-login-subtitle" class="panel-login-subtitle">
              Xác thực nhanh bằng mã PIN 6 số cho nhân viên
            </div>

            <div id="panel-login-error" class="panel-login-error"></div>

            <!-- CONTAINER 1: NHÂN VIÊN PIN -->
            <div id="panel-pin-container">
              <!-- View 1.1: Máy Tin Cậy (Chỉ gõ 6 số PIN) -->
              <form id="panel-trusted-pin-form" style="display: none; flex-direction: column; gap: 10px;">
                <div style="background: rgba(0,0,0,0.04); border: 1px solid var(--input-border, #cbd5e1); border-radius: 8px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <div id="panel-trusted-staff-name" style="font-weight: 700; font-size: 12px; color: var(--text-primary, #0f172a);">Nhân viên</div>
                    <div id="panel-trusted-shop-name" style="font-size: 10.5px; color: var(--text-muted, #64748b);">Shop: LTS</div>
                  </div>
                  <button type="button" id="panel-btn-switch-account" style="background: none; border: none; color: #16a34a; font-size: 11px; font-weight: 700; cursor: pointer;">Đổi</button>
                </div>

                <div class="panel-login-group">
                  <label class="panel-login-label" style="text-align: center;">Nhập mã PIN 6 số vào ca</label>
                  <input type="password" id="panel-input-trusted-pin" class="panel-login-input" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="• • • • • •" required autocomplete="off" style="font-size: 18px; text-align: center; letter-spacing: 8px; font-weight: 800;" />
                </div>

                <button type="submit" id="panel-btn-submit-trusted-pin" class="panel-login-btn">
                  Đăng Nhập Vào Ca
                </button>
              </form>

              <!-- View 1.2: Máy Mới (Nhập Shop Code + Username + PIN tùy chọn) -->
              <form id="panel-new-pin-form" style="display: flex; flex-direction: column; gap: 8px;">
                <div class="panel-login-group">
                  <label class="panel-login-label" for="panel-input-shopcode">Mã Cửa Hàng (Shop Code / Key)</label>
                  <input type="text" id="panel-input-shopcode" class="panel-login-input" placeholder="VD: SHOPLA, KEY-SHOP-..." required autocomplete="off" style="font-weight: 700; text-transform: uppercase;" />
                </div>

                <div class="panel-login-group">
                  <label class="panel-login-label" for="panel-input-loginname">Tên của bạn / Tên nhân viên</label>
                  <input type="text" id="panel-input-loginname" class="panel-login-input" placeholder="VD: Tài, Kho 1, Hằng Sales..." required autocomplete="username" />
                </div>

                <div class="panel-login-group">
                  <label class="panel-login-label" for="panel-input-pin">Mã PIN 6 Số (Tùy chọn)</label>
                  <input type="password" id="panel-input-pin" class="panel-login-input" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="6 chữ số PIN (nếu có)" autocomplete="off" style="letter-spacing: 4px; font-weight: 700;" />
                </div>

                <div class="panel-login-group">
                  <label class="panel-login-label" for="panel-input-devicename">Tên Máy Trạm Này</label>
                  <input type="text" id="panel-input-devicename" class="panel-login-input" placeholder="VD: Chrome Profile 1, Máy bàn..." />
                </div>

                <button type="submit" id="panel-btn-submit-new-pin" class="panel-login-btn" style="margin-top: 4px;">
                  🚀 Vào Ca Lên Đơn (1-Click)
                </button>
              </form>

              <!-- View 1.3: Chờ Chủ Shop Duyệt Máy -->
              <div id="panel-pending-approval-box" style="display: none; text-align: center; padding: 12px 6px;">
                <div style="font-size: 24px; margin-bottom: 6px;">⏳</div>
                <div style="font-weight: 700; font-size: 13px; color: #b45309; margin-bottom: 4px;">Thiết Bị Đang Chờ Phê Duyệt</div>
                <div style="font-size: 11px; color: var(--text-muted, #64748b); line-height: 1.4; margin-bottom: 12px;">
                  Vui lòng liên hệ Chủ Shop duyệt máy trong mục <strong>Quản Lý Thiết Bị</strong>.
                </div>
                <button type="button" id="panel-btn-check-pending" class="panel-login-btn" style="background: #16a34a; margin-bottom: 6px;">
                  🔄 Kiểm tra lại trạng thái duyệt
                </button>
                <button type="button" id="panel-btn-pending-switch" style="background: none; border: 1px solid var(--input-border, #cbd5e1); color: var(--text-muted, #64748b); border-radius: 6px; padding: 6px; width: 100%; font-size: 11px; font-weight: 600; cursor: pointer;">
                  Đăng nhập Shop khác
                </button>
              </div>
            </div>

            <!-- CONTAINER 2: CHỦ SHOP / ADMIN -->
            <form id="panel-owner-form" style="display: none; flex-direction: column; gap: 10px;">
              <div class="panel-login-group">
                <label class="panel-login-label" for="panel-input-owner-email">Email hoặc Tên đăng nhập</label>
                <input type="text" id="panel-input-owner-email" class="panel-login-input" placeholder="admin@shop.com" autocomplete="username" />
              </div>

              <div class="panel-login-group">
                <label class="panel-login-label" for="panel-input-owner-password">Mật khẩu</label>
                <input type="password" id="panel-input-owner-password" class="panel-login-input" placeholder="••••••••" autocomplete="current-password" />
              </div>

              <button type="submit" id="panel-btn-submit-owner" class="panel-login-btn" style="margin-top: 4px;">
                🔑 Đăng Nhập Quản Trị
              </button>
            </form>

            <div class="panel-login-footer" style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">
              <a id="panel-link-register" class="panel-login-link">⚙️ Mở Options (Cài đặt / Quản lý)</a>
              <a id="panel-link-admin-login" class="panel-login-link" style="font-size:11px;">🌐 Mở Trang Quản Trị</a>
            </div>
          </div>
        </div>
      `,g.appendChild(P);const te=g.getElementById("vnpost-panel-header-text");te&&(te.textContent=l.title||""),Lt(P,g.getElementById("vnpost-panel-header"));const I=g.getElementById("vnpost-btn-theme");I&&I.addEventListener("click",m=>{m.stopPropagation();const x=P.classList.toggle("light-mode");Nt(x),showVnpostToast(x?"☀️ Đã chuyển sang giao diện Sáng":"🌙 Đã chuyển sang giao diện Tối","success")}),g.getElementById("vnpost-btn-minimize").addEventListener("click",()=>{P.classList.toggle("minimized")});const r=g.getElementById("panel-tab-btn-pin"),h=g.getElementById("panel-tab-btn-owner"),q=g.getElementById("panel-pin-container"),C=g.getElementById("panel-owner-form"),B=g.getElementById("panel-login-subtitle"),b=g.getElementById("panel-login-error"),n=g.getElementById("panel-trusted-pin-form"),v=g.getElementById("panel-new-pin-form"),p=g.getElementById("panel-pending-approval-box"),L=g.getElementById("panel-trusted-staff-name"),ae=g.getElementById("panel-trusted-shop-name"),X=g.getElementById("panel-input-trusted-pin"),V=g.getElementById("panel-btn-switch-account"),K=g.getElementById("panel-input-shopcode"),pe=g.getElementById("panel-input-loginname"),Ae=g.getElementById("panel-input-pin"),xe=g.getElementById("panel-input-devicename"),u=g.getElementById("panel-btn-check-pending"),M=g.getElementById("panel-btn-pending-switch"),A=g.getElementById("panel-input-owner-email"),z=g.getElementById("panel-input-owner-password"),G=g.getElementById("panel-link-register"),fe=g.getElementById("panel-link-admin-login");let J="",j="";const Q=()=>{let m=!1;try{m=typeof chrome<"u"&&!!chrome.runtime&&!!chrome.runtime.id&&!!chrome.storage&&!!chrome.storage.local}catch{}if(m)try{chrome.storage.local.get(["last_shop_code","last_login_name","staff_name","shop_name","fbDeviceName","device_pending_approval"],x=>{try{if(chrome.runtime&&chrome.runtime.lastError)return;if(J=(x==null?void 0:x.last_shop_code)||"",j=(x==null?void 0:x.last_login_name)||"",x!=null&&x.device_pending_approval&&J){p&&(p.style.display="block"),n&&(n.style.display="none"),v&&(v.style.display="none");return}J&&j?(L&&(L.textContent=x.staff_name||j),ae&&(ae.textContent="Shop: "+(x.shop_name||J)),n&&(n.style.display="flex"),v&&(v.style.display="none"),p&&(p.style.display="none"),X&&X.focus()):(n&&(n.style.display="none"),v&&(v.style.display="flex"),p&&(p.style.display="none"))}catch{}});return}catch{}try{J=localStorage.getItem("last_shop_code")||"",j=localStorage.getItem("last_login_name")||"",J&&j?(L&&(L.textContent=localStorage.getItem("staff_name")||j),ae&&(ae.textContent="Shop: "+(localStorage.getItem("shop_name")||J)),n&&(n.style.display="flex"),v&&(v.style.display="none"),p&&(p.style.display="none"),X&&X.focus()):(n&&(n.style.display="none"),v&&(v.style.display="flex"),p&&(p.style.display="none"))}catch{}};Q(),r&&h&&(r.addEventListener("click",()=>{r.classList.add("active"),h.classList.remove("active"),q&&(q.style.display="block"),C&&(C.style.display="none"),B&&(B.textContent="Xác thực nhanh bằng mã PIN 6 số cho nhân viên."),b&&(b.style.display="none"),Q()}),h.addEventListener("click",()=>{h.classList.add("active"),r.classList.remove("active"),q&&(q.style.display="none"),C&&(C.style.display="flex"),B&&(B.textContent="Đăng nhập tài khoản Chủ shop / Quản lý với Email và Mật khẩu."),b&&(b.style.display="none")}));const Y=m=>{m&&m.preventDefault(),n&&(n.style.display="none"),p&&(p.style.display="none"),v&&(v.style.display="flex"),b&&(b.style.display="none"),K&&K.focus()};V&&V.addEventListener("click",Y),M&&M.addEventListener("click",Y),n&&(n.addEventListener("submit",async m=>{m.preventDefault();const x=((X==null?void 0:X.value)||"").trim();if(!x||x.length!==6){b&&(b.textContent="⚠️ Vui lòng nhập đúng mã PIN gồm 6 chữ số!",b.style.display="block");return}b&&(b.style.display="none");const ie=g.getElementById("panel-btn-submit-trusted-pin");ie&&(ie.disabled=!0,ie.innerHTML="⏳ Đang vào ca...");try{if(typeof AuthService<"u"&&typeof AuthService.loginWithPin=="function")await AuthService.loginWithPin({shopCode:J,loginName:j,pin:x}),showVnpostToast("🎉 Đăng nhập ca làm việc thành công!","success"),setTimeout(()=>{const oe=typeof globalThis<"u"&&globalThis.checkUrlAndInject||typeof window<"u"&&window.checkUrlAndInject;typeof oe=="function"&&oe()},80);else throw new Error("Hệ thống xác thực PIN chưa sẵn sàng.")}catch(oe){b&&(b.textContent=`❌ ${oe.message||"Mã PIN không chính xác!"}`,b.style.display="block")}finally{ie&&(ie.disabled=!1,ie.innerHTML="Đăng Nhập Vào Ca")}}),X&&X.addEventListener("input",m=>{X.value=X.value.replace(/[^0-9]/g,""),X.value.length===6&&n.dispatchEvent(new Event("submit"))})),v&&v.addEventListener("submit",async m=>{m.preventDefault();const x=((K==null?void 0:K.value)||"").trim().toUpperCase(),ie=((pe==null?void 0:pe.value)||"").trim().toLowerCase(),oe=((Ae==null?void 0:Ae.value)||"").trim(),ye=((xe==null?void 0:xe.value)||"").trim();if(!x||!ie){b&&(b.textContent="⚠️ Vui lòng nhập đầy đủ Mã Shop và Tên của bạn!",b.style.display="block");return}if(oe&&oe.length!==6){b&&(b.textContent="⚠️ Mã PIN phải bao gồm đúng 6 chữ số!",b.style.display="block");return}b&&(b.style.display="none");const Ne=g.getElementById("panel-btn-submit-new-pin");Ne&&(Ne.disabled=!0,Ne.innerHTML="⏳ Đang vào ca...");try{if(typeof AuthService<"u"&&typeof AuthService.loginWithPin=="function")await AuthService.loginWithPin({shopCode:x,loginName:ie,pin:oe||null,deviceName:ye}),showVnpostToast("🎉 Vào ca làm việc thành công!","success"),setTimeout(()=>{const Be=typeof globalThis<"u"&&globalThis.checkUrlAndInject||typeof window<"u"&&window.checkUrlAndInject;typeof Be=="function"&&Be()},80);else throw new Error("Hệ thống xác thực chưa sẵn sàng.")}catch(Be){Be.code==="DEVICE_PENDING_APPROVAL"?(v&&(v.style.display="none"),p&&(p.style.display="block"),b&&(b.style.display="none")):b&&(b.textContent=`❌ ${Be.message||"Đăng nhập thất bại!"}`,b.style.display="block")}finally{Ne&&(Ne.disabled=!1,Ne.innerHTML="🚀 Vào Ca Lên Đơn (1-Click)")}}),u&&u.addEventListener("click",async()=>{u.disabled=!0,u.innerHTML="⏳ Đang kiểm tra...";try{typeof AuthService<"u"&&typeof AuthService.loginWithPin=="function"&&await AuthService.loginWithPin({shopCode:J||(K==null?void 0:K.value),loginName:j||(pe==null?void 0:pe.value),pin:"000000"})}catch(m){m.code==="DEVICE_PENDING_APPROVAL"?b&&(b.textContent="Máy trạm vẫn đang chờ Chủ Shop duyệt trong mục Quản Lý Thiết Bị.",b.style.display="block"):m.message&&m.message.includes("PIN")?(showVnpostToast("✅ Thiết bị đã được duyệt! Vui lòng nhập mã PIN 6 số.","success"),p&&(p.style.display="none"),Q()):b&&(b.textContent=`❌ ${m.message}`,b.style.display="block")}finally{u.disabled=!1,u.innerHTML="🔄 Kiểm tra lại trạng thái duyệt"}}),C&&C.addEventListener("submit",async m=>{m.preventDefault();const x=((A==null?void 0:A.value)||"").trim(),ie=((z==null?void 0:z.value)||"").trim();if(!x||!ie){b&&(b.textContent="⚠️ Vui lòng nhập đầy đủ Email và Mật khẩu!",b.style.display="block");return}b&&(b.style.display="none");const oe=g.getElementById("panel-btn-submit-owner");oe&&(oe.disabled=!0,oe.innerHTML="⏳ Đang xác thực...");try{if(typeof AuthService<"u"&&typeof AuthService.login=="function")await AuthService.login(x,ie),showVnpostToast("🎉 Đăng nhập Chủ Shop thành công!","success"),setTimeout(()=>{const ye=typeof globalThis<"u"&&globalThis.checkUrlAndInject||typeof window<"u"&&window.checkUrlAndInject;typeof ye=="function"&&ye()},80);else throw new Error("Hệ thống xác thực chưa sẵn sàng.")}catch(ye){b&&(b.textContent=`❌ ${ye.message||"Đăng nhập thất bại!"}`,b.style.display="block")}finally{oe&&(oe.disabled=!1,oe.innerHTML="🔑 Đăng Nhập Quản Trị")}}),G&&s&&G.addEventListener("click",m=>{m.preventDefault(),s()}),fe&&fe.addEventListener("click",m=>{m.preventDefault();let x=!1;try{x=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.sendMessage}catch{}x?chrome.runtime.sendMessage({action:"openAdmin"}):window.open("https://xlgovgynbsahuykyjzcx.supabase.co/","_blank")})}catch(l){if(String((l==null?void 0:l.message)||l).includes("Extension context invalidated")){console.info("[Panel] Extension vừa được cập nhật lại, vui lòng F5 trang web.");try{let d=document.getElementById("vnpost-autofill-shadow-host");d||(d=document.createElement("div"),d.id="vnpost-autofill-shadow-host",document.body.appendChild(d));const T=d.shadowRoot||d.attachShadow({mode:"open"});T.innerHTML=`
            <div style="position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#0f172a;color:#fff;padding:12px 18px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.3);font-family:sans-serif;font-size:13px;display:flex;align-items:center;gap:12px;border:1px solid #334155;">
              <span>🔄 Extension Auto Fill Order vừa được tải lại. Vui lòng bấm để tải lại trang:</span>
              <button onclick="window.location.reload()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer;">Tải lại ngay (F5)</button>
            </div>
          `}catch{}}else console.warn("Lỗi tạo panel đăng nhập:",l)}}function pn(i,s,l){try{if(typeof document>"u")return;ht(!1);const d=ut(i);let T=document.getElementById("vnpost-autofill-shadow-host");const g=T?k("vnpost-autofill-panel"):null;if(g&&g.dataset&&g.dataset.panelType==="device-limit")return;T||(T=document.createElement("div"),T.id="vnpost-autofill-shadow-host",document.body.appendChild(T));const N=T.shadowRoot||T.attachShadow({mode:"open"}),E=N.querySelector("#vnpost-autofill-panel");E&&E.remove();const P=N.querySelector("#vnpost-dock-toggle-tab");if(P&&P.remove(),!N.querySelector("#vnpost-shadow-style")){const C=document.createElement("style");C.id="vnpost-shadow-style",C.textContent=typeof PANEL_CSS<"u"?PANEL_CSS:"",N.appendChild(C)}const f=document.createElement("div");f.id="vnpost-autofill-panel",f.dataset.panelType="device-limit",f.classList.add("panel-floating"),Tt(f);let w=!1;try{w=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(w&&chrome.storage&&chrome.storage.local)try{chrome.storage.local.get(["antigravity_ui_theme"],C=>{if(!chrome.runtime.lastError){if(C&&C.antigravity_ui_theme==="dark"){f.classList.remove("light-mode");try{localStorage.setItem("antigravity_ui_theme","dark")}catch{}}else if(C&&C.antigravity_ui_theme==="light"){f.classList.add("light-mode");try{localStorage.setItem("antigravity_ui_theme","light")}catch{}}}})}catch{}const _=d.themeColor||(d.id==="vnpost"?"#0056b3":"#4f46e5");f.style.setProperty("--theme-color",_);let te="v1";try{let C=!1;try{C=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.getManifest}catch{}C&&(te="v"+(chrome.runtime.getManifest().version||"1"))}catch{}f.innerHTML=`
        <div class="minimized-icon">${H.user}</div>
        <div id="vnpost-panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="vnpost-panel-header-text"></span>
            <span class="badge-version">${te} (Hạn ngạch)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="vnpost-btn-theme" title="Chuyển chế độ Sáng/Tối">${H.theme}</button>
            <button id="vnpost-btn-minimize">${H.minimize}</button>
          </div>
        </div>

        <div id="vnpost-panel-body">
          <div class="panel-login-box">
            <div class="panel-login-title" style="color: #ef4444; display: flex; align-items: center; gap: 6px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Vượt Giới Hạn Thiết Bị
            </div>
            <div class="panel-login-subtitle" style="margin-bottom: 12px; font-size: 12px;">
              Cửa hàng của bạn đã đạt giới hạn tối đa <strong>${s}</strong> thiết bị hoạt động đồng thời.
            </div>

            <div class="panel-login-error" style="display: block; margin-bottom: 12px; font-size: 11px;">
              Vui lòng mở Options (Cài đặt) để xem danh sách máy đang kết nối hoặc liên hệ với Chủ Shop/Quản trị viên để nâng cấp hạn ngạch.
            </div>

            <button type="button" id="panel-btn-open-settings" class="panel-login-btn" style="background-color: var(--theme-color, #4f46e5); color: #fff; margin-top: 4px;">
              💻 Quản lý thiết bị (Options)
            </button>
            
            <button type="button" id="panel-btn-logout-limit" class="panel-login-btn" style="background-color: #ef4444; color: #fff; margin-top: 8px;">
              🚪 Đăng xuất tài khoản
            </button>
          </div>
        </div>
      `,N.appendChild(f);const I=N.getElementById("vnpost-panel-header-text");I&&(I.textContent=d.title||""),Lt(f,N.getElementById("vnpost-panel-header"));const r=N.getElementById("vnpost-btn-theme");r&&r.addEventListener("click",C=>{C.stopPropagation();const B=f.classList.toggle("light-mode");Nt(B)}),N.getElementById("vnpost-btn-minimize").addEventListener("click",()=>{f.classList.toggle("minimized")});const h=N.getElementById("panel-btn-open-settings");h&&l&&h.addEventListener("click",C=>{C.preventDefault(),l()});const q=N.getElementById("panel-btn-logout-limit");q&&q.addEventListener("click",async C=>{C.preventDefault(),q.disabled=!0,q.textContent="⏳ Đang đăng xuất...";try{typeof AuthService<"u"&&typeof AuthService.logout=="function"&&(await AuthService.logout(),setTimeout(()=>{const B=typeof globalThis<"u"&&globalThis.checkUrlAndInject||typeof window<"u"&&window.checkUrlAndInject;typeof B=="function"&&B()},80))}catch(B){alert("Lỗi đăng xuất: "+B.message)}finally{q.disabled=!1,q.textContent="🚪 Đăng xuất tài khoản"}})}catch(d){console.warn("Lỗi tạo panel giới hạn thiết bị:",d)}}globalThis.createInputPanel=zt,globalThis.createLoginRequiredPanel=cn,globalThis.createDeviceLimitExceededPanel=pn,globalThis.showOrderApprovalModal=dn,globalThis.displayParsedData=Ye})();
})()