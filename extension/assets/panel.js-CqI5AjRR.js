(function(){(()=>{const H={theme:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/><path d="M12 2a10 10 0 0 0 10 10" fill="currentColor" opacity="0.3"/></svg>',settings:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',minimize:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',maximize:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',dock:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/><path d="m10 9-3 3 3 3"/></svg>',float:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',parse:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',clear:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',copy:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',check:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',user:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',phone:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',orderCode:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>',fee:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',address:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',package:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',fill:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',save:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',apiWaiting:'<svg class="spinner-loading" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',apiWarning:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',apiOk:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',apiUnknown:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',warn:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'},pt=340;function Vt(){if(typeof document>"u")return null;const i=document.getElementById("vnpost-autofill-shadow-host");return i&&i.shadowRoot?i.shadowRoot:document}function x(i){const r=Vt();return r&&r.getElementById?r.getElementById(i):null}function de(i){return String(i??"").replace(/[&<>"']/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[r])}function ut(i){if(typeof i=="string"){const r=i.toLowerCase();return r.includes("vnpost")?{id:"vnpost",title:"VNPost",themeColor:"#0056b3"}:r.includes("jt")?{id:"jt",title:"J&T Express",themeColor:"#e11d48"}:{id:r,title:r.toUpperCase(),themeColor:"#4f46e5"}}return i||{id:"vnpost",title:"VNPost",themeColor:"#0056b3"}}function Ht(i){return i?String(i).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/\s+/g,"").trim():""}function sn(){try{if((typeof localStorage<"u"?localStorage.getItem("antigravity_ui_theme"):null)==="dark")return"dark"}catch{}return"light"}function Tt(i){i&&(sn()==="dark"?i.classList.remove("light-mode"):i.classList.add("light-mode"))}function Nt(i){const r=i?"light":"dark";try{typeof localStorage<"u"&&localStorage.setItem("antigravity_ui_theme",r)}catch{}let d=!1;try{d=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(d&&chrome.storage&&chrome.storage.local)try{chrome.storage.local.set({antigravity_ui_theme:r})}catch{}}const Ge={get(i,r){try{let c=!1;try{c=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(c&&chrome.storage&&chrome.storage.local){chrome.storage.local.get(i,N=>{chrome.runtime&&chrome.runtime.lastError,r(N||{})});return}}catch{}const d={};i.forEach(c=>{try{const N=typeof localStorage<"u"?localStorage.getItem(c):null;d[c]=N?JSON.parse(N):void 0}catch{d[c]=void 0}}),r(d)},set(i){try{let r=!1;try{r=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(r&&chrome.storage&&chrome.storage.local){chrome.storage.local.set(i,()=>{chrome.runtime&&chrome.runtime.lastError});return}}catch{}typeof localStorage>"u"||Object.entries(i).forEach(([r,d])=>{try{localStorage.setItem(r,JSON.stringify(d))}catch{}})}};function qt(i,r){i&&i.classList.toggle("is-visible",!!r)}function ht(i){if(typeof document>"u"||!document.body)return;const r=document.body,d="vnpost-dock-page-offset-style";let c=document.getElementById(d);if(i){r.dataset.vnpostDockOffsetActive!=="true"&&(r.dataset.vnpostDockOriginalPaddingRight=r.style.paddingRight||"",r.dataset.vnpostDockOriginalTransition=r.style.transition||"");const N=parseFloat(window.getComputedStyle(r).paddingRight||"0")||0,g=r.dataset.vnpostDockOffsetActive==="true"?Math.max(0,N-pt):N;r.style.paddingRight=`${g+pt}px`,r.style.transition||(r.style.transition="padding-right 280ms cubic-bezier(0.4, 0, 0.2, 1)"),r.dataset.vnpostDockOffsetActive="true",c||(c=document.createElement("style"),c.id=d,(document.head||document.documentElement).appendChild(c)),c.textContent=`
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
      `;return}r.dataset.vnpostDockOffsetActive==="true"&&(r.style.paddingRight=r.dataset.vnpostDockOriginalPaddingRight||"",r.style.transition=r.dataset.vnpostDockOriginalTransition||"",delete r.dataset.vnpostDockOffsetActive,delete r.dataset.vnpostDockOriginalPaddingRight,delete r.dataset.vnpostDockOriginalTransition),c&&c.remove()}function gt(i,r,d,c,N={}){const g=c==="floating"?"floating":"docked",_=x("vnpost-btn-minimize");if(g==="docked"){i.classList.remove("panel-floating","minimized"),i.classList.add("panel-docked"),i.classList.toggle("collapsed",!!N.collapsed),i.style.top="",i.style.left="",i.style.right="",i.style.bottom="",qt(r,N.collapsed),ht(!N.collapsed),d&&(d.innerHTML=H.float,d.title="Thả nổi panel"),_&&(_.innerHTML=H.minimize,_.title="Thu vào mép phải");return}i.classList.remove("panel-docked","collapsed"),i.classList.add("panel-floating"),qt(r,!1),ht(!1),d&&(d.innerHTML=H.dock,d.title="Ghim panel vào mép phải"),_&&(_.innerHTML=i.classList.contains("minimized")?H.maximize:H.minimize,_.title="Thu nhỏ panel");const L=N.position||{},A=Number(L.top),f=Number(L.left);Number.isFinite(A)&&Number.isFinite(f)?(i.style.top=`${Math.max(0,A)}px`,i.style.left=`${Math.max(0,f)}px`,i.style.right="auto",i.style.bottom="auto"):(i.style.top="20px",i.style.right="20px",i.style.left="auto",i.style.bottom="auto")}function zt(i,r,d,c,N,g,_,L){var O,l,u,q;try{let rt=function(){if(ye&&(ye.classList.toggle("is-collapsed",he),ne&&(ne.textContent=he?"▼":"▲",ne.title=he?"Mở rộng hàng đợi":"Thu gọn hàng đợi"),Ee))if(he&&Z.length>0){const e=Z[se],t=(e==null?void 0:e.name)||"Khách lẻ",o=e!=null&&e.phone?` (${e.phone})`:"";Ee.textContent=`· Đơn ${se+1}: ${t}${o}`,Ee.style.display="inline-block"}else Ee.style.display="none"},lt=function(){if(!Z.length)return;const e=Z[se];if(e){if(mt&&(mt.textContent=`Đơn ${se+1}/${Z.length}`),$e){const t=e.name||"Khách lẻ",o=e.phone||"",a=Number(e.codAmount||e.cod_amount||e.cod)||0,p=a>0?` · COD ${a.toLocaleString("vi-VN")}đ`:"";$e.textContent=`${t} (${o})${p}`}et&&(et.disabled=se<=0),xe&&(xe.disabled=se>=Z.length-1),rt()}},Xe=function(){if(!Z.length)return;const e=Z[se];e&&(globalThis.parsedDataStore={savedOrderId:e.id,name:e.name||"",phone:e.phone||"",address:e.address||"",orderCode:e.orderCode||e.order_code||"",codAmount:Number(e.codAmount||e.cod_amount||e.cod)||0,goodsName:e.goodsName||e.goods_name||e.productItem||e.defaultGoodsName||"",weightGrams:Number(e.weightGrams||e.weight)||200,notes:e.notes||"",collectFee:!!(e.collectFee||e.collect_fee),rawAddress:e.rawAddress||e.address||"",ward:e.ward||"",district:e.district||"",province:e.province||""},M&&(M.value=e.rawText||`${e.name||""} ${e.phone||""} ${e.address||""}`),typeof Ye=="function"&&Ye(globalThis.parsedDataStore),showVnpostToast(`📥 Đã nạp đơn ${se+1}/${Z.length}: ${e.name||"Khách"}`,"info"))},Ot=function(){tn=null,Ct&&(Ct.src=""),kt&&(kt.textContent=""),xt&&(xt.style.display="none"),qe&&(qe.style.display="none")};var A=rt,f=lt,v=Xe,k=Ot;if(typeof document>"u")return;const S=ut(i);let T=document.getElementById("vnpost-autofill-shadow-host");const b=T?x("vnpost-autofill-panel"):null;if(b)if(b.dataset&&b.dataset.panelType==="login")b.remove();else return;if(!document.body)return;T||(T=document.createElement("div"),T.id="vnpost-autofill-shadow-host",document.body.appendChild(T));const n=T.shadowRoot||T.attachShadow({mode:"open"}),I=n.querySelector("#vnpost-autofill-panel");I&&I.remove();const s=n.querySelector("#vnpost-dock-toggle-tab");if(s&&s.remove(),!n.querySelector("#vnpost-shadow-style")){const e=document.createElement("style");e.id="vnpost-shadow-style",e.textContent=typeof PANEL_CSS<"u"?PANEL_CSS:"",n.appendChild(e)}const E=document.createElement("div");E.id="vnpost-autofill-panel",E.dataset.panelType="input",Tt(E);let ie=!1;try{ie=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(ie&&chrome.storage&&chrome.storage.local)try{chrome.storage.local.get(["antigravity_ui_theme"],e=>{if(!chrome.runtime.lastError){if(e&&e.antigravity_ui_theme==="dark"){E.classList.remove("light-mode");try{localStorage.setItem("antigravity_ui_theme","dark")}catch{}}else if(e&&e.antigravity_ui_theme==="light"){E.classList.add("light-mode");try{localStorage.setItem("antigravity_ui_theme","light")}catch{}}}})}catch{}const Q=S.themeColor||(S.id==="vnpost"?"#0056b3":"#4f46e5");E.style.setProperty("--theme-color",Q);const V=S.id==="vnpost",K=V?"display: inline-flex; background-color: #10b981;":"display: none;",ue=V?"display: none;":"display: inline-flex; background-color: #e11d48;";let Be="v1";try{let e=!1;try{e=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.getManifest}catch{}e&&(Be="v"+(chrome.runtime.getManifest().version||"1"))}catch{}E.innerHTML=`
        <div class="minimized-icon">${H.parse}</div>
        
        <!-- HEADER TOPBAR -->
        <div id="vnpost-panel-header">
          <div class="vnpost-header-main">
            <div class="vnpost-brand-group">
              <span class="brand-live-dot" title="Sẵn sàng hoạt động"></span>
              <span id="vnpost-panel-header-text" class="brand-title"></span>
              <span id="vnpost-panel-version-badge" class="panel-version-badge" title="Phiên bản Auto Fill Order">${Be}</span>
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
              <hr><span id="panel-menu-shop">---</span><span>${S.title||""}</span>
              <hr><div class="panel-menu-version-row" style="font-size:11px; color:#94a3b8; padding:3px 8px; font-weight:600; display:flex; justify-content:space-between; align-items:center;">
                <span>Phiên bản:</span>
                <span class="menu-version-badge" style="color:#38bdf8; font-weight:700;">${Be}</span>
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
            <button id="btnFillJT" class="btn-fill btn-fill-jt" style="${ue};" disabled>
              ${H.fill} <span>Nhập đơn</span>
            </button>
            <button id="btnAiVerify" class="btn-fill btn-ai-verify" type="button" title="Chạy AI đối soát & thẩm định nâng cao" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); flex: 1; display: none;">
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
      `,n.appendChild(E);const we=n.querySelector("#vnpost-dock-toggle-tab");we&&we.remove();const h=document.createElement("div");h.id="vnpost-dock-toggle-tab",h.textContent="AUTO FILL",h.title="Mở bảng Auto Fill",h.style.setProperty("--theme-color",Q),n.appendChild(h);const D=n.getElementById("vnpost-panel-header-text");D&&(D.textContent=S.title||"");let B="",z="";const G=()=>{try{const e=n.getElementById("panel-shop-name"),t=n.getElementById("panel-user-account"),o=n.getElementById("panel-carrier-account"),a=typeof globalThis.detectCarrierAccount=="function"?globalThis.detectCarrierAccount(S.id):"";if(e&&(z?(e.textContent=z,e.title=`Shop đang làm việc: ${z}`,e.classList.remove("context-missing")):(e.textContent="Chưa chọn Shop",e.title="Chưa xác định Shop đang làm việc",e.classList.add("context-missing"))),t){const P=B&&(B.includes("@")?B.split("@")[0]:B);t.textContent=P||"Chưa xác định tài khoản",t.title=P?`Tài khoản đăng nhập tiện ích: ${B}`:"Chưa xác định tài khoản đăng nhập Extension",t.classList.toggle("context-missing",!P)}o&&(o.textContent=a||"Chưa nhận diện tài khoản",o.title=a?`Tài khoản bưu điện trên ${S.title}: ${a}`:`Chưa nhận diện tài khoản bưu điện trên ${S.title}`,o.classList.toggle("context-missing",!a));const p=B&&(B.includes("@")?B.split("@")[0]:B),m=n.getElementById("panel-menu-user"),$=n.getElementById("panel-menu-carrier"),W=n.getElementById("panel-menu-shop");m&&(m.textContent=p||"Chưa xác định tài khoản"),$&&($.textContent=a||"Chưa nhận diện tài khoản bưu điện"),W&&(W.textContent=z||"Chưa chọn Shop")}catch{}},me=()=>{try{typeof AuthSession<"u"&&typeof AuthSession.getSession=="function"&&AuthSession.getSession().then(t=>{var o,a,p;t&&(B=((o=t.user)==null?void 0:o.full_name)||((a=t.user)==null?void 0:a.username)||((p=t.user)==null?void 0:p.email)||"",z=t.shop_name||"",G())}).catch(()=>{});let e=!1;try{e=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}e&&chrome.storage&&chrome.storage.local&&chrome.storage.local.get(["vnpost_session","activeShopName","activeShop","currentUser"],t=>{var o,a,p;if(!(chrome.runtime&&chrome.runtime.lastError)&&t){const m=t.vnpost_session;!B&&m&&(B=((o=m.user)==null?void 0:o.full_name)||((a=m.user)==null?void 0:a.username)||((p=m.user)==null?void 0:p.email)||t.currentUser||""),z||(z=(m==null?void 0:m.shop_name)||t.activeShopName||(t.activeShop?typeof t.activeShop=="object"?t.activeShop.name:"Shop #"+t.activeShop:"")),G()}})}catch{}};me(),setInterval(G,2500),setInterval(me,4e3);try{typeof chrome<"u"&&chrome.runtime&&chrome.runtime.id&&chrome.storage&&chrome.storage.onChanged&&chrome.storage.onChanged.addListener((e,t)=>{t==="local"&&(e.vnpost_session||e.activeShopName||e.activeShop||e.currentUser)&&me()})}catch{}Lt(E,n.getElementById("vnpost-panel-header"));const J=n.getElementById("vnpost-btn-dock-toggle");h.addEventListener("click",e=>{e.stopPropagation(),gt(E,h,J,"docked",{collapsed:!1}),Ge.set({panel_display_mode:"docked",panel_dock_collapsed:!1,panelMinimized:!1})}),Ge.get(["panel_display_mode","panel_dock_collapsed","panel_float_position","panelMinimized","antigravity_ui_theme"],(e={})=>{const t=e.panel_display_mode==="floating"?"floating":"docked",o=!!(e.panel_dock_collapsed||e.panel_display_mode===void 0&&e.panelMinimized);if(t==="floating"&&e.panelMinimized&&E.classList.add("minimized"),gt(E,h,J,t,{collapsed:o,position:e.panel_float_position}),e.antigravity_ui_theme!==void 0)if(e.antigravity_ui_theme==="dark"){E.classList.remove("light-mode");try{localStorage.setItem("antigravity_ui_theme","dark")}catch{}}else{E.classList.add("light-mode");try{localStorage.setItem("antigravity_ui_theme","light")}catch{}}}),n.getElementById("btnParseOrder").addEventListener("click",r);const j=n.getElementById("btnAiVerify");j&&j.addEventListener("click",()=>{typeof globalThis.handleAiVerifyManual=="function"&&globalThis.handleAiVerifyManual()}),n.getElementById("btnClearOrder").addEventListener("click",c),n.getElementById("btnFillVNPost").addEventListener("click",function(){d("vnpost")}),n.getElementById("btnFillJT").addEventListener("click",function(){d("jt")});const U=n.getElementById("panel-account-trigger"),Y=n.getElementById("panel-account-menu"),y=()=>{!Y||!U||(Y.hidden=!0,U.setAttribute("aria-expanded","false"))};U==null||U.addEventListener("click",e=>{e.stopPropagation(),Y.hidden=!Y.hidden,U.setAttribute("aria-expanded",String(!Y.hidden))}),(O=n.getElementById("panel-menu-settings"))==null||O.addEventListener("click",()=>{y(),typeof g=="function"&&g()}),(l=n.getElementById("panel-menu-logout"))==null||l.addEventListener("click",async()=>{y(),typeof AuthService<"u"&&typeof AuthService.logout=="function"&&(await AuthService.logout(),typeof globalThis.checkUrlAndInject=="function"&&globalThis.checkUrlAndInject())}),document.addEventListener("pointerdown",y),(u=n.getElementById("panel-fix-information"))==null||u.addEventListener("click",()=>{var e;(e=n.querySelector(".review-editable.is-invalid"))==null||e.focus()});const w=e=>String(e||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim(),ae=async e=>{if(typeof AuthSession>"u"||typeof AuthSession.getSession!="function"||typeof SupabaseCloud>"u")return null;const t=await AuthSession.getSession().catch(()=>null),o=await SupabaseCloud.loadConfig().catch(()=>null);if(!(t!=null&&t.active_shop_id)||!(t!=null&&t.access_token)||!(o!=null&&o.url)||!(o!=null&&o.anonKey))return null;const a=String(e||"").replace(/\D/g,"").replace(/^84(?=\d{9}$)/,"0");if(a.length<9)return null;const p={apikey:o.anonKey,Authorization:`Bearer ${t.access_token}`},m=`${String(o.url).replace(/\/$/,"")}/rest/v1`,$=new AbortController,W=setTimeout(()=>$.abort(),1200);try{const P=await fetch(`${m}/rpc/customer_hub_lookup`,{method:"POST",headers:{...p,"Content-Type":"application/json"},body:JSON.stringify({p_shop_id:t.active_shop_id,p_phone:a}),signal:$.signal});if(!P.ok)return null;const R=await P.json();if(!R)return{customer:null,orders:[],addresses:[]};const[ce,ve]=await Promise.all([fetch(`${m}/customer_order_links?shop_id=eq.${encodeURIComponent(t.active_shop_id)}&customer_id=eq.${R.id}&order=ordered_at.desc&limit=5&select=*`,{headers:p,signal:$.signal}),fetch(`${m}/customer_addresses?shop_id=eq.${encodeURIComponent(t.active_shop_id)}&customer_id=eq.${R.id}&order=successful_delivery_count.desc,last_used_at.desc&limit=3&select=*`,{headers:p,signal:$.signal})]);return{customer:R,orders:ce.ok?await ce.json():[],addresses:ve.ok?await ve.json():[]}}catch{return null}finally{clearTimeout(W)}},te=e=>{const t=n.getElementById("rev-customer-order-count");if(!t)return;const o=parseInt(e,10)||0;o>0?(t.textContent=`(${o})`,t.style.display="inline-flex",t.title=`Khách hàng này đã từng lên ${o} đơn hàng thành công`):(t.style.display="none",t.textContent="")};globalThis.setPanelCustomerOrderCountBadge=te;const Le=e=>{if(!e)return"---";try{const t=new Date(e);if(isNaN(t.getTime()))return String(e);const o=new Date,a=t.toDateString()===o.toDateString(),p=String(t.getHours()).padStart(2,"0"),m=String(t.getMinutes()).padStart(2,"0"),$=`${p}:${m}`,W=String(t.getDate()).padStart(2,"0"),P=String(t.getMonth()+1).padStart(2,"0"),R=t.getFullYear();return a?`Hôm nay ${$}`:`${$} · ${W}/${P}/${R}`}catch{return String(e)}},Ie=e=>{if(!e)return"Chưa rõ thời gian";try{const t=new Date(e);if(isNaN(t.getTime()))return String(e);const o=String(t.getHours()).padStart(2,"0"),a=String(t.getMinutes()).padStart(2,"0"),p=String(t.getSeconds()).padStart(2,"0"),m=String(t.getDate()).padStart(2,"0"),$=String(t.getMonth()+1).padStart(2,"0"),W=t.getFullYear();return`${o}:${a}:${p} ngày ${m}/${$}/${W}`}catch{return String(e)}},ke=async e=>{var on;const t=n.getElementById("customer-history-card"),o=n.getElementById("customer-history-result"),a=n.getElementById("customer-history-count");if(!t||!o)return;const p=String(e||"").trim();if(!p){t.hidden=!0,o.textContent="Chưa có thông tin khách hàng để xem lịch sử.",a&&(a.textContent="",a.hidden=!0),te(0);return}t.hidden=!1,o.replaceChildren();const m=document.createElement("div");m.className="customer-history-loading",m.textContent="⏳ Đang tải lịch sử đơn hàng...",o.appendChild(m);const $=p.replace(/\D/g,""),W=w(p),[P,R]=await Promise.all([ae(p).catch(()=>null),(async()=>{try{if(typeof OrderStorage<"u"){if(typeof OrderStorage._getSubmittedOrdersFromLocal=="function"){const C=await OrderStorage._getSubmittedOrdersFromLocal().catch(()=>[]);if(Array.isArray(C)&&C.length>0)return C}if(typeof OrderStorage.getSubmittedOrders=="function")return await OrderStorage.getSubmittedOrders().catch(()=>[])}}catch{}return[]})()]),ce=(R||[]).filter(C=>{if(!C)return!1;const re=String(C.phone||"").replace(/\D/g,""),F=w(C.name||C.customer_name||"");return $.length>=7?re===$||re.endsWith($)||$.endsWith(re):W.length>=2&&(F.includes(W)||W.includes(F))}),ve=[],nt=new Set,Te=C=>{var be,je,ct;if(!C)return;const re=String(C.orderCode||C.order_code||C.source_order_id||"").trim(),F=String(C.trackingCode||C.tracking_code||"").trim(),Ne=String(C.id||"").trim(),le=F||re||Ne;if(le&&nt.has(le))return;le&&nt.add(le);const Ce=C.submittedAt||C.submitted_at||C.ordered_at||C.createdAt||C.created_at||null,ot=Number(C.codAmount??C.cod_amount??C.cod??0),at=String(C.name||C.customer_name||((be=P==null?void 0:P.customer)==null?void 0:be.name)||"").trim(),ze=String(C.phone||((je=P==null?void 0:P.customer)==null?void 0:je.normalized_phone)||((ct=P==null?void 0:P.customer)==null?void 0:ct.phone)||"").trim(),dt=String(C.address||C.raw_address||"").trim(),Pe=String(C.carrier||C.platform||"").trim(),Fe=String(C.status||"success").trim(),Et=String(C.goods||C.productItem||C.product||C.items||"").trim(),De=String(C.note||C.extraNote||C.notes||"").trim();ve.push({id:Ne,orderCode:re,trackingCode:F,name:at,phone:ze,address:dt,codAmount:ot,carrier:Pe,status:Fe,submittedAt:Ce,goods:Et,note:De})};ce.forEach(Te),((P==null?void 0:P.orders)||[]).forEach(Te),ve.sort((C,re)=>{const F=C.submittedAt?new Date(C.submittedAt).getTime():0;return(re.submittedAt?new Date(re.submittedAt).getTime():0)-F});const X=(P==null?void 0:P.customer)||null,Ae=Math.max(Number((X==null?void 0:X.total_orders)||0),ve.length);a&&(a.textContent=`${Ae} đơn`,a.hidden=Ae===0,a.setAttribute("aria-label",`${Ae} đơn đã lên`)),te(Ae),o.replaceChildren();const Je=document.createElement("div");Je.className="customer-history-profile";const fe=document.createElement("div");fe.className="customer-history-name-row";const it=(X==null?void 0:X.name)||ce[0]&&(ce[0].name||ce[0].customer_name)||p,_t=(X==null?void 0:X.normalized_phone)||(X==null?void 0:X.phone)||$||"";fe.innerHTML=`<strong>${de(it)}</strong>${_t?`<span class="customer-history-phone"> · ${de(_t)}</span>`:""}`,Je.appendChild(fe);const Mt=document.createElement("div");Mt.className=`customer-history-summary risk-${(X==null?void 0:X.risk_level)||"safe"}`;const un={vip:"VIP",repeat:"Khách quen",churn_risk:"Ngủ đông",risk:"Cần kiểm tra",new:"Khách mới"},hn=(X==null?void 0:X.segment)||(Ae>=5?"vip":Ae>=2?"repeat":"new"),gn=Number((X==null?void 0:X.total_spent)||(X==null?void 0:X.total_cod)||ve.reduce((C,re)=>C+(re.codAmount||0),0));if(Mt.textContent=`${un[hn]||"Khách hàng"} · LTV ${gn.toLocaleString("vi-VN")} đ${X!=null&&X.is_blacklisted?` · ⚠️ CẢNH BÁO: ${X.blacklist_reason||"Danh sách đen"}`:""}`,Je.appendChild(Mt),o.appendChild(Je),ve.length>0){const C=document.createElement("div");C.className="customer-history-subheading",C.innerHTML=`<span>Đơn đã lên (${ve.length}) — Bấm vào để xem chi tiết:</span>`,o.appendChild(C);const re=document.createElement("div");re.className="customer-history-orders",ve.slice(0,10).forEach((F,Ne)=>{const le=document.createElement("div");le.className="customer-history-order is-clickable",le.setAttribute("tabindex","0"),le.setAttribute("role","button"),le.setAttribute("aria-expanded","false");const Ce=F.orderCode||F.trackingCode||`Đơn #${Ne+1}`,ot=Le(F.submittedAt),at=Number(F.codAmount||0).toLocaleString("vi-VN")+" đ",ze=(F.carrier||"").toUpperCase(),dt=document.createElement("div");dt.className="customer-history-order-summary",dt.innerHTML=`
              <div class="customer-history-order-left">
                <div class="customer-history-order-code">
                  <span class="order-code-title">Mã: ${de(Ce)}</span>
                  ${F.trackingCode&&F.trackingCode!==F.orderCode?`<span class="order-tracking-pill" title="Mã vận đơn">${de(F.trackingCode)}</span>`:""}
                </div>
                <div class="customer-history-order-meta">
                  ${ze?`<span class="order-carrier-badge carrier-${ze.toLowerCase()}">${de(ze)}</span>`:""}
                  <span class="order-time-badge" title="Thời gian lên đơn">🕒 ${de(ot)}</span>
                </div>
              </div>
              <div class="customer-history-order-right">
                <span class="customer-history-order-cod" title="Tiền COD">${de(at)}</span>
                <span class="customer-history-chevron">▾</span>
              </div>
            `;const Pe=document.createElement("div");Pe.className="customer-history-order-details",Pe.style.display="none";let Fe="";(F.name||F.phone)&&(Fe+=`
                <div class="history-detail-row">
                  <span class="history-detail-label">👤 Khách:</span>
                  <span class="history-detail-val"><strong>${de(F.name||"Người nhận")}</strong> ${F.phone?`(${de(F.phone)})`:""}</span>
                </div>`),F.address&&(Fe+=`
                <div class="history-detail-row history-detail-addr-row">
                  <span class="history-detail-label">📍 Địa chỉ:</span>
                  <div class="history-detail-addr-wrap">
                    <span class="history-detail-val">${de(F.address)}</span>
                    <button type="button" class="btn-history-apply-addr" title="Điền địa chỉ này vào đơn hiện tại">
                      ✨ Áp dụng địa chỉ này
                    </button>
                  </div>
                </div>`),F.goods&&(Fe+=`
                <div class="history-detail-row">
                  <span class="history-detail-label">📦 Hàng:</span>
                  <span class="history-detail-val">${de(F.goods)}</span>
                </div>`),F.note&&(Fe+=`
                <div class="history-detail-row">
                  <span class="history-detail-label">📝 Ghi chú:</span>
                  <span class="history-detail-val">${de(F.note)}</span>
                </div>`),Fe+=`
              <div class="history-detail-row history-detail-timing">
                <span class="history-detail-label">⏰ Ngày giờ:</span>
                <span class="history-detail-val">${de(Ie(F.submittedAt))}</span>
              </div>`,Pe.innerHTML=Fe;const Et=Pe.querySelector(".btn-history-apply-addr");Et&&F.address&&Et.addEventListener("click",De=>{var an;De.stopPropagation();let be=F.address;typeof AddressSanitizer<"u"&&typeof AddressSanitizer.deduplicate=="function"&&(be=AddressSanitizer.deduplicate(be));const je=n.getElementById("rev-address"),ct=n.getElementById("rev-raw-address");je&&(je.textContent=be),ct&&(ct.textContent=be),globalThis.parsedDataStore&&(globalThis.parsedDataStore.address=be),typeof refreshAddressSuggestion=="function"&&refreshAddressSuggestion(be,((an=globalThis.parsedDataStore)==null?void 0:an.phone)||""),typeof showVnpostToast=="function"&&showVnpostToast(`✨ Đã áp dụng địa chỉ từ đơn trước (${Ce})!`,"success")}),le.addEventListener("click",De=>{if(De.target.closest(".btn-history-apply-addr"))return;const be=Pe.style.display!=="none";Pe.style.display=be?"none":"grid",le.classList.toggle("is-expanded",!be),le.setAttribute("aria-expanded",String(!be));const je=le.querySelector(".customer-history-chevron");je&&(je.textContent=be?"▾":"▴")}),le.addEventListener("keydown",De=>{(De.key==="Enter"||De.key===" ")&&(De.preventDefault(),le.click())}),le.append(dt,Pe),re.appendChild(le)}),o.appendChild(re)}else{const C=document.createElement("div");C.className="customer-history-no-orders",C.textContent="Chưa tìm thấy đơn hàng nào đã từng lên của khách hàng này.",o.appendChild(C)}if((on=P==null?void 0:P.addresses)!=null&&on.length){const C=document.createElement("div");C.className="customer-history-addresses";const re=document.createElement("span");re.className="customer-history-address-title",re.textContent="Địa chỉ từng giao — bấm để áp dụng",C.appendChild(re),P.addresses.forEach(F=>{const Ne=document.createElement("button");Ne.type="button",Ne.className="customer-history-address-option",Ne.textContent=`${F.raw_address} · ${F.use_count||1} lần`,Ne.addEventListener("click",le=>{var ze;le.stopPropagation();let Ce=F.raw_address||F.normalized_address;if(!Ce)return;typeof AddressSanitizer<"u"&&typeof AddressSanitizer.deduplicate=="function"&&(Ce=AddressSanitizer.deduplicate(Ce));const ot=n.getElementById("rev-address"),at=n.getElementById("rev-raw-address");ot&&(ot.textContent=Ce),at&&(at.textContent=Ce),globalThis.parsedDataStore&&(globalThis.parsedDataStore.address=Ce),typeof refreshAddressSuggestion=="function"&&refreshAddressSuggestion(Ce,((ze=globalThis.parsedDataStore)==null?void 0:ze.phone)||""),typeof showVnpostToast=="function"&&showVnpostToast("Đã áp dụng địa chỉ lịch sử theo lựa chọn của bạn.","success")}),C.appendChild(Ne)}),o.appendChild(C)}};globalThis.lookupPanelCustomerHistory=ke;const oe=n.getElementById("customer-history-search"),pe=n.getElementById("customer-history-search-row"),Se=n.getElementById("customer-history-search-toggle");Se==null||Se.addEventListener("click",e=>{if(e.stopPropagation(),!pe)return;const t=pe.style.display==="none";pe.style.display=t?"grid":"none",t&&oe&&oe.focus()}),(q=n.getElementById("customer-history-search-btn"))==null||q.addEventListener("click",()=>ke(oe==null?void 0:oe.value)),oe==null||oe.addEventListener("keydown",e=>{e.key==="Enter"&&(e.preventDefault(),ke(oe.value))});const st=n.getElementById("address-accordion-btn"),Me=n.getElementById("address-accordion-content");st&&Me&&st.addEventListener("click",e=>{e.stopPropagation();const t=Me.style.display!=="none";Me.style.display=t?"none":"flex",st.classList.toggle("open",!t)});const Re=n.getElementById("btn-switch-clean"),Ke=n.getElementById("btn-switch-2level"),Ue=e=>{const t=e?"rev-suggest-2level":"rev-suggest-clean",o=n.getElementById(t),a=o?o.textContent.trim():"";if(a&&typeof N=="function"){N(a),Re&&Ke&&(Re.classList.toggle("active",!e),Ke.classList.toggle("active",e));const p=n.getElementById("address-reference-disclosure")||n.querySelector(".address-reference-disclosure");p&&(p.style.display=e?"none":"");const m=n.getElementById("address-status-badge");m&&(m.textContent=e?"🎯 Địa chỉ 2 Cấp":"✓ Đã tối ưu",m.title=e?"Địa chỉ được nhận diện theo chuẩn 2 cấp (không chèn quận).":"Địa chỉ chuẩn hóa 3 cấp đầy đủ."),showVnpostToast(e?"🎯 Đã áp dụng địa chỉ 2 cấp mới":"✨ Đã chọn địa chỉ 3 cấp đầy đủ","success")}};Re&&Re.addEventListener("click",e=>{e.stopPropagation(),Ue(!1)}),Ke&&Ke.addEventListener("click",e=>{e.stopPropagation(),Ue(!0)}),n.querySelectorAll(".address-reference-option").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation(),Ue(e.dataset.addressFormat==="2level")})}),n.querySelectorAll(".copy-btn").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation();const o=e.getAttribute("data-copy"),a=o?n.getElementById(o):null;if(a){const p=a.textContent.trim();p&&navigator.clipboard.writeText(p).then(()=>{const m=e.innerHTML;e.innerHTML=H.check,setTimeout(()=>{e.innerHTML=m},1500),showVnpostToast("📋 Đã sao chép: "+p.substring(0,40)+(p.length>40?"...":""),"success")}).catch(()=>{showVnpostToast("❌ Không thể sao chép","error")})}})}),typeof L=="function"&&n.getElementById("btnSaveOrder").addEventListener("click",L),typeof g=="function"&&n.getElementById("vnpost-btn-settings").addEventListener("click",g),J&&J.addEventListener("click",e=>{e.stopPropagation();const t=E.classList.contains("panel-docked")?"floating":"docked",o=t==="floating"?{top:Math.max(20,E.offsetTop||20),left:Math.max(20,window.innerWidth-400)}:null;gt(E,h,J,t,{collapsed:!1,position:o}),Ge.set({panel_display_mode:t,panel_dock_collapsed:!1,panelMinimized:!1,...o?{panel_float_position:o}:{}})});const We=n.getElementById("vnpost-btn-theme");We&&We.addEventListener("click",e=>{e.stopPropagation();const t=E.classList.toggle("light-mode");Nt(t),showVnpostToast(t?"☀️ Đã chuyển sang giao diện Sáng":"🌙 Đã chuyển sang giao diện Tối","success")});const M=n.getElementById("rawOrderText"),ye=n.getElementById("vnpost-draft-queue"),_e=n.getElementById("draft-queue-badge"),Ee=n.getElementById("draft-queue-mini-summary"),ne=n.getElementById("btn-draft-queue-toggle-collapse"),mt=n.getElementById("draft-current-index"),$e=n.getElementById("draft-current-summary"),et=n.getElementById("btn-draft-prev"),xe=n.getElementById("btn-draft-next"),Ve=n.getElementById("btn-draft-load"),Gt=n.getElementById("btn-draft-fill-next"),Rt=n.getElementById("btn-draft-delete"),Kt=n.getElementById("btn-draft-clear-all"),Ut=n.getElementById("btn-draft-queue-clear");let Z=[],se=0,he=!1,It=-1;async function He(){var e,t,o,a;if(ye)try{let p=!0;try{if(typeof chrome<"u"&&((e=chrome.storage)!=null&&e.local)){const R=await new Promise(ce=>chrome.storage.local.get(["draft_queue_enabled","draft_queue_collapsed"],ce));R&&R.draft_queue_enabled!==void 0&&(p=!!R.draft_queue_enabled),R&&R.draft_queue_collapsed!==void 0&&(he=!!R.draft_queue_collapsed)}else{const R=localStorage.getItem("draft_queue_enabled");R!==null&&(p=R==="true");const ce=localStorage.getItem("draft_queue_collapsed");ce!==null&&(he=ce==="true")}}catch{}if(typeof OrderStorage>"u"||typeof OrderStorage.getOrders!="function")return;typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),Z=(await OrderStorage.getOrders()||[]).filter(R=>R&&!R.submittedAt&&!R.trackingCode&&!R.tracking_code);const $=n.getElementById("header-draft-count-badge"),W=n.getElementById("vnpost-btn-toggle-draft-queue");if($&&(Z.length>0?($.textContent=String(Z.length),$.style.display="inline-flex",$.classList.add("has-drafts-pulse"),W&&(W.classList.add("has-drafts-active"),W.title=`Hàng đợi có ${Z.length} đơn nháp sẵn sàng lên đơn`)):($.style.display="none",$.classList.remove("has-drafts-pulse"),W&&(W.classList.remove("has-drafts-active"),W.title="Bật / Tắt Hàng đợi đơn nháp"))),Z.length===0){ye.style.display="none",_e&&(_e.textContent="0 đơn"),se=0,It=0,(t=globalThis.parsedDataStore)!=null&&t.savedOrderId&&(globalThis.parsedDataStore=null,M&&(M.value=""),typeof globalThis.resetSourceOrderCard=="function"&&globalThis.resetSourceOrderCard());return}if(It!==Z.length&&(It=Z.length,typeof showVnpostToast=="function"&&showVnpostToast(`📥 Hàng đợi: Có ${Z.length} đơn nháp sẵn sàng lên đơn!`,"info")),!p){p=!0;try{typeof chrome<"u"&&((o=chrome.storage)!=null&&o.local)&&chrome.storage.local.set({draft_queue_enabled:!0}),localStorage.setItem("draft_queue_enabled","true")}catch{}}se>=Z.length&&(se=Math.max(0,Z.length-1)),ye.style.display="flex",_e&&(_e.textContent=`${Z.length} đơn`);const P=(a=globalThis.parsedDataStore)==null?void 0:a.savedOrderId;P&&!Z.some(R=>R.id===P)&&Xe(),lt(),rt()}catch(p){console.warn("refreshDraftQueue error",p)}}et&&et.addEventListener("click",e=>{e.stopPropagation(),se>0&&(se--,lt(),Xe())}),xe&&xe.addEventListener("click",e=>{e.stopPropagation(),se<Z.length-1&&(se++,lt(),Xe())}),Ve&&Ve.addEventListener("click",e=>{e.stopPropagation(),Xe()}),Gt&&Gt.addEventListener("click",e=>{e.stopPropagation(),Xe();const o=(S.id||"vnpost")==="vnpost"?n.getElementById("btnFillVNPost"):n.getElementById("btnFillJT");o&&!o.disabled&&(o.click(),showVnpostToast(`⚡ Đang điền đơn ${se+1}...`,"info"),se<Z.length-1&&setTimeout(()=>{se++,lt(),Xe()},1200))}),Rt&&Rt.addEventListener("click",async e=>{var o;if(e.stopPropagation(),!Z.length)return;const t=Z[se];if(t&&confirm(`Xóa đơn nháp của "${t.name||t.phone||"khách này"}" khỏi hàng đợi?`))try{if(typeof OrderStorage<"u"&&typeof OrderStorage.deleteOrder=="function"){await OrderStorage.deleteOrder(t.id),typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),showVnpostToast("🗑️ Đã xóa 1 đơn khỏi hàng đợi.","success");try{typeof chrome<"u"&&((o=chrome.runtime)!=null&&o.sendMessage)&&chrome.runtime.sendMessage({action:"draftOrdersUpdated",source:"panel"},()=>{chrome.runtime.lastError}),window.dispatchEvent(new CustomEvent("draft-queue-updated"))}catch{}await He()}}catch(a){showVnpostToast("Lỗi khi xóa đơn: "+a.message,"error")}}),Kt&&Kt.addEventListener("click",async e=>{var o;if(e.stopPropagation(),!Z.length)return;const t=Z.length;if(confirm(`Bạn có chắc muốn xóa sạch toàn bộ ${t} đơn nháp khỏi hàng đợi?`))try{if(typeof OrderStorage<"u"){const a=Z.map(p=>p.id).filter(Boolean);if(typeof OrderStorage.deleteBulkOrders=="function")await OrderStorage.deleteBulkOrders(a);else if(typeof OrderStorage.deleteOrder=="function")for(const p of a)await OrderStorage.deleteOrder(p);typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),showVnpostToast(`🧹 Đã dọn sạch ${t} đơn nháp khỏi hàng đợi!`,"success");try{typeof chrome<"u"&&((o=chrome.runtime)!=null&&o.sendMessage)&&chrome.runtime.sendMessage({action:"draftOrdersUpdated",source:"panel"},()=>{chrome.runtime.lastError}),window.dispatchEvent(new CustomEvent("draft-queue-updated"))}catch{}await He()}}catch(a){showVnpostToast("Lỗi khi dọn hàng đợi: "+a.message,"error")}}),ne&&ne.addEventListener("click",async e=>{var t;e.stopPropagation(),he=!he,rt();try{typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local)&&await chrome.storage.local.set({draft_queue_collapsed:he});try{localStorage.setItem("draft_queue_collapsed",String(he))}catch{}}catch{}}),Ut&&Ut.addEventListener("click",async e=>{var t;e.stopPropagation();try{typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local)&&await chrome.storage.local.set({draft_queue_enabled:!1});try{localStorage.setItem("draft_queue_enabled","false")}catch{}}catch{}ye.style.display="none",showVnpostToast("Đã ẩn Hàng đợi đơn nháp. Bấm biểu tượng 📥 trên thanh tiêu đề để bật lại.","info")});const Wt=n.getElementById("vnpost-btn-toggle-draft-queue");Wt&&Wt.addEventListener("click",async e=>{var t,o;e.stopPropagation();try{if(ye.style.display==="none"){typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local)&&await chrome.storage.local.set({draft_queue_enabled:!0,draft_queue_collapsed:!1});try{localStorage.setItem("draft_queue_enabled","true"),localStorage.setItem("draft_queue_collapsed","false")}catch{}he=!1,showVnpostToast("✅ Đã BẬT Hàng đợi đơn nháp","info"),await He()}else{he=!he,rt(),typeof chrome<"u"&&((o=chrome.storage)!=null&&o.local)&&await chrome.storage.local.set({draft_queue_collapsed:he});try{localStorage.setItem("draft_queue_collapsed",String(he))}catch{}showVnpostToast(he?"▾ Đã thu gọn hàng đợi":"▴ Đã mở rộng hàng đợi","info")}}catch(a){console.warn("Lỗi toggle draft queue",a)}}),typeof chrome<"u"&&chrome.storage&&chrome.storage.onChanged&&chrome.storage.onChanged.addListener((e,t)=>{t==="local"&&Object.keys(e).some(a=>a.includes("savedOrders")||a.includes("orders")||a.includes("draft")||a==="vnpost_orders"||a==="draft_queue_updated_at"||a==="draft_queue_enabled"||a==="draft_queue_collapsed")&&(typeof OrderStorage<"u"&&typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),He())}),window.addEventListener("storage",e=>{e.key&&(e.key.includes("savedOrders")||e.key.includes("orders")||e.key.includes("draft")||e.key==="draft_queue_enabled"||e.key==="draft_queue_collapsed")&&(typeof OrderStorage<"u"&&typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),He())}),window.addEventListener("draft-queue-updated",()=>{typeof OrderStorage<"u"&&typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),He()}),typeof chrome<"u"&&chrome.runtime&&chrome.runtime.onMessage&&chrome.runtime.onMessage.addListener(e=>{e&&(e.action==="draftOrdersUpdated"||e.action==="ordersUpdated"||e.action==="refreshDraftQueue")&&(typeof OrderStorage<"u"&&typeof OrderStorage._invalidateOrdersCache=="function"&&OrderStorage._invalidateOrdersCache(),He())}),setTimeout(He,500);const ge=n.getElementById("source-order-card"),yt=n.getElementById("source-expanded-content"),Qe=n.getElementById("source-collapsed-preview"),Xt=n.getElementById("source-preview-primary"),vt=n.getElementById("source-preview-address"),Qt=n.getElementById("source-dirty-badge"),Zt=n.getElementById("source-dirty-message"),Ze=n.getElementById("btn-edit-source");let bt=!1,Jt=!1,At=!1,Bt={};const $t=e=>{Jt=e,ge==null||ge.classList.toggle("source-dirty",e),Qt&&(Qt.style.display=e?"inline-flex":"none"),Zt&&(Zt.style.display=e?"block":"none");const t=n.querySelector("#btnParseOrder span");t&&(t.textContent=e?"Bóc tách lại":"Tách Đơn Tự Động")},wt=()=>{yt&&(yt.style.display="block"),Qe&&(Qe.style.display="none"),Ze&&(Ze.style.display="none"),ge&&(ge.classList.remove("is-collapsed"),ge.setAttribute("aria-expanded","true"));const e=n.getElementById("panel-duplicate-alert");e&&(e.style.display="none"),window.setTimeout(()=>M==null?void 0:M.focus(),0)},Yt=(e={})=>{Bt=e;const t=(M==null?void 0:M.value.trim())||"";Xt&&(Xt.textContent="Nội dung đơn hàng gốc"),vt&&(vt.textContent=t||"Chưa có nội dung"),yt&&(yt.style.display="none"),Qe&&(Qe.style.display="flex"),Ze&&(Ze.style.display="inline-flex"),ge&&(ge.classList.add("is-collapsed"),ge.setAttribute("aria-expanded","false")),bt=!0,$t(!1)};globalThis.collapseSourceOrderCard=Yt,globalThis.expandSourceOrderCard=wt;const xt=n.getElementById("panel-image-paste-preview"),Ct=n.getElementById("panel-pasted-img"),kt=n.getElementById("panel-pasted-img-info"),en=n.getElementById("btn-remove-pasted-img"),qe=n.getElementById("panel-image-ocr-status"),tt=n.getElementById("panel-image-ocr-status-text");let tn=null;en&&en.addEventListener("click",e=>{e.stopPropagation(),Ot(),showVnpostToast("🗑️ Đã gỡ bỏ ảnh đơn hàng.","info")});async function pn(e){var Je;let t=null;try{typeof AuthSession<"u"&&typeof AuthSession.getSession=="function"&&(t=await AuthSession.getSession())}catch{}let o="",a="";try{if(typeof chrome<"u"&&((Je=chrome.storage)!=null&&Je.local)){const fe=await new Promise(it=>chrome.storage.local.get(["custom_gemini_api_key","custom_vision_api_key"],it));a=(fe==null?void 0:fe.custom_gemini_api_key)||"",o=(fe==null?void 0:fe.custom_vision_api_key)||""}}catch{}const p=await new Promise(fe=>{var it;typeof chrome<"u"&&((it=chrome.runtime)!=null&&it.sendMessage)?chrome.runtime.sendMessage({action:"runGeminiVision",imageBase64:e,token:(t==null?void 0:t.access_token)||(t==null?void 0:t.shop_access_key),shopKey:t==null?void 0:t.shop_access_key,shopId:t==null?void 0:t.active_shop_id,deviceId:t==null?void 0:t.device_id,customApiKey:a},_t=>{chrome.runtime.lastError?fe({ok:!1,error:chrome.runtime.lastError.message}):fe(_t||{ok:!1,error:"Không nhận được phản hồi từ Gemini Vision"})}):fe({ok:!1,error:"Extension runtime không khả dụng."})});if(!p||!p.ok)throw new Error((p==null?void 0:p.error)||"Gemini Vision không bóc tách được đơn hàng từ ảnh.");const m=p.result||{},$=String(m.name||"").trim(),W=String(m.phone||"").trim(),P=String(m.orderCode||"").trim(),R=parseInt(String(m.codAmount||0).replace(/\D/g,""),10)||0,ce=String(m.correctAddress||m.address||"").trim(),ve=String(m.productItem||"").trim(),nt=String(m.extraNote||"").trim(),Te=[];$&&Te.push(`Khách hàng: ${$}`),W&&Te.push(`SĐT: ${W}`),ce&&Te.push(`Địa chỉ: ${ce}`),R>0&&Te.push(`Thu hộ COD: ${R.toLocaleString("vi-VN")} đ`),P&&Te.push(`Mã đơn: ${P}`),ve&&Te.push(`Hàng hóa: ${ve}`),nt&&Te.push(`Ghi chú: ${nt}`);const X=Te.join(`
`);M&&(M.value=X,M.dispatchEvent(new Event("input",{bubbles:!0})),M.dispatchEvent(new Event("change",{bubbles:!0})));const Ae={name:$,phone:W,orderCode:P,codAmount:R,address:ce,productItem:ve,extraNote:nt,imageThumbnail:e,rawText:X,addressParts:{ward:"",district:"",province:""}};globalThis.parsedDataStore=Ae,globalThis.__AF_INITIAL_PARSED_DATA__=JSON.parse(JSON.stringify(Ae)),globalThis.__AF_RAW_ORDER_INPUT__=X,typeof Ye=="function"&&Ye(Ae),ce&&typeof globalThis.refreshAddressSuggestion=="function"&&globalThis.refreshAddressSuggestion(ce,W).catch(()=>{}),qe&&tt&&(tt.textContent=`✅ Bóc tách ảnh thành công (${p.model||"Gemini Flash"})!`,setTimeout(()=>{qe&&(qe.style.display="none")},3500)),showVnpostToast(`✨ Đã nhận diện đơn từ ảnh bằng ${p.model||"Gemini Vision"}!`,"success",4e3)}async function St(e){if(!e||!e.type.startsWith("image/"))return;const t=new FileReader;t.onload=async o=>{const a=o.target.result;if(tn=a,Ct&&(Ct.src=a),kt){const p=Math.round(e.size/1024);kt.textContent=`${e.name||"Ảnh dán"} · ${p} KB`}xt&&(xt.style.display="block"),qe&&tt&&(qe.style.display="flex",tt.textContent="🚀 Đang nhận diện chữ & bóc tách qua Gemini Vision..."),showVnpostToast("🖼️ Đã nhận ảnh! Đang kích hoạt Gemini Vision bóc tách...","info",3e3);try{await pn(a)}catch(p){console.error("[Panel Image Parse] Error:",p),qe&&tt&&(tt.textContent="⚠️ "+(p.message||"Lỗi bóc tách ảnh")),showVnpostToast("❌ "+(p.message||"Lỗi bóc tách ảnh"),"error",5e3)}},t.readAsDataURL(e)}globalThis.resetSourceOrderCard=()=>{bt=!1,$t(!1),Ot(),M&&(M.value=""),Bt={},vt&&(vt.textContent="---"),wt();const e=n.getElementById("review-panel"),t=n.getElementById("panel-empty-state"),o=n.getElementById("panel-validation-error"),a=n.getElementById("panel-duplicate-alert");e&&(e.style.display="none"),t&&(t.hidden=!1),o&&(o.hidden=!0),a&&(a.style.display="none");const p=n.getElementById("customer-history-card");p&&(p.hidden=!0),typeof te=="function"&&te(0),ft(null)},window.addEventListener("autofill:clear-order",()=>{globalThis.parsedDataStore=null,typeof globalThis.resetSourceOrderCard=="function"&&globalThis.resetSourceOrderCard()}),Qe==null||Qe.addEventListener("click",wt),Ze==null||Ze.addEventListener("click",e=>{e.stopPropagation(),wt()});const nn=n.getElementById("btn-close-duplicate-alert");nn&&nn.addEventListener("click",e=>{e.stopPropagation();const t=n.getElementById("panel-duplicate-alert");t&&(t.style.display="none")}),document.addEventListener("pointerdown",e=>{if(!(!bt||At||(ge==null?void 0:ge.getAttribute("aria-expanded"))!=="true"||(typeof e.composedPath=="function"?e.composedPath():[]).includes(ge))){if(!Jt){Yt(Bt);return}At=!0,window.setTimeout(async()=>{try{await r()}finally{At=!1}},0)}},!0),M&&(M.addEventListener("focus",()=>{M.style.borderColor=Q,M.style.boxShadow=`0 0 0 3px ${Q}1a`}),M.addEventListener("blur",()=>{M.style.borderColor="rgba(255,255,255,0.08)",M.style.boxShadow="none"}),M.addEventListener("keydown",e=>{(e.ctrlKey||e.metaKey)&&e.key==="Enter"&&(e.preventDefault(),r())}),M.addEventListener("input",()=>{const e=n.getElementById("panel-duplicate-alert");e&&(e.style.display="none"),bt&&$t(!0)}),M.addEventListener("paste",e=>{var a,p;const t=(a=e.clipboardData)==null?void 0:a.items;if(t&&t.length>0){for(let m=0;m<t.length;m++)if(t[m].type&&t[m].type.startsWith("image/")){const $=t[m].getAsFile();if($){e.preventDefault(),e.stopPropagation(),St($);return}}}const o=(p=e.clipboardData)==null?void 0:p.files;if(o&&o.length>0){for(let m=0;m<o.length;m++)if(o[m].type&&o[m].type.startsWith("image/")){e.preventDefault(),e.stopPropagation(),St(o[m]);return}}}),["dragenter","dragover"].forEach(e=>{M.addEventListener(e,t=>{t.preventDefault(),t.stopPropagation(),M.classList.add("is-dragover")})}),["dragleave","drop"].forEach(e=>{M.addEventListener(e,t=>{t.preventDefault(),t.stopPropagation(),M.classList.remove("is-dragover")})}),M.addEventListener("drop",e=>{var o;const t=(o=e.dataTransfer)==null?void 0:o.files;if(t&&t.length>0){for(let a=0;a<t.length;a++)if(t[a].type&&t[a].type.startsWith("image/")){St(t[a]);return}}})),ge==null||ge.addEventListener("paste",e=>{var t;if(e.target!==M){const o=(t=e.clipboardData)==null?void 0:t.items;if(o&&o.length>0){for(let a=0;a<o.length;a++)if(o[a].type&&o[a].type.startsWith("image/")){const p=o[a].getAsFile();if(p){e.preventDefault(),e.stopPropagation(),St(p);return}}}}});const Pt={"rev-name":"name","rev-phone":"phone","rev-code":"orderCode","rev-address":"address","rev-cod":"codAmount"};Object.keys(Pt).forEach(e=>{const t=n.getElementById(e);if(!t)return;const o=()=>{var a;if(typeof _=="function"){const p=Pt[e];let m=t.textContent.trim(),$=m;p==="codAmount"?$=parseInt(m.replace(/\D/g,""),10)||0:p==="orderCode"&&(typeof getCurrentPlatform=="function"?((a=getCurrentPlatform())==null?void 0:a.id)||getCurrentPlatform():"vnpost")==="vnpost"&&m&&/\d/.test(m)&&($=Ht(m),t.textContent!==$&&(t.textContent=$));try{const W=globalThis.__AF_INITIAL_PARSED_DATA__&&globalThis.__AF_INITIAL_PARSED_DATA__[p]||"";if(W&&String(W).trim()!==String($).trim()&&typeof AddressLearning<"u"&&typeof AddressLearning.recordUserCorrection=="function"){const P=globalThis.__AF_RAW_ORDER_INPUT__||(n.getElementById("rawOrderText")?n.getElementById("rawOrderText").value:""),R=globalThis.parsedDataStore&&globalThis.parsedDataStore.phone||"";AddressLearning.recordUserCorrection({field:p,originalValue:W,correctedValue:$,rawText:P,phone:R}).catch(()=>{})}}catch{}Promise.resolve(_(p,$)).finally(()=>ft(globalThis.parsedDataStore))}};t.addEventListener("blur",o),t.addEventListener("input",()=>{if(globalThis.parsedDataStore){const a=Pt[e];let p=t.textContent.trim(),m=p;a==="codAmount"&&(m=parseInt(p.replace(/\D/g,""),10)||0),globalThis.parsedDataStore[a]=m,ft(globalThis.parsedDataStore)}}),t.addEventListener("keydown",a=>{a.key==="Enter"&&(a.preventDefault(),t.blur())})});const Dt=n.getElementById("vnpost-btn-minimize");Dt.addEventListener("click",e=>{if(e.stopPropagation(),E.classList.contains("panel-docked")){gt(E,h,J,"docked",{collapsed:!0}),Ge.set({panel_display_mode:"docked",panel_dock_collapsed:!0,panelMinimized:!1});return}E.classList.add("minimized"),Dt.innerHTML=H.maximize,Ge.set({panel_display_mode:"floating",panelMinimized:!0})}),E.addEventListener("click",e=>{E.classList.contains("panel-floating")&&E.classList.contains("minimized")&&(E.classList.remove("minimized"),Dt.innerHTML=H.minimize,Ge.set({panel_display_mode:"floating",panelMinimized:!1}))});const Oe=n.getElementById("vnpost-api-status");if(Oe){let a=function(m=!1){return typeof OrderStorage<"u"?OrderStorage.getCacheValue("activeShop")?(Oe.innerHTML=H.apiOk,Oe.title="AI Gateway: Đã kết nối",o&&(clearInterval(o),o=null),!0):(m?(Oe.innerHTML=H.apiWarning,Oe.title="Chưa chọn Shop — không thể dùng AI"):(Oe.innerHTML=H.apiWaiting,Oe.title="Đang kiểm tra kết nối AI Gateway..."),!1):(Oe.innerHTML=H.apiUnknown,Oe.title="Không thể kiểm tra",o&&(clearInterval(o),o=null),!0)};var ee=a;let e=0;const t=30;let o=null;a(!1)||(o=setInterval(()=>{e++,(a(e>=t)||e>=t)&&o&&(clearInterval(o),o=null)},300)),typeof chrome<"u"&&chrome.storage&&chrome.storage.onChanged&&chrome.storage.onChanged.addListener((m,$)=>{const W=Object.keys(m).some(P=>P.startsWith("groqApiKey")||P.startsWith("activeShop"));$==="local"&&W&&(o&&(clearInterval(o),o=null),a(!0))})}(function(){const t=n.getElementById("panel-device-name");if(typeof FirebaseCloud>"u")return;const o=()=>{try{let a=FirebaseCloud.deviceName||"";if(!a||a==="Máy không tên"||a.startsWith("dev_")){let p=!1;try{p=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}p&&chrome.storage&&chrome.storage.local&&chrome.storage.local.get(["fbDeviceName"],m=>{chrome.runtime&&chrome.runtime.lastError||m&&m.fbDeviceName&&m.fbDeviceName!=="Máy không tên"&&!m.fbDeviceName.startsWith("dev_")&&t&&(t.textContent="💻 "+m.fbDeviceName,t.style.display="inline")});return}t&&(t.textContent="💻 "+a,t.style.display="inline")}catch{}};(async()=>{try{if(!FirebaseCloud.isConnected){await FirebaseCloud.signIn();try{await FirebaseCloud.registerDevice()}catch{}}o()}catch{}})(),typeof chrome<"u"&&chrome.storage&&chrome.storage.onChanged.addListener(a=>{a.fbDeviceName&&o()})})()}catch(S){console.error(S)}}function Lt(i,r){if(typeof window>"u"||!i||!r)return;let d=0,c=0,N=0,g=0;i.addEventListener("mousedown",L=>{i.classList.contains("panel-floating")&&i.classList.contains("minimized")&&_(L)}),r.onmousedown=function(L){i.classList.contains("panel-floating")&&(L.target.id==="vnpost-btn-minimize"||L.target.id==="vnpost-btn-settings"||L.target.id==="vnpost-btn-theme"||L.target.id==="vnpost-btn-dock-toggle"||_(L))};function _(L){L=L||window.event;const A=L.clientX,f=L.clientY;let v=!1;N=L.clientX,g=L.clientY,document.onmouseup=function(k){document.onmouseup=null,document.onmousemove=null,v&&i.classList.contains("minimized")&&(k.stopPropagation(),k.preventDefault()),v&&i.classList.contains("panel-floating")&&Ge.set({panel_float_position:{top:i.offsetTop,left:i.offsetLeft}})},document.onmousemove=function(k){k=k||window.event,k.preventDefault(),Math.sqrt(Math.pow(k.clientX-A,2)+Math.pow(k.clientY-f,2))>4&&(v=!0),d=N-k.clientX,c=g-k.clientY,N=k.clientX,g=k.clientY;let O=i.offsetTop-c,l=i.offsetLeft-d;const u=window.innerHeight-50,q=window.innerWidth-50;O<0&&(O=0),O>u&&(O=u),l<0&&(l=0),l>q&&(l=q),i.style.top=O+"px",i.style.left=l+"px",i.style.right="auto"}}}function Ft(i,r={}){const d=x("rev-ai-confidence");if(d){if(i==="hidden"){d.style.display="none";return}if(d.style.display="inline-flex",i==="verifying")d.className="ai-confidence-badge verifying",d.textContent="⏳ AI đang thẩm định...",d.title="AI đang đối soát dữ liệu đơn hàng trong nền";else if(i==="verified"){const c=r.score||98;r.optimized||r.corrections&&r.corrections.length>0?(d.className="ai-confidence-badge optimized",d.textContent=`✨ Đã tối ưu (${c}%)`,d.title=`Độ tin cậy: ${c}%
AI đã hiệu chỉnh thông tin:
`+(r.corrections||[]).join(`
`)):(d.className="ai-confidence-badge high",d.textContent=`🛡️ Tin cậy ${c}% (Khớp chuẩn)`,d.title=`Độ tin cậy: ${c}%
Mọi trường thông tin đã được đối soát khớp với quy tắc`)}else if(i==="review_needed"){const c=r.score||70;d.className="ai-confidence-badge medium",d.textContent=`⚠️ Tin cậy ${c}% (Xem lại)`,d.title=`Độ tin cậy: ${c}%
Cần kiểm tra lại một số trường thông tin`}else i==="offline"&&(d.className="ai-confidence-badge offline",d.textContent="⚡ Cục bộ (Chưa qua AI)",d.title="Dữ liệu bóc tách cục bộ (chưa qua thẩm định AI)")}}globalThis.updateAiConfidenceBadge=Ft;function ft(i){const r=x("order-readiness-bar"),d=x("readiness-text");if(!r||!d)return;let c=x("readiness-confidence-badge");!c&&r&&(c=document.createElement("span"),c.id="readiness-confidence-badge",c.className="readiness-confidence-badge",r.appendChild(c));const N=[x("btnFillVNPost"),x("btnFillJT")].filter(Boolean),g=x("btnSaveOrder"),_=x("btnAiVerify"),L=x("panel-empty-state"),A=x("panel-validation-error"),f=x("panel-validation-checklist"),v=x("panel-validation-message"),k=s=>{N.forEach(E=>{E.disabled=!s}),g&&(g.disabled=!s),_&&(_.disabled=!s,_.style.display=s?"inline-flex":"none")};if(!i){r.className="order-readiness-bar readiness-idle",d.textContent="○ Chờ bóc tách nội dung đơn",c&&(c.style.display="none"),_&&(_.disabled=!0,_.style.display="none"),k(!1),L&&(L.hidden=!1),A&&(A.hidden=!0);return}if(_&&(_.style.display="inline-flex"),c){const s=i.confidence;if(s&&typeof s.score=="number"){c.style.display="inline-flex",c.className=`readiness-confidence-badge confidence-${s.level||"medium"}`;const E=s.level==="high"?"🛡️":s.level==="medium"?"⚡":"⚠️",ie=s.level==="high"?"Tin cậy":s.level==="medium"?"Tương đối":"Xem lại";c.textContent=`${E} ${ie} ${s.score}%`,c.title=`Độ tin cậy bóc tách: ${s.score}%
`+(s.reasons||[]).join(`
`)}else c.style.display="none"}const ee=!!(i.name&&i.name.trim()&&i.name!=="không tìm thấy"),l=(i.phone||"").replace(/\D/g,"").length>=9,u=!!(i.address&&i.address.trim()&&i.address!=="không tìm thấy"),q=!!x("rev-phone-warn"),S=i&&i.rawText||(x("order-raw-input")?x("order-raw-input").value:"");let T=null;typeof OrderValidator<"u"&&typeof OrderValidator.auditCOD=="function"&&(T=OrderValidator.auditCOD(i,S));const b=T?T.canProceed:Number(i.codAmount||0)>0||!!i.codExplicitZero,n=[{label:"Khách hàng",valid:ee,target:"rev-name"},{label:"Số điện thoại",valid:l,target:"rev-phone"},{label:"Địa chỉ",valid:u,target:"rev-address"},{label:"COD",valid:b,target:"rev-cod"}],I=n.filter(s=>!s.valid);if(L&&(L.hidden=!0),n.forEach(s=>{var E;return(E=x(s.target))==null?void 0:E.classList.toggle("is-invalid",!s.valid)}),I.length){r.className="order-readiness-bar readiness-error",d.textContent=T&&!b&&I.length===1?T.status==="CRITICAL_MISSING_COD"?"🚨 Đơn thô có COD nhưng chưa nhập COD":"⚠️ Đơn hàng chưa có tiền COD":"⚠ Cần kiểm tra thông tin bắt buộc",k(!1),A&&(A.hidden=!1),f&&(f.innerHTML=n.map(s=>`<span class="${s.valid?"is-valid":"is-missing"}">${s.valid?"✓":"✕"} ${s.label}</span>`).join("")),v&&(T&&T.status==="CRITICAL_MISSING_COD"?v.textContent=`🚨 NGUY HIỂM: Đơn thô có COD ${T.codRaw.toLocaleString("vi-VN")} đ nhưng form đang là 0đ!`:T&&T.status==="NO_COD_WARNING"&&I.length===1?v.textContent="⚠️ Đơn hàng chưa có tiền COD. Vui lòng nhập số tiền hoặc xác nhận đơn 0đ.":v.textContent=I.map(s=>s.label).join(", ")+" chưa được nhận diện.");return}if(A&&(A.hidden=!0),k(!0),q){r.className="order-readiness-bar readiness-warn",d.textContent="⚠️ CẢNH BÁO: SĐT BOM HÀNG";return}ee&&l&&u?(r.className="order-readiness-bar readiness-ready",d.textContent="🟢 SẴN SÀNG NHẬP ĐƠN"):!l||!u?(r.className="order-readiness-bar readiness-error",d.textContent="🔴 THIẾU THÔNG TIN: "+(l?"Địa chỉ":"SĐT")):(r.className="order-readiness-bar readiness-warn",d.textContent="🟡 CẦN KIỂM TRA LẠI THÔNG TIN")}function rn(){requestAnimationFrame(()=>{const i=x("rev-name");i&&(i.innerHTML='<span class="skeleton" style="width: 70%; height: 14px;">&nbsp;</span>');const r=x("rev-phone");r&&(r.innerHTML='<span class="skeleton" style="width: 50%; height: 14px;">&nbsp;</span>');const d=x("rev-phone-warn");d&&d.remove();const c=x("rev-code");c&&(c.innerHTML='<span class="skeleton" style="width: 55%; height: 14px;">&nbsp;</span>');const N=x("rev-address");N&&(N.innerHTML='<span class="skeleton" style="width: 90%; height: 14px;">&nbsp;</span>');const g=x("rev-cod");g&&(g.innerHTML='<span class="skeleton" style="width: 40%; height: 18px;">&nbsp;</span>');const _=x("rev-fee");_&&(_.innerHTML='<span class="skeleton" style="width: 35%; height: 14px;">&nbsp;</span>');const L=x("review-panel");L&&(L.style.display="none");const A=x("panel-empty-state"),f=x("panel-validation-error"),v=x("panel-duplicate-alert");A&&(A.hidden=!0),f&&(f.hidden=!0),v&&(v.style.display="none"),[x("btnFillVNPost"),x("btnFillJT"),x("btnSaveOrder"),x("btnAiVerify")].filter(Boolean).forEach(O=>{O.disabled=!0});const k=x("order-readiness-bar"),ee=x("readiness-text");k&&ee&&(k.className="order-readiness-bar readiness-idle",ee.textContent="⏳ Đang phân tích dữ liệu...")})}function ln(i={}){return new Promise(r=>{const{carrierData:d=null,panelData:c=null,orderData:N={},rawText:g="",platform:_="vnpost",onConfirm:L,onCancel:A,onUpdateCOD:f}=i;let v=document.getElementById("vnpost-autofill-shadow-host");!v&&typeof document<"u"&&document.body&&(v=document.createElement("div"),v.id="vnpost-autofill-shadow-host",document.body.appendChild(v));let k=v&&v.shadowRoot?v.shadowRoot:v&&v.attachShadow?v.attachShadow({mode:"open"}):null;if(k&&k.querySelector&&!k.querySelector("#vnpost-shadow-style")){const h=document.createElement("style");h.id="vnpost-shadow-style",h.textContent=typeof PANEL_CSS<"u"?PANEL_CSS:"",k.appendChild(h)}if(k||(k=typeof document<"u"&&document.body?document.body:null),!k){r({confirmed:!0,orderData:d||N});return}const ee=(k.getElementById?k.getElementById("af-order-approval-modal"):null)||(k.querySelector?k.querySelector("#af-order-approval-modal"):null)||(typeof document<"u"&&document.getElementById?document.getElementById("af-order-approval-modal"):null);ee&&ee.remove();const O=d||N||{},l=c||globalThis.parsedDataStore||globalThis.__AF_LAST_FILLED_ORDER__||{};let u={...O};const q=Number(u.codAmount||0),S=Number(l.codAmount!==void 0?l.codAmount:0);q===0&&S>0&&!l.codExplicitZero&&(u.codAmount=S);let T=!!(u.codExplicitZero||l.codExplicitZero),b=!1;function n(){const h=Number(u.codAmount||0),D=Number(l.codAmount!==void 0?l.codAmount:0),B=!!(l&&(l.name||l.phone||l.codAmount!==void 0||l.orderCode));let z=typeof OrderValidator<"u"&&OrderValidator.readVietnameseCurrency?OrderValidator.readVietnameseCurrency(h):h.toLocaleString("vi-VN")+" đ";if(B&&(D>0||l.codExplicitZero)){if(h===D)return{status:"MATCH",level:"success",badge:"✓ KHỚP HOÀN TOÀN",title:"Tiền thu hộ khớp 100%",message:`Tiền COD trên Form Bưu Điện trùng khớp 100% với Panel Auto Fill (${h.toLocaleString("vi-VN")} đ).`,canProceed:!0,suggestedCod:null,codForm:h,codPanel:D,spelledOutWords:z,hasPanelData:!0};{const G=Math.abs(h-D);return{status:"MISMATCH",level:"danger",badge:`🚨 LỆCH TIỀN (${G.toLocaleString("vi-VN")} đ)`,title:"CẢNH BÁO LỆCH TIỀN COD",message:`Trên Form Bưu Điện đang là ${h.toLocaleString("vi-VN")} đ, lệch ${G.toLocaleString("vi-VN")} đ so với Panel (${D.toLocaleString("vi-VN")} đ). Hãy kiểm tra hoặc bấm đồng bộ bên dưới!`,canProceed:T,suggestedCod:D,codForm:h,codPanel:D,spelledOutWords:z,hasPanelData:!0}}}return h===0&&!T?{status:"NO_COD_WARNING",level:"warning",badge:"⚠️ CHƯA CÓ TIỀN COD",title:"Đơn hàng chưa có tiền thu hộ (0đ)",message:"Form bưu điện đang có COD = 0đ. Nếu khách đã chuyển khoản trước hoặc quà tặng, hãy bấm Xác nhận đơn 0đ.",canProceed:!1,suggestedCod:D>0?D:null,codForm:0,codPanel:D,spelledOutWords:"Không đồng (0 đ)",hasPanelData:B}:typeof OrderValidator<"u"&&typeof OrderValidator.auditCOD=="function"?{...OrderValidator.auditCOD(u,g,{userConfirmedZero:T}),codPanel:D,hasPanelData:B}:{status:"VALID_MATCH",level:"success",badge:"✓ COD HỢP LỆ",title:"Số tiền COD hợp lệ",message:`Đã nhập tiền COD hợp lệ (${h.toLocaleString("vi-VN")} đ).`,canProceed:!0,suggestedCod:null,codForm:h,codPanel:D,spelledOutWords:z,hasPanelData:B}}function I(h,D,B="text"){const z=String(h||"").trim(),G=String(D||"").trim();if(!z||!G||z==="—"||G==="—"||z==="không tìm thấy"||G==="không tìm thấy")return!0;if(B==="phone"){const j=z.replace(/\D/g,""),U=G.replace(/\D/g,"");return j===U||j.length>=9&&U.length>=9&&(j.endsWith(U)||U.endsWith(j))}if(B==="code")return z.toLowerCase().replace(/[^a-z0-9]/g,"")===G.toLowerCase().replace(/[^a-z0-9]/g,"");if(B==="address"){const j=z.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d"),U=G.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");return j===U||j.includes(U)||U.includes(j)}if(B==="note"){const j=z.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d"),U=G.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");if(j===U||j.includes(U)||U.includes(j))return!0;const Y=j.replace(/^(?:don\s*hang|don|ma\s*don)\s*:\s*[a-z0-9._-]+\s*/i,"").trim(),y=U.replace(/^(?:don\s*hang|don|ma\s*don)\s*:\s*[a-z0-9._-]+\s*/i,"").trim();return Y===y||Y&&y&&(Y.includes(y)||y.includes(Y))}const me=z.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d"),J=G.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");return me===J}const s={shield:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',close:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',user:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',phone:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',location:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',map:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>',tag:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',box:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',scale:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',creditCard:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',note:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',zap:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',truck:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="13" x="1" y="5" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',pin:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',edit:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',fileText:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',check:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',alert:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'};function E(h){return h.includes("Người nhận")?s.user:h.includes("Số điện thoại")||h.includes("SĐT")?s.phone:h.includes("Địa chỉ")?s.location:h.includes("Địa giới")?s.map:h.includes("Mã đơn")||h.includes("SKU")?s.tag:h.includes("hàng hóa")?s.box:h.includes("Khối lượng")?s.scale:h.includes("trả cước")?s.creditCard:h.includes("Ghi chú")?s.note:h.includes("Nguồn")?s.zap:s.pin}function ie(h){const D=String(h||"").trim(),B=D.replace(/\D/g,"");return B.length===10?`${B.slice(0,4)} ${B.slice(4,7)} ${B.slice(7)}`:D||"—"}function Q(h,D,B,z,G=!1,me=null){const J=D&&D!=="không tìm thấy"?D:"—",j=B&&B!=="không tìm thấy"?B:"—",U=me||(z?`<span class="af-compare-pill-match">${s.check} Khớp</span>`:`<span class="af-compare-pill-mismatch">${s.alert} Khác biệt</span>`),Y=G?`<div class="af-address-cell-box">${J}</div>`:`<div class="af-text-cell-wrap">${J}</div>`,y=G?`<div class="af-address-cell-box panel-addr">${j}</div>`:`<div class="af-text-cell-wrap">${j}</div>`,w=E(h);return`
          <div class="af-compare-row ${z?"is-match":"is-mismatch"} ${G?"row-address":""}">
            <div class="af-compare-cell-label" title="${h}">
              <span class="af-field-icon">${w}</span>
              <span class="af-field-name">${h}</span>
            </div>
            <div class="af-compare-cell cell-carrier ${G?"highlight-address":""}" title="Form Bưu Điện: ${J}">${Y}</div>
            <div class="af-compare-cell cell-panel ${G?"highlight-address":""}" title="Panel Auto Fill: ${j}">${y}</div>
            <div class="af-compare-cell-status">${U}</div>
          </div>
        `}let V=n();const K=document.createElement("div");K.id="af-order-approval-modal",K.className="af-approval-overlay";function ue(){V=n();const h=ut(_),D=typeof detectCarrierAccount=="function"?detectCarrierAccount(h.id):"",B=u.shopName||(typeof _lastShopName<"u"?_lastShopName:"")||"",z=Number(u.codAmount||0).toLocaleString("vi-VN")+" đ",G=V.hasPanelData?V.codPanel>0?Number(V.codPanel).toLocaleString("vi-VN")+" đ":l.codExplicitZero?"0 đ (Xác nhận)":"0 đ":V.codRaw>0?Number(V.codRaw).toLocaleString("vi-VN")+" đ":"Chưa có",me=I(u.name,l.name,"name"),J=I(u.phone,l.phone,"phone"),j=I(u.address,l.address,"address"),U=I(u.orderCode,l.orderCode,"code"),Y=h.id==="jt",y=Number(u.weightGrams||u.weight||0);let w=0;Y?l.defaultWeightJt&&Number(l.defaultWeightJt)>0?w=Number(l.defaultWeightJt):l.weightGrams&&Number(l.weightGrams)>0?w=Number(l.weightGrams)>=10?Number(l.weightGrams)/1e3:Number(l.weightGrams):l.weight&&Number(l.weight)>0?w=Number(l.weight)>=10?Number(l.weight)/1e3:Number(l.weight):l.defaultWeightVnpost&&Number(l.defaultWeightVnpost)>0&&(w=Number(l.defaultWeightVnpost)>=10?Number(l.defaultWeightVnpost)/1e3:Number(l.defaultWeightVnpost)):w=Number(l.weightGrams||l.defaultWeightVnpost||l.weight||0);const ae=y>0&&y<50&&Y?Math.round(y*1e3):Math.round(y),te=w>0&&w<50&&Y?Math.round(w*1e3):Math.round(w),Le=Y?y>0?y<50?`${y} kg`:`${y/1e3} kg`:"0.2 kg":y>0?`${y} g`:"200 g",Ie=Y?w>0?w<50?`${w} kg`:`${w/1e3} kg`:"0.2 kg":w>0?`${w} g`:"200 g",ke=ae>0&&te>0?Math.abs(ae-te)<=1:!0;let oe=String(u.notes||u.extraNote||"").trim();const pe=String(l.notes||l.extraNote||"").trim(),Se=String(u.orderCode||l.orderCode||"").trim();!oe&&Y&&u.productItem&&pe&&(I(u.productItem,pe,"note")||u.productItem.toLowerCase().includes(pe.toLowerCase()))&&(oe=pe);const st=!!(Se&&oe&&(oe.toLowerCase()===`đơn hàng: ${Se.toLowerCase()}`||oe.toLowerCase()===`đơn: ${Se.toLowerCase()}`||oe.toLowerCase().replace(/\s+/g,"")===`đơnhàng:${Se.toLowerCase().replace(/\s+/g,"")}`||oe.toLowerCase().includes(Se.toLowerCase()))&&(!pe||pe.toLowerCase()===Se.toLowerCase()||pe==="—"));let Me=!1,Re=null,Ke=oe||"—",Ue=pe||"—";st?(Me=!0,Ue=pe||`Tự sinh theo mã đơn (${Se})`,Re=`<span class="af-compare-pill-compatible">${s.zap} Tự sinh theo mã</span>`):!oe&&!pe?(Me=!0,Ke="—",Ue="—"):oe&&pe&&(Me=I(oe,pe,"note"));const We=l.addressParts||{};let M=l.street||We.street||"",ye=l.ward||We.ward||"",_e=l.district||We.district||"",Ee=l.province||We.province||"";if(!ye&&!_e&&!Ee&&typeof globalThis.AddressParser<"u"&&globalThis.AddressParser.parse)try{const ne=globalThis.AddressParser.parse(u.address||l.address||"");ne&&(M=ne.street||M,ye=ne.ward||ye,_e=ne.district||_e,Ee=ne.province||Ee)}catch{}K.innerHTML=`
          <div class="af-approval-card" role="dialog" aria-modal="true" aria-labelledby="af-approval-title">
            <div class="af-approval-header">
              <div class="af-approval-title-group">
                <div class="af-header-shield-wrap">
                  <span class="af-header-shield-icon">${s.shield}</span>
                </div>
                <div class="af-title-text-wrap">
                  <div class="af-title-row">
                    <h3 id="af-approval-title">XÉT DUYỆT & ĐỐI CHIẾU ĐƠN HÀNG</h3>
                    <span class="af-badge-carrier ${h.id==="jt"?"carrier-jt":"carrier-vnpost"}">
                      <span class="af-carrier-indicator"></span>${h.title||"VNPost"}
                    </span>
                  </div>
                  <div class="af-approval-meta-row">
                    ${D?`
                      <span class="af-badge-account" title="Tài khoản bưu điện đang đăng nhập">
                        <span class="af-badge-account-icon">${s.user}</span>
                        <span class="af-badge-account-label">Tài khoản:</span>
                        <strong class="af-badge-account-name">${D}</strong>
                      </span>
                    `:""}
                    ${B?`<span class="af-approval-pill pill-shop" title="Cửa hàng"><span class="pill-dot"></span>Shop: <strong>${B}</strong></span>`:""}
                    ${u.orderCode?`<span class="af-approval-pill af-pill-code" title="Mã đơn hàng SKU"><span class="af-pill-lbl">Mã:</span> <strong class="af-pill-val">${u.orderCode}</strong></span>`:""}
                  </div>
                </div>
              </div>
              <button type="button" class="af-approval-close-btn" id="modal-close-icon-btn" title="Đóng (Esc)">${s.close}</button>
            </div>

            <div class="af-approval-body-grid">
              <!-- CỘT TRÁI: BẢNG ĐỐI CHIẾU CHI TIẾT TẤT CẢ CÁC TRƯỜNG -->
              <div class="af-approval-left-col">
                <div class="af-review-section-title">
                  <span class="af-table-title-icon">${s.map}</span>
                  <span>BẢNG ĐỐI CHIẾU CHI TIẾT ĐƠN HÀNG (Form bưu điện ⟷ Panel Auto Fill)</span>
                </div>
                <div class="af-compare-container">
                  <div class="af-compare-header">
                    <div class="af-compare-col-th field-name">Trường thông tin</div>
                    <div class="af-compare-col-th carrier">Form Bưu Điện (${h.title||"VNPost"})</div>
                    <div class="af-compare-col-th panel">Panel Auto Fill</div>
                    <div class="af-compare-col-th status-col">Trạng thái</div>
                  </div>

                  <div class="af-compare-list">
                    <!-- NHÓM 1: THÔNG TIN KHÁCH HÀNG & ĐỊA CHỈ PHÁT -->
                    <div class="af-compare-group-header customer">
                      <span class="af-group-icon">${s.user}</span>
                      <span class="af-group-title">1. Thông tin người nhận & Địa chỉ phát</span>
                      <span class="af-group-badge">Trọng yếu</span>
                    </div>

                    ${Q("Người nhận",u.name,l.name,me)}
                    ${Q("Số điện thoại",ie(u.phone),ie(l.phone),J)}
                    ${Q("Địa chỉ",u.address,l.address,j,!0)}
                    
                    ${Ee||_e||ye||M?`
                      <div class="af-compare-row is-match row-geo">
                        <div class="af-compare-cell-label" title="Địa giới hành chính nhận diện (Panel)">
                          <span class="af-field-icon">${s.map}</span>
                          <span class="af-field-name">Địa giới hành chính</span>
                        </div>
                        <div class="af-compare-cell cell-carrier geo-hint">
                          <span class="af-geo-carrier-note">Bưu điện tự đối chiếu tọa độ</span>
                        </div>
                        <div class="af-compare-cell cell-panel">
                          <div class="af-address-breakdown">
                            ${M?`<span class="af-address-sub-pill pill-street" title="Số nhà / Đường"><span class="pill-tag">Đường:</span> <strong class="pill-val">${M}</strong></span>`:""}
                            ${ye?`<span class="af-address-sub-pill pill-ward" title="Xã / Phường"><span class="pill-tag">Xã/Phường:</span> <strong class="pill-val">${ye}</strong></span>`:""}
                            ${_e?`<span class="af-address-sub-pill pill-district" title="Quận / Huyện"><span class="pill-tag">Quận/Huyện:</span> <strong class="pill-val">${_e}</strong></span>`:""}
                            ${Ee?`<span class="af-address-sub-pill pill-province" title="Tỉnh / Thành phố"><span class="pill-tag">Tỉnh/TP:</span> <strong class="pill-val">${Ee}</strong></span>`:""}
                          </div>
                        </div>
                        <div class="af-compare-cell-status"><span class="af-compare-pill-match">${s.check} Chuẩn</span></div>
                      </div>
                    `:""}

                    <!-- NHÓM 2: BƯU KIỆN & HÀNG HÓA -->
                    <div class="af-compare-group-header package">
                      <span class="af-group-icon">${s.box}</span>
                      <span class="af-group-title">2. Chi tiết bưu kiện & Hàng hóa</span>
                      <span class="af-group-badge">Bưu kiện</span>
                    </div>

                    ${u.orderCode||l.orderCode?Q("Mã đơn (SKU)",u.orderCode,l.orderCode,U):""}
                    
                    ${(()=>{const ne=String(u.goodsName||u.productItem||"").trim(),mt=String(l.goodsName||l.productItem||"").trim(),$e=String(u.orderCode||l.orderCode||"").trim();let et=ne||"— (Mặc định hệ thống)",xe=mt;xe||(ne&&$e&&I(ne,$e,"code")?xe=$e:xe=l.defaultGoodsName||"Hàng hóa");let Ve=!1;return(!ne&&!xe||I(ne,xe,"text")||$e&&(I(ne,$e,"code")||ne.includes($e))||!ne||/^(?:hàng hóa|hang hoa)$/i.test(ne)||/^(?:hàng hóa|hang hoa)$/i.test(xe))&&(Ve=!0),Q("Tên hàng hóa",et,xe||"—",Ve)})()}
                    
                    ${Q("Khối lượng",Le,Ie,ke)}

                    <!-- NHÓM 3: CƯỚC PHÍ & VẬN CHUYỂN -->
                    <div class="af-compare-group-header service">
                      <span class="af-group-icon">${s.truck}</span>
                      <span class="af-group-title">3. Cước phí & Ghi chú giao hàng</span>
                      <span class="af-group-badge">Vận hành</span>
                    </div>
                    
                    ${Q("Người trả cước",u.collectFee?"Người nhận trả cước":"Shop trả cước",l.collectFee?"Người nhận trả cước":"Shop trả cước",!!u.collectFee==!!l.collectFee)}
                    
                    ${Q("Ghi chú phát",Ke,Ue,Me,!1,Re)}

                    ${Q("Nguồn gốc tạo đơn",u.source==="MANUAL"?"Nhập thủ công":"Tách đơn AI (Auto Fill)","Tách đơn AI (Auto Fill)",!0)}
                  </div>
                </div>
              </div>

              <!-- CỘT PHẢI: TIÊU ĐIỂM TIỀN COD & THAO TÁC -->
              <div class="af-approval-right-col">
                <div class="af-hero-cod level-${V.level}">
                  <div class="af-hero-cod-top">
                    <span class="af-hero-cod-label">${s.creditCard} TIỀN THU HỘ (COD)</span>
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
                    <span class="af-alert-icon-wrap">${V.level==="danger"||V.level==="warning"?s.alert:s.check}</span>
                    <div class="af-alert-text">
                      <strong class="af-alert-title">${V.title}</strong>
                      <span class="af-alert-msg">${V.message}</span>
                    </div>
                  </div>

                  ${b?`
                    <div class="af-inline-cod-edit">
                      <input type="text" class="af-inline-cod-input" id="modal-inline-cod-input" placeholder="Nhập số tiền COD (ví dụ: 350000)" value="${u.codAmount||""}" />
                      <div class="af-inline-cod-btns">
                        <button type="button" class="af-quick-btn af-quick-btn-apply" id="modal-inline-cod-save-btn">Lưu số tiền</button>
                        <button type="button" class="af-quick-btn af-quick-btn-edit" id="modal-inline-cod-cancel-btn">Hủy</button>
                      </div>
                    </div>
                  `:`
                    <div class="af-cod-quick-actions">
                      ${V.suggestedCod&&V.suggestedCod>0&&V.suggestedCod!==Number(u.codAmount||0)?`
                        <button type="button" class="af-quick-btn af-quick-btn-apply" id="modal-quick-apply-panel-btn">
                          ${s.zap} Đồng bộ ${V.suggestedCod.toLocaleString("vi-VN")} đ từ Panel sang Form
                        </button>
                      `:""}

                      ${(Number(u.codAmount||0)===0||V.status==="NO_COD_WARNING")&&!T?`
                        <button type="button" class="af-quick-btn af-quick-btn-zero" id="modal-quick-confirm-zero-btn">
                          ${s.check} Xác nhận đơn 0đ (Khách chuyển khoản / Quà tặng)
                        </button>
                      `:""}

                      <button type="button" class="af-quick-btn af-quick-btn-edit" id="modal-quick-edit-btn">
                        ${s.edit} Sửa số tiền COD
                      </button>
                    </div>
                  `}
                </div>

                ${g?`
                  <details class="af-raw-preview-details">
                    <summary>
                      <span class="raw-summary-left">${s.fileText} Xem lại nội dung đơn thô gốc</span>
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
                  ${s.zap} Xác Nhận Gửi Lên Bưu Điện <kbd class="af-kbd primary">Enter</kbd>
                </button>
              </div>
            </div>
          </div>
        `,Be()}function Be(){const h=K.querySelector("#modal-close-icon-btn"),D=K.querySelector("#modal-cancel-btn"),B=K.querySelector("#modal-confirm-btn"),z=K.querySelector("#modal-quick-edit-btn"),G=K.querySelector("#modal-quick-apply-panel-btn"),me=K.querySelector("#modal-quick-confirm-zero-btn"),J=K.querySelector("#modal-inline-cod-save-btn"),j=K.querySelector("#modal-inline-cod-cancel-btn"),U=K.querySelector("#modal-inline-cod-input"),Y=y=>{document.removeEventListener("keydown",we,!0),K.remove(),y?(typeof L=="function"&&L(u),r({confirmed:!0,orderData:u,carrierData:u})):(typeof A=="function"&&A(),r({confirmed:!1,orderData:u,carrierData:u}))};if(h&&(h.onclick=()=>Y(!1)),D&&(D.onclick=()=>Y(!1)),B&&(B.onclick=()=>{if(!V.canProceed){typeof showVnpostToast=="function"&&showVnpostToast("⚠️ Vui lòng kiểm tra hoặc xác nhận tiền COD trước khi lên đơn!","warning");return}B.disabled=!0,B.classList.add("is-submitting"),B.innerHTML=`
              <span class="af-btn-spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:af-spin 0.8s linear infinite;margin-right:6px;vertical-align:middle;"></span>
              Đang gửi lên bưu điện...
            `,D&&(D.disabled=!0),h&&(h.disabled=!0),setTimeout(()=>Y(!0),150)}),z&&(z.onclick=()=>{b=!0,ue();const y=K.querySelector("#modal-inline-cod-input");y&&(y.focus(),y.select())}),j&&(j.onclick=()=>{b=!1,ue()}),J&&U){const y=()=>{const w=parseInt(U.value.replace(/\D/g,""),10)||0;u.codAmount=w,w===0?T=!0:T=!1,b=!1,typeof f=="function"&&f(w),ue()};J.onclick=y,U.onkeydown=w=>{w.key==="Enter"?(w.preventDefault(),y()):w.key==="Escape"&&(w.preventDefault(),b=!1,ue())}}G&&V.suggestedCod!==null&&(G.onclick=()=>{u.codAmount=V.suggestedCod,T=V.suggestedCod===0,typeof f=="function"&&f(V.suggestedCod),ue(),typeof showVnpostToast=="function"&&showVnpostToast(`✓ Đã đồng bộ COD ${V.suggestedCod.toLocaleString("vi-VN")} đ từ Panel sang Form!`,"success")}),me&&(me.onclick=()=>{u.codAmount=0,u.codExplicitZero=!0,T=!0,typeof f=="function"&&f(0),ue(),typeof showVnpostToast=="function"&&showVnpostToast("✓ Đã xác nhận đơn 0đ (Khách chuyển khoản/Quà tặng)!","info")})}function we(h){if(h.key==="Escape")h.preventDefault(),h.stopPropagation(),document.removeEventListener("keydown",we,!0),K.remove(),typeof A=="function"&&A(),r({confirmed:!1,orderData:u});else if(h.key==="Enter"&&!h.shiftKey&&!h.ctrlKey&&!h.metaKey){const D=k.activeElement||document.activeElement;if(D&&D.id==="modal-inline-cod-input")return;V.canProceed?(h.preventDefault(),h.stopPropagation(),document.removeEventListener("keydown",we,!0),K.remove(),typeof L=="function"&&L(u),r({confirmed:!0,orderData:u})):typeof showVnpostToast=="function"&&showVnpostToast("⚠️ Vui lòng kiểm tra tiền COD hoặc xác nhận đơn 0đ trước khi lên đơn!","warning")}}document.addEventListener("keydown",we,!0),K.addEventListener("click",h=>{h.target===K&&(document.removeEventListener("keydown",we,!0),K.remove(),typeof A=="function"&&A(),r({confirmed:!1,orderData:u}))}),ue(),k&&typeof k.appendChild=="function"&&k!==document?k.appendChild(K):typeof document<"u"&&document.body&&document.body.appendChild(K)})}function Ye(i){requestAnimationFrame(()=>{var T,b;const r=x("rev-name");r&&(r.textContent=i.name?i.name.trim():"không tìm thấy");const d=x("rev-phone");d&&(d.textContent=i.phone?i.phone.trim():"không tìm thấy",d.style.color="",d.style.fontWeight="",d.title="");const c=x("rev-phone-warn");if(c&&c.remove(),i.phone){const n=i.phone.replace(/\D/g,"");if(typeof OrderStorage<"u"){const s=(OrderStorage.getCacheValue("blacklistPhones")||[]).find(E=>E.phone===n);if(s&&d){d.style.color="#dc2626",d.style.fontWeight="700",d.title="SĐT nằm trong danh sách đen! Lý do: "+s.reason;const E=document.createElement("span");E.id="rev-phone-warn",E.innerHTML=" "+H.warn,E.style.color="#dc2626",E.style.cursor="help",E.style.display="inline-flex",E.style.alignItems="center",E.title="Lịch sử bom hàng: "+s.reason,d.parentElement.appendChild(E),showVnpostToast("⚠️ CẢNH BÁO: Khách hàng này có lịch sử BOM HÀNG! Lý do: "+s.reason,"error")}}}const N=x("rev-code"),g=(typeof getCurrentPlatform=="function"?((T=getCurrentPlatform())==null?void 0:T.id)||getCurrentPlatform():"vnpost")==="vnpost";if(N){let n=i.orderCode?i.orderCode.trim():g?"LuaThuySinh":"Lũa Thuỷ Sinh";g&&n&&(n=Ht(n)),N.textContent=n}let _=i.address?i.address.trim():"không tìm thấy";typeof AddressSanitizer<"u"&&typeof AddressSanitizer.deduplicate=="function"&&_!=="không tìm thấy"&&(_=AddressSanitizer.deduplicate(_));const L=x("rev-address");L&&(L.textContent=_);const A=x("rev-raw-address");A&&(A.textContent=_||"---");const f=x("address-reference-disclosure")||typeof root<"u"&&((b=root==null?void 0:root.querySelector)==null?void 0:b.call(root,".address-reference-disclosure"));if(f){const n=i.addressLevel===2;if(f.style.display=n?"none":"",!n){f.open=!0;const I=f.querySelector(".address-reference-title");I&&(I.textContent="🎯 Gợi ý địa chỉ 2 cấp mới");const s=f.querySelector(".address-reference-status");s&&(s.textContent="Bấm để áp dụng",s.className="address-reference-status is-ready")}}if(i.twoLevelAddress){const n=x("rev-suggest-2level");n&&(n.textContent=i.twoLevelAddress)}if(i.cleanAddress){const n=x("rev-suggest-clean");n&&(n.textContent=i.cleanAddress)}if(i.addressLevel){const n=x("address-status-badge");n&&(n.textContent=i.addressLevel===2?"🎯 Địa chỉ 2 Cấp":"✓ Đã tối ưu",n.title=i.addressLevel===2?"Địa chỉ được nhận diện theo chuẩn 2 cấp (không chèn quận).":"Địa chỉ chuẩn hóa 3 cấp đầy đủ.");const I=x("btn-switch-clean"),s=x("btn-switch-2level");I&&s&&(I.classList.toggle("active",i.addressLevel!==2),s.classList.toggle("active",i.addressLevel===2))}const v=x("rev-cod"),k=x("rev-cod-status"),ee=i&&i.rawText||(x("order-raw-input")?x("order-raw-input").value:"");let O=null;typeof OrderValidator<"u"&&typeof OrderValidator.auditCOD=="function"&&(O=OrderValidator.auditCOD(i,ee)),v&&(v.textContent=i.codAmount?Number(i.codAmount).toLocaleString("vi-VN")+" đ":"0 đ",O&&(O.status==="CRITICAL_MISSING_COD"?v.style.color="#ef4444":O.status==="NO_COD_WARNING"||O.status==="MISMATCH"?v.style.color="#f59e0b":O.status==="EXPLICIT_ZERO"?v.style.color="#0284c7":v.style.color="#10b981")),k&&(O?(k.textContent=O.badge,k.title=O.message,k.className="cod-status-badge "+(O.level==="danger"?"cod-badge-danger":O.level==="warning"?"cod-badge-warning":O.level==="info"?"cod-badge-info":"cod-badge-success")):k.textContent=i.codAmount&&i.codAmount>0?"✓ COD hợp lệ":"⚠️ Chưa có COD");const l=x("rev-fee");if(l){const n=!!i.collectFee;l.textContent=n?"CÓ":"KHÔNG",l.classList.toggle("fee-status--yes",n),l.classList.toggle("fee-status--no",!n)}const u=x("review-panel");if(u&&(u.style.display="flex"),i&&i.confidence){const n=i.confidence,I=n.level==="verifying"?"verifying":n.level==="optimized"||n.level==="high"?"verified":n.level==="offline"?"offline":"review_needed";Ft(I,{score:n.score,optimized:n.level==="optimized",corrections:n.reasons})}ft(i),typeof globalThis.lookupPanelCustomerHistory=="function"&&globalThis.lookupPanelCustomerHistory(i.phone||i.name||"");const q=String(i.phone||"").replace(/\D/g,""),S=String(i.name||"").trim().toLowerCase();typeof OrderStorage<"u"&&typeof OrderStorage.getSubmittedOrders=="function"&&(q.length>=9||S.length>=2)?OrderStorage.getSubmittedOrders().then(n=>{const I=(n||[]).filter(s=>{const E=String(s.phone||"").replace(/\D/g,""),ie=String(s.name||s.customer_name||"").trim().toLowerCase();return q.length>=9?E===q:S.length>=2&&ie===S});typeof setCustomerOrderCountBadge=="function"&&setCustomerOrderCountBadge(I.length)}).catch(()=>{}):typeof setCustomerOrderCountBadge=="function"&&setCustomerOrderCountBadge(0),jt(i)})}async function jt(i){const r=x("panel-duplicate-alert");if(!r||(r.style.display="none",!i||!i.orderCode&&!i.phone))return null;try{if(typeof OrderStorage>"u")return null;let d=[];if(typeof OrderStorage._getSubmittedOrdersFromLocal=="function"&&(d=await OrderStorage._getSubmittedOrdersFromLocal().catch(()=>[])),(!Array.isArray(d)||d.length===0)&&typeof OrderStorage.getSubmittedOrders=="function"&&(d=await Promise.race([OrderStorage.getSubmittedOrders().catch(()=>[]),new Promise(v=>setTimeout(()=>v([]),1500))])),!Array.isArray(d)||d.length===0)return null;const c=new Date().toISOString().slice(0,10),N=new Date().toLocaleDateString("vi-VN"),g=String(i.orderCode||"").trim().toLowerCase(),_=g.replace(/[\s\.\-_]/g,""),L=String(i.phone||"").replace(/\D/g,""),A=String(i.name||"").trim().toLowerCase();let f=null;for(const v of d){const k=String(v.trackingCode||v.tracking_code||"").trim();if(k&&(k===globalThis.__AF_JUST_SUBMITTED_TRACKING__||k===(i==null?void 0:i.trackingCode))||v.id&&(v.id===globalThis.__AF_JUST_SUBMITTED_ID__||v.id===(i==null?void 0:i.id)||v.id===(i==null?void 0:i.savedOrderId)))continue;const ee=v.submittedAt||v.createdAt||v.updatedAt||"";let O=!1,l="Hôm nay",u="";if(ee)try{const ie=new Date(ee);if(!isNaN(ie.getTime())){const Q=ie.toISOString().slice(0,10),V=ie.toLocaleDateString("vi-VN");(Q===c||V===N)&&(O=!0),l=O?"hôm nay":`ngày ${ie.toLocaleDateString("vi-VN")}`,u=ie.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}}catch{}else O=!0,l="hôm nay",u="";const q=String(v.orderCode||v.order_code||"").trim().toLowerCase(),S=q.replace(/[\s\.\-_]/g,""),T=String(v.phone||"").replace(/\D/g,""),b=String(v.name||v.customer_name||"").trim().toLowerCase();if(!!(g&&g!=="—"&&g!=="-"&&q&&q!=="—"&&q!=="-")&&g!==q&&_!==S)continue;const I=!!(g&&g!=="—"&&g!=="-"&&q&&g===q||_&&_!=="—"&&_!=="-"&&S&&_===S),s=!!(L&&L.length>=9&&T&&L===T);if(I||(s||!!(L&&A&&L===T&&A===b))&&O){f={order:v,matchCode:I,matchPhone:s,isToday:O,trackingCode:v.trackingCode||v.tracking_code||"",carrierAccount:v.carrierAccount||v.carrier_account||"",orderCode:v.orderCode||v.order_code||"",customerName:v.name||v.customer_name||"",phone:v.phone||"",submittedDate:l,submittedTime:u?`${u}`:O?"Hôm nay":l};break}}if(f){const v=x("panel-duplicate-time"),k=x("panel-duplicate-message"),ee=x("panel-duplicate-details"),O=x("panel-duplicate-title");O&&(O.innerHTML=`
            <svg class="duplicate-alert-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>${f.isToday?"ĐƠN ĐÃ LÊN TRONG NGÀY":"ĐƠN ĐÃ TỪNG ĐƯỢC LÊN"}</span>
          `),v&&(v.textContent=f.isToday?`Lên đơn lúc ${f.submittedTime}`:`Đã lên ${f.submittedDate}${f.submittedTime?` lúc ${f.submittedTime}`:""}`);const l=de(f.orderCode),u=de(f.phone),q=de(f.customerName||"Khách hàng"),S=de(f.trackingCode),T=de(f.carrierAccount);let b="";return f.matchCode&&f.matchPhone?b=`Trùng mã đơn hàng <strong>${l}</strong> và SĐT <strong>${u}</strong>`:f.matchCode?b=`Trùng mã đơn hàng <strong>${l}</strong>`:b=`Trùng người nhận/SĐT <strong>${u}</strong> (${q})`,k&&(k.innerHTML=`⚠️ Đơn này đã được lên đơn thành công ${f.submittedDate}! (${b})`),ee&&(ee.innerHTML=`
            ${f.orderCode?`<span class="duplicate-detail-tag">Mã đơn: <strong>${l}</strong></span>`:""}
            ${f.customerName?`<span class="duplicate-detail-tag">Khách: <strong>${q}</strong></span>`:""}
            ${f.trackingCode?`<span class="duplicate-detail-tag">Mã VĐ: <code class="duplicate-detail-code">${S}</code></span>`:""}
            ${f.carrierAccount?`<span class="duplicate-detail-tag">Người gửi: <strong>${T}</strong></span>`:""}
          `),r.style.display="flex",showVnpostToast(`⚠️ CẢNH BÁO: Đơn (${f.orderCode||f.phone}) đã được lên ${f.isToday?"hôm nay lúc "+f.submittedTime:f.submittedDate+(f.submittedTime?" lúc "+f.submittedTime:"")}${f.trackingCode?` (Mã VĐ: ${f.trackingCode})`:""}!`,"warning",6e3),f}else return r.style.display="none",null}catch(d){return console.warn("[checkAndDisplayDuplicateAlert] Error:",d),r.style.display="none",null}}globalThis.getVnpostPanelRoot=Vt,globalThis.getVnpostEl=x,globalThis.createInputPanel=zt,globalThis.showPanelSkeleton=rn,globalThis.displayParsedData=Ye,globalThis.checkAndDisplayDuplicateAlert=jt;function dn(i,r){try{if(typeof document>"u")return;ht(!1);const d=ut(i);let c=document.getElementById("vnpost-autofill-shadow-host");const N=c?x("vnpost-autofill-panel"):null;if(N&&N.dataset&&N.dataset.panelType==="login")return;c||(c=document.createElement("div"),c.id="vnpost-autofill-shadow-host",document.body.appendChild(c));const g=c.shadowRoot||c.attachShadow({mode:"open"}),_=g.querySelector("#vnpost-autofill-panel");_&&_.remove();const L=g.querySelector("#vnpost-dock-toggle-tab");if(L&&L.remove(),!g.querySelector("#vnpost-shadow-style")){const y=document.createElement("style");y.id="vnpost-shadow-style",y.textContent=typeof PANEL_CSS<"u"?PANEL_CSS:"",g.appendChild(y)}const A=document.createElement("div");A.id="vnpost-autofill-panel",A.dataset.panelType="login",A.classList.add("panel-floating"),Tt(A);let f=!1;try{f=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(f&&chrome.storage&&chrome.storage.local)try{chrome.storage.local.get(["antigravity_ui_theme"],y=>{if(!chrome.runtime.lastError){if(y&&y.antigravity_ui_theme==="dark"){A.classList.remove("light-mode");try{localStorage.setItem("antigravity_ui_theme","dark")}catch{}}else if(y&&y.antigravity_ui_theme==="light"){A.classList.add("light-mode");try{localStorage.setItem("antigravity_ui_theme","light")}catch{}}}})}catch{}const v=d.themeColor||(d.id==="vnpost"?"#0056b3":"#4f46e5");A.style.setProperty("--theme-color",v);let k="v1";try{let y=!1;try{y=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.getManifest}catch{}y&&(k="v"+(chrome.runtime.getManifest().version||"1"))}catch{}A.innerHTML=`
        <div class="minimized-icon">${H.user}</div>
        <div id="vnpost-panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="vnpost-panel-header-text"></span>
            <span class="badge-version">${k} (Xác thực)</span>
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
      `,g.appendChild(A);const ee=g.getElementById("vnpost-panel-header-text");ee&&(ee.textContent=d.title||""),Lt(A,g.getElementById("vnpost-panel-header"));const O=g.getElementById("vnpost-btn-theme");O&&O.addEventListener("click",y=>{y.stopPropagation();const w=A.classList.toggle("light-mode");Nt(w),showVnpostToast(w?"☀️ Đã chuyển sang giao diện Sáng":"🌙 Đã chuyển sang giao diện Tối","success")}),g.getElementById("vnpost-btn-minimize").addEventListener("click",()=>{A.classList.toggle("minimized")});const l=g.getElementById("panel-tab-btn-pin"),u=g.getElementById("panel-tab-btn-owner"),q=g.getElementById("panel-pin-container"),S=g.getElementById("panel-owner-form"),T=g.getElementById("panel-login-subtitle"),b=g.getElementById("panel-login-error"),n=g.getElementById("panel-trusted-pin-form"),I=g.getElementById("panel-new-pin-form"),s=g.getElementById("panel-pending-approval-box"),E=g.getElementById("panel-trusted-staff-name"),ie=g.getElementById("panel-trusted-shop-name"),Q=g.getElementById("panel-input-trusted-pin"),V=g.getElementById("panel-btn-switch-account"),K=g.getElementById("panel-input-shopcode"),ue=g.getElementById("panel-input-loginname"),Be=g.getElementById("panel-input-pin"),we=g.getElementById("panel-input-devicename"),h=g.getElementById("panel-btn-check-pending"),D=g.getElementById("panel-btn-pending-switch"),B=g.getElementById("panel-input-owner-email"),z=g.getElementById("panel-input-owner-password"),G=g.getElementById("panel-link-register"),me=g.getElementById("panel-link-admin-login");let J="",j="";const U=()=>{let y=!1;try{y=typeof chrome<"u"&&!!chrome.runtime&&!!chrome.runtime.id&&!!chrome.storage&&!!chrome.storage.local}catch{}if(y)try{chrome.storage.local.get(["last_shop_code","last_login_name","staff_name","shop_name","fbDeviceName","device_pending_approval"],w=>{try{if(chrome.runtime&&chrome.runtime.lastError)return;if(J=(w==null?void 0:w.last_shop_code)||"",j=(w==null?void 0:w.last_login_name)||"",w!=null&&w.device_pending_approval&&J){s&&(s.style.display="block"),n&&(n.style.display="none"),I&&(I.style.display="none");return}J&&j?(E&&(E.textContent=w.staff_name||j),ie&&(ie.textContent="Shop: "+(w.shop_name||J)),n&&(n.style.display="flex"),I&&(I.style.display="none"),s&&(s.style.display="none"),Q&&Q.focus()):(n&&(n.style.display="none"),I&&(I.style.display="flex"),s&&(s.style.display="none"))}catch{}});return}catch{}try{J=localStorage.getItem("last_shop_code")||"",j=localStorage.getItem("last_login_name")||"",J&&j?(E&&(E.textContent=localStorage.getItem("staff_name")||j),ie&&(ie.textContent="Shop: "+(localStorage.getItem("shop_name")||J)),n&&(n.style.display="flex"),I&&(I.style.display="none"),s&&(s.style.display="none"),Q&&Q.focus()):(n&&(n.style.display="none"),I&&(I.style.display="flex"),s&&(s.style.display="none"))}catch{}};U(),l&&u&&(l.addEventListener("click",()=>{l.classList.add("active"),u.classList.remove("active"),q&&(q.style.display="block"),S&&(S.style.display="none"),T&&(T.textContent="Xác thực nhanh bằng mã PIN 6 số cho nhân viên."),b&&(b.style.display="none"),U()}),u.addEventListener("click",()=>{u.classList.add("active"),l.classList.remove("active"),q&&(q.style.display="none"),S&&(S.style.display="flex"),T&&(T.textContent="Đăng nhập tài khoản Chủ shop / Quản lý với Email và Mật khẩu."),b&&(b.style.display="none")}));const Y=y=>{y&&y.preventDefault(),n&&(n.style.display="none"),s&&(s.style.display="none"),I&&(I.style.display="flex"),b&&(b.style.display="none"),K&&K.focus()};V&&V.addEventListener("click",Y),D&&D.addEventListener("click",Y),n&&(n.addEventListener("submit",async y=>{y.preventDefault();const w=((Q==null?void 0:Q.value)||"").trim();if(!w||w.length!==6){b&&(b.textContent="⚠️ Vui lòng nhập đúng mã PIN gồm 6 chữ số!",b.style.display="block");return}b&&(b.style.display="none");const ae=g.getElementById("panel-btn-submit-trusted-pin");ae&&(ae.disabled=!0,ae.innerHTML="⏳ Đang vào ca...");try{if(typeof AuthService<"u"&&typeof AuthService.loginWithPin=="function")await AuthService.loginWithPin({shopCode:J,loginName:j,pin:w}),showVnpostToast("🎉 Đăng nhập ca làm việc thành công!","success"),setTimeout(()=>{const te=typeof globalThis<"u"&&globalThis.checkUrlAndInject||typeof window<"u"&&window.checkUrlAndInject;typeof te=="function"&&te()},80);else throw new Error("Hệ thống xác thực PIN chưa sẵn sàng.")}catch(te){b&&(b.textContent=`❌ ${te.message||"Mã PIN không chính xác!"}`,b.style.display="block")}finally{ae&&(ae.disabled=!1,ae.innerHTML="Đăng Nhập Vào Ca")}}),Q&&Q.addEventListener("input",y=>{Q.value=Q.value.replace(/[^0-9]/g,""),Q.value.length===6&&n.dispatchEvent(new Event("submit"))})),I&&I.addEventListener("submit",async y=>{y.preventDefault();const w=((K==null?void 0:K.value)||"").trim().toUpperCase(),ae=((ue==null?void 0:ue.value)||"").trim().toLowerCase(),te=((Be==null?void 0:Be.value)||"").trim(),Le=((we==null?void 0:we.value)||"").trim();if(!w||!ae){b&&(b.textContent="⚠️ Vui lòng nhập đầy đủ Mã Shop và Tên của bạn!",b.style.display="block");return}if(te&&te.length!==6){b&&(b.textContent="⚠️ Mã PIN phải bao gồm đúng 6 chữ số!",b.style.display="block");return}b&&(b.style.display="none");const Ie=g.getElementById("panel-btn-submit-new-pin");Ie&&(Ie.disabled=!0,Ie.innerHTML="⏳ Đang vào ca...");try{if(typeof AuthService<"u"&&typeof AuthService.loginWithPin=="function")await AuthService.loginWithPin({shopCode:w,loginName:ae,pin:te||null,deviceName:Le}),showVnpostToast("🎉 Vào ca làm việc thành công!","success"),setTimeout(()=>{const ke=typeof globalThis<"u"&&globalThis.checkUrlAndInject||typeof window<"u"&&window.checkUrlAndInject;typeof ke=="function"&&ke()},80);else throw new Error("Hệ thống xác thực chưa sẵn sàng.")}catch(ke){ke.code==="DEVICE_PENDING_APPROVAL"?(I&&(I.style.display="none"),s&&(s.style.display="block"),b&&(b.style.display="none")):b&&(b.textContent=`❌ ${ke.message||"Đăng nhập thất bại!"}`,b.style.display="block")}finally{Ie&&(Ie.disabled=!1,Ie.innerHTML="🚀 Vào Ca Lên Đơn (1-Click)")}}),h&&h.addEventListener("click",async()=>{h.disabled=!0,h.innerHTML="⏳ Đang kiểm tra...";try{typeof AuthService<"u"&&typeof AuthService.loginWithPin=="function"&&await AuthService.loginWithPin({shopCode:J||(K==null?void 0:K.value),loginName:j||(ue==null?void 0:ue.value),pin:"000000"})}catch(y){y.code==="DEVICE_PENDING_APPROVAL"?b&&(b.textContent="Máy trạm vẫn đang chờ Chủ Shop duyệt trong mục Quản Lý Thiết Bị.",b.style.display="block"):y.message&&y.message.includes("PIN")?(showVnpostToast("✅ Thiết bị đã được duyệt! Vui lòng nhập mã PIN 6 số.","success"),s&&(s.style.display="none"),U()):b&&(b.textContent=`❌ ${y.message}`,b.style.display="block")}finally{h.disabled=!1,h.innerHTML="🔄 Kiểm tra lại trạng thái duyệt"}}),S&&S.addEventListener("submit",async y=>{y.preventDefault();const w=((B==null?void 0:B.value)||"").trim(),ae=((z==null?void 0:z.value)||"").trim();if(!w||!ae){b&&(b.textContent="⚠️ Vui lòng nhập đầy đủ Email và Mật khẩu!",b.style.display="block");return}b&&(b.style.display="none");const te=g.getElementById("panel-btn-submit-owner");te&&(te.disabled=!0,te.innerHTML="⏳ Đang xác thực...");try{if(typeof AuthService<"u"&&typeof AuthService.login=="function")await AuthService.login(w,ae),showVnpostToast("🎉 Đăng nhập Chủ Shop thành công!","success"),setTimeout(()=>{const Le=typeof globalThis<"u"&&globalThis.checkUrlAndInject||typeof window<"u"&&window.checkUrlAndInject;typeof Le=="function"&&Le()},80);else throw new Error("Hệ thống xác thực chưa sẵn sàng.")}catch(Le){b&&(b.textContent=`❌ ${Le.message||"Đăng nhập thất bại!"}`,b.style.display="block")}finally{te&&(te.disabled=!1,te.innerHTML="🔑 Đăng Nhập Quản Trị")}}),G&&r&&G.addEventListener("click",y=>{y.preventDefault(),r()}),me&&me.addEventListener("click",y=>{y.preventDefault();let w=!1;try{w=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.sendMessage}catch{}w?chrome.runtime.sendMessage({action:"openAdmin"}):window.open("https://xlgovgynbsahuykyjzcx.supabase.co/","_blank")})}catch(d){if(String((d==null?void 0:d.message)||d).includes("Extension context invalidated")){console.info("[Panel] Extension vừa được cập nhật lại, vui lòng F5 trang web.");try{let c=document.getElementById("vnpost-autofill-shadow-host");c||(c=document.createElement("div"),c.id="vnpost-autofill-shadow-host",document.body.appendChild(c));const N=c.shadowRoot||c.attachShadow({mode:"open"});N.innerHTML=`
            <div style="position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#0f172a;color:#fff;padding:12px 18px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.3);font-family:sans-serif;font-size:13px;display:flex;align-items:center;gap:12px;border:1px solid #334155;">
              <span>🔄 Extension Auto Fill Order vừa được tải lại. Vui lòng bấm để tải lại trang:</span>
              <button onclick="window.location.reload()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer;">Tải lại ngay (F5)</button>
            </div>
          `}catch{}}else console.warn("Lỗi tạo panel đăng nhập:",d)}}function cn(i,r,d){try{if(typeof document>"u")return;ht(!1);const c=ut(i);let N=document.getElementById("vnpost-autofill-shadow-host");const g=N?x("vnpost-autofill-panel"):null;if(g&&g.dataset&&g.dataset.panelType==="device-limit")return;N||(N=document.createElement("div"),N.id="vnpost-autofill-shadow-host",document.body.appendChild(N));const _=N.shadowRoot||N.attachShadow({mode:"open"}),L=_.querySelector("#vnpost-autofill-panel");L&&L.remove();const A=_.querySelector("#vnpost-dock-toggle-tab");if(A&&A.remove(),!_.querySelector("#vnpost-shadow-style")){const S=document.createElement("style");S.id="vnpost-shadow-style",S.textContent=typeof PANEL_CSS<"u"?PANEL_CSS:"",_.appendChild(S)}const f=document.createElement("div");f.id="vnpost-autofill-panel",f.dataset.panelType="device-limit",f.classList.add("panel-floating"),Tt(f);let v=!1;try{v=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.id}catch{}if(v&&chrome.storage&&chrome.storage.local)try{chrome.storage.local.get(["antigravity_ui_theme"],S=>{if(!chrome.runtime.lastError){if(S&&S.antigravity_ui_theme==="dark"){f.classList.remove("light-mode");try{localStorage.setItem("antigravity_ui_theme","dark")}catch{}}else if(S&&S.antigravity_ui_theme==="light"){f.classList.add("light-mode");try{localStorage.setItem("antigravity_ui_theme","light")}catch{}}}})}catch{}const k=c.themeColor||(c.id==="vnpost"?"#0056b3":"#4f46e5");f.style.setProperty("--theme-color",k);let ee="v1";try{let S=!1;try{S=typeof chrome<"u"&&chrome.runtime&&!!chrome.runtime.getManifest}catch{}S&&(ee="v"+(chrome.runtime.getManifest().version||"1"))}catch{}f.innerHTML=`
        <div class="minimized-icon">${H.user}</div>
        <div id="vnpost-panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="vnpost-panel-header-text"></span>
            <span class="badge-version">${ee} (Hạn ngạch)</span>
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
              Cửa hàng của bạn đã đạt giới hạn tối đa <strong>${r}</strong> thiết bị hoạt động đồng thời.
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
      `,_.appendChild(f);const O=_.getElementById("vnpost-panel-header-text");O&&(O.textContent=c.title||""),Lt(f,_.getElementById("vnpost-panel-header"));const l=_.getElementById("vnpost-btn-theme");l&&l.addEventListener("click",S=>{S.stopPropagation();const T=f.classList.toggle("light-mode");Nt(T)}),_.getElementById("vnpost-btn-minimize").addEventListener("click",()=>{f.classList.toggle("minimized")});const u=_.getElementById("panel-btn-open-settings");u&&d&&u.addEventListener("click",S=>{S.preventDefault(),d()});const q=_.getElementById("panel-btn-logout-limit");q&&q.addEventListener("click",async S=>{S.preventDefault(),q.disabled=!0,q.textContent="⏳ Đang đăng xuất...";try{typeof AuthService<"u"&&typeof AuthService.logout=="function"&&(await AuthService.logout(),setTimeout(()=>{const T=typeof globalThis<"u"&&globalThis.checkUrlAndInject||typeof window<"u"&&window.checkUrlAndInject;typeof T=="function"&&T()},80))}catch(T){alert("Lỗi đăng xuất: "+T.message)}finally{q.disabled=!1,q.textContent="🚪 Đăng xuất tài khoản"}})}catch(c){console.warn("Lỗi tạo panel giới hạn thiết bị:",c)}}globalThis.createInputPanel=zt,globalThis.createLoginRequiredPanel=dn,globalThis.createDeviceLimitExceededPanel=cn,globalThis.showOrderApprovalModal=ln,globalThis.displayParsedData=Ye})();
})()