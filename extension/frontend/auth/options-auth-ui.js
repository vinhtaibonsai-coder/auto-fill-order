function safeAuthReady(fn) {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

safeAuthReady(async () => {
  initAuthUI();
});

async function initAuthUI() {
  const $ = id => document.getElementById(id);
  const authModal = $('authModal');
  const authBanner = $('authBanner');
  const authForm = $('authForm');

  // Panels
  const pLogin = $('authPanelLogin');
  const pRegister = $('authPanelRegister');
  const pForgot = $('authPanelForgot');

  // Login steps
  const loginStepEmail = $('loginStepEmail');
  const loginStepPass = $('loginStepPass');
  const loginNextBtn = $('loginNextBtn');
  const loginEmailDisplay = $('loginEmailDisplay');
  const loginChangeEmailBtn = $('loginChangeEmailBtn');

  // Common inputs
  const iEmail = $('authEmail');
  const iPass = $('authPass');

  // Register inputs
  const iRegName = $('authRegName');
  const iRegEmail = $('authRegEmail');
  const iRegPass = $('authRegPass');
  const iRegShop = $('authRegShop');
  const iRegInvite = $('authRegInvite');

  // Forgot inputs
  const iForgotEmail = $('authForgotEmail');

  // Error spans
  const errEmail = $('authEmailErr');
  const errPass = $('authPassErr');
  const errRegName = $('authRegNameErr');
  const errRegEmail = $('authRegEmailErr');
  const errRegPass = $('authRegPassErr');
  const errRegShop = $('authRegShopErr');
  const errRegInvite = $('authRegInviteErr');
  const errForgotEmail = $('authForgotEmailErr');

  // Submit buttons
  const btnLogin = $('authLoginBtn');
  const btnRegister = $('authRegisterBtn');
  const btnForgot = $('authForgotBtn2');

  // Nav buttons
  const btnGotoRegister = $('authGotoRegister');
  const btnGotoLogin = $('authGotoLogin');
  const btnForgotOpen = $('authForgotBtn');
  const btnBackLogin = $('authBackLogin');

  // Rate limit warning
  const rlWarn = $('authRlWarn');

  // Topbar
  const topbarUserLabel = $('topbarUserLabel');
  const btnTopbarLogout = $('btnTopbarLogout');

  // Shop radios
  const radioCreate = document.querySelector('input[name="regShopType"][value="create"]');
  const radioJoin = document.querySelector('input[name="regShopType"][value="join"]');
  const regShopGroup = $('authRegShopGroup');
  const regInviteGroup = $('authRegInviteGroup');

  let mode = 'login';

  // ── HELPERS ──

  function triggerShake() {
    const card = $('authCard');
    if (card) {
      card.classList.remove('af-shake');
      void card.offsetWidth; // trigger reflow
      card.classList.add('af-shake');
    }
  }

  function showBanner(msg, type) {
    if (!authBanner) return;
    authBanner.className = type || 'err';
    authBanner.textContent = msg;
    authBanner.style.display = 'block';
    if (type === 'err' || !type) triggerShake();
    setTimeout(() => { authBanner.style.display = 'none'; }, 8000);
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
  }

  function setFieldError(errEl, inputEl, msg) {
    if (errEl) {
      errEl.textContent = msg || '';
      errEl.classList.toggle('show', !!msg);
    }
    if (inputEl) inputEl.classList.toggle('err', !!msg);
    if (msg) triggerShake();
  }

  function clearAllErrors() {
    const errs = [errEmail, errPass, errRegName, errRegEmail, errRegPass, errRegShop, errRegInvite, errForgotEmail];
    const inputs = [iEmail, iPass, iRegName, iRegEmail, iRegPass, iRegShop, iRegInvite, iForgotEmail];
    errs.forEach(e => { if (e) { e.textContent = ''; e.classList.remove('show'); } });
    inputs.forEach(inp => { if (inp) inp.classList.remove('err'); });
  }

  function setRateLimitWarning(show) {
    if (!rlWarn) return;
    rlWarn.classList.toggle('show', show);
  }

  function showAuthModal(show) {
    if (!authModal) return;
    authModal.classList.toggle('show', show);
  }

  function setAppLockedState(isLocked) {
    const sidebar = document.querySelector('.sidebar');
    const contentWrapper = document.querySelector('.content-wrapper');
    [sidebar, contentWrapper].forEach(el => {
      if (!el) return;
      if (isLocked) {
        el.style.filter = 'blur(10px)'; el.style.opacity = '0.3'; el.style.pointerEvents = 'none';
      } else {
        el.style.filter = 'none'; el.style.opacity = '1'; el.style.pointerEvents = 'auto';
      }
    });
  }

  function showPanel(panelId) {
    [pLogin, pRegister, pForgot].forEach(p => { if (p) p.style.display = 'none'; });
    const panel = $(panelId);
    if (panel) panel.style.display = 'flex';
  }

  // ── LOGIN 2-STEP ──

  function updateLoginStepDots(step) {
    const dots = document.querySelectorAll('#loginStepDots .auth-step-dot');
    if (dots.length >= 2) {
      dots[0].classList.toggle('active', step === 1);
      dots[1].classList.toggle('active', step === 2);
    }
  }

  function goToLoginStep1() {
    if (loginStepEmail) loginStepEmail.style.display = 'flex';
    if (loginStepPass) loginStepPass.style.display = 'none';
    if (authBanner) { authBanner.style.display = 'none'; authBanner.className = ''; }
    clearAllErrors();
    iPass.value = '';
    updateLoginStepDots(1);
  }

  function goToLoginStep2(email) {
    if (loginEmailDisplay) loginEmailDisplay.textContent = email;
    if (loginStepEmail) loginStepEmail.style.display = 'none';
    if (loginStepPass) loginStepPass.style.display = 'flex';
    if (authBanner) { authBanner.style.display = 'none'; authBanner.className = ''; }
    clearAllErrors();
    iPass.value = '';
    updateLoginStepDots(2);
    setTimeout(() => { if (iPass) iPass.focus(); }, 100);
  }

  function getLoginEmail() {
    if (loginStepPass.style.display !== 'none' && loginEmailDisplay) {
      return loginEmailDisplay.textContent;
    }
    return (iEmail?.value || '').trim();
  }

  // ── MODE SWITCH ──

  function switchMode(newMode) {
    mode = newMode;
    const banner = authBanner;
    if (banner) { banner.style.display = 'none'; banner.className = ''; }
    clearAllErrors();
    setRateLimitWarning(false);

    if (newMode === 'login') {
      showPanel('authPanelLogin');
      goToLoginStep1();
    } else if (newMode === 'register') {
      showPanel('authPanelRegister');
      updateShopInputsVisibility();
    } else if (newMode === 'forgot') {
      showPanel('authPanelForgot');
    }
  }

  // ── INIT STATE ──
  
  if (window.location.hash === '#register') {
    switchMode('register');
  } else if (window.location.hash === '#forgot') {
    switchMode('forgot');
  } else {
    switchMode('login');
  }

  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#register') switchMode('register');
    else if (window.location.hash === '#forgot') switchMode('forgot');
    else switchMode('login');
  });

  updateShopInputsVisibility();

  function updateShopInputsVisibility() {
    const isCreate = radioCreate && radioCreate.checked;
    if (regShopGroup) regShopGroup.style.display = isCreate ? 'block' : 'none';
    if (regInviteGroup) regInviteGroup.style.display = isCreate ? 'none' : 'block';
  }

  // ── PASSWORD TOGGLE ──

  document.querySelectorAll('.af-toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const inp = document.getElementById(targetId);
      if (!inp) return;
      const isPass = inp.type === 'password';
      inp.type = isPass ? 'text' : 'password';
      btn.innerHTML = isPass
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
  });

  // ── SHOP RADIO ──

  if (radioCreate) radioCreate.addEventListener('change', updateShopInputsVisibility);
  if (radioJoin) radioJoin.addEventListener('change', updateShopInputsVisibility);

  // ── PASSWORD STRENGTH ──

  if (iRegPass) {
    iRegPass.addEventListener('input', (e) => {
      const val = e.target.value;
      const fill1 = $('pwFill1');
      const fill2 = $('pwFill2');
      const fill3 = $('pwFill3');
      if (!fill1 || !fill2 || !fill3) return;
      
      fill1.className = 'pw-strength-fill';
      fill2.className = 'pw-strength-fill';
      fill3.className = 'pw-strength-fill';

      if (!val) return;
      
      let strength = 0;
      if (val.length >= 6) strength += 1;
      if (val.length >= 8 && /[A-Z]/.test(val) && /[0-9]/.test(val)) strength += 1;
      if (val.length >= 10 && /[^A-Za-z0-9]/.test(val)) strength += 1;

      if (strength >= 1) fill1.classList.add('weak');
      if (strength >= 2) { fill1.className = 'pw-strength-fill fair'; fill2.className = 'pw-strength-fill fair'; }
      if (strength >= 3) { fill1.className = 'pw-strength-fill strong'; fill2.className = 'pw-strength-fill strong'; fill3.className = 'pw-strength-fill strong'; }
    });
  }

  // ── LOGIN: TIẾP THEO ──

  async function handleLoginNext() {
    const identifier = (iEmail?.value || '').trim();
    if (!identifier) {
      setFieldError(errEmail, iEmail, 'Vui lòng nhập email hoặc tên đăng nhập');
      return;
    }
    goToLoginStep2(identifier);
  }

  if (loginNextBtn) {
    loginNextBtn.addEventListener('click', handleLoginNext);
  }

  if (iEmail) {
    iEmail.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && loginStepEmail && loginStepEmail.style.display !== 'none') {
        e.preventDefault();
        handleLoginNext();
      }
    });
  }

  // ── LOGIN: SỬA EMAIL ──

  if (loginChangeEmailBtn) {
    loginChangeEmailBtn.addEventListener('click', goToLoginStep1);
  }

  // ── NAVIGATION ──

  if (btnGotoRegister) btnGotoRegister.addEventListener('click', () => switchMode('register'));
  if (btnGotoLogin) btnGotoLogin.addEventListener('click', () => switchMode('login'));
  if (btnForgotOpen) btnForgotOpen.addEventListener('click', () => {
    const email = getLoginEmail();
    if (email && iForgotEmail) iForgotEmail.value = email;
    switchMode('forgot');
  });
  if (btnBackLogin) btnBackLogin.addEventListener('click', () => switchMode('login'));

  // ── AUTH EVENTS ──

  if (typeof AuthEvents !== 'undefined') {
    AuthEvents.on('AUTH_STATE_CHANGED', async (event) => {
      if (event.isAuthenticated) {
        showAuthModal(false);
        setAppLockedState(false);
        updateTopbarUserUI(event.user);
        if (event.isLocalFallback) setRateLimitWarning(true);
      } else {
        showAuthModal(true);
        setAppLockedState(true);
        if (topbarUserLabel) topbarUserLabel.textContent = '👤 Chưa đăng nhập';
      }
    });
  }

  // ── CHECK SESSION ──

  if (typeof AuthService !== 'undefined') {
    const isAuthed = await AuthService.isAuthenticated();
    if (isAuthed) {
      const user = await AuthService.getCurrentUser();
      showAuthModal(false);
      setAppLockedState(false);
      updateTopbarUserUI(user);
    } else {
      showAuthModal(true);
      setAppLockedState(true);
    }
  } else {
    showAuthModal(true);
    setAppLockedState(true);
  }

  function updateTopbarUserUI(user) {
    if (!user) {
      if (topbarUserLabel) topbarUserLabel.textContent = 'Chưa đăng nhập';
      const topbarUserRoleLabel = document.getElementById('topbarUserRoleLabel');
      if (topbarUserRoleLabel) topbarUserRoleLabel.textContent = 'Bấm để đăng nhập';
      const topbarAvatar = document.getElementById('topbarAvatar');
      if (topbarAvatar) topbarAvatar.textContent = '?';
      return;
    }
    const name = user.full_name || user.username || user.email || 'Người dùng';
    const topbarUserRoleLabel = document.getElementById('topbarUserRoleLabel');
    const topbarAvatar = document.getElementById('topbarAvatar');

    if (topbarUserLabel) topbarUserLabel.textContent = name;
    if (topbarAvatar) {
      const parts = name.trim().split(/[\s@._-]+/);
      topbarAvatar.textContent = parts.length === 1 ? parts[0].substring(0, 2).toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
    }

    if (typeof AuthService !== 'undefined' && typeof AuthService.getUserRole === 'function') {
      AuthService.getUserRole().then(role => {
        const roleText = (role === 'SYSTEM_ADMIN' ? 'Quản trị viên' : (role === 'SHOP_OWNER' ? 'Chủ Shop' : (role === 'SHOP_STAFF' ? 'Nhân viên' : 'Đã đăng nhập')));
        if (topbarUserRoleLabel) topbarUserRoleLabel.textContent = roleText;
      }).catch(() => {
        if (topbarUserRoleLabel) topbarUserRoleLabel.textContent = 'Đã đăng nhập';
      });
    } else if (topbarUserRoleLabel) {
      topbarUserRoleLabel.textContent = 'Đã đăng nhập';
    }
  }

  // ── FORM SUBMIT ──

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAllErrors();
      if (authBanner) authBanner.style.display = 'none';
      setRateLimitWarning(false);

      const submitter = e.submitter;
      let currentMode = mode;
      if (submitter) {
        if (submitter === btnRegister) currentMode = 'register';
        else if (submitter === btnForgot) currentMode = 'forgot';
        else currentMode = 'login';
      }

      const btn = currentMode === 'login' ? btnLogin
                 : currentMode === 'register' ? btnRegister
                 : btnForgot;
      setLoading(btn, true);

      try {
        if (currentMode === 'login') {
          const email = getLoginEmail();
          const password = (iPass?.value || '').trim();
          let valid = true;
          if (!email) { goToLoginStep1(); setFieldError(errEmail, iEmail, 'Vui lòng nhập email'); valid = false; }
          if (!password) { setFieldError(errPass, iPass, 'Vui lòng nhập mật khẩu'); valid = false; }
          if (!valid) { setLoading(btn, false); return; }

          const result = await AuthService.loginWithUsernameOrEmail(email, password);
          if (result && result.isLocalFallback) {
            showBanner('✅ Đã đăng nhập chế độ Nội bộ (Offline) do Supabase bị giới hạn tần suất.', 'info');
            setRateLimitWarning(true);
          } else {
            showBanner('✅ Đăng nhập thành công!', 'ok');
          }
          showAuthModal(false);
          setAppLockedState(false);
          if (typeof window.loadShopSelector === 'function') window.loadShopSelector();

        } else if (currentMode === 'register') {
          const fullName = (iRegName?.value || '').trim();
          const email = (iRegEmail?.value || '').trim();
          const password = (iRegPass?.value || '').trim();
          const shopName = (iRegShop?.value || '').trim();
          const inviteCode = (iRegInvite?.value || '').trim();
          const isCreateShop = radioCreate ? radioCreate.checked : true;

          let valid = true;
          if (!fullName) { setFieldError(errRegName, iRegName, 'Vui lòng nhập họ tên'); valid = false; }
          if (!email) { setFieldError(errRegEmail, iRegEmail, 'Vui lòng nhập email'); valid = false; }
          if (!password) { setFieldError(errRegPass, iRegPass, 'Vui lòng nhập mật khẩu'); valid = false; }
          else if (password.length < 6) { setFieldError(errRegPass, iRegPass, 'Mật khẩu tối thiểu 6 ký tự'); valid = false; }
          if (isCreateShop && !shopName) { setFieldError(errRegShop, iRegShop, 'Vui lòng nhập tên shop'); valid = false; }
          if (!isCreateShop && !inviteCode) { setFieldError(errRegInvite, iRegInvite, 'Vui lòng nhập mã mời'); valid = false; }
          if (!valid) { setLoading(btn, false); return; }

          if (!isCreateShop && typeof InviteService !== 'undefined') {
            const invRes = await InviteService.validateInviteCode(inviteCode);
            if (!invRes.valid) throw new Error(invRes.reason);
          }

          const result = await AuthService.signup(email, password, fullName);
          if (result && result.isLocalFallback) {
            setRateLimitWarning(true);
            showBanner('✅ Đã tạo phiên làm việc nội bộ (Offline). Dữ liệu không đồng bộ lên đám mây.', 'info');
            showAuthModal(false);
            setAppLockedState(false);
            return;
          }

          if (isCreateShop && typeof ShopService !== 'undefined') {
            await ShopService.createShop({ name: shopName, senderName: fullName, senderPhone: '', senderAddress: '' });
          }

          showBanner('✅ Đăng ký thành công!', 'ok');
          showAuthModal(false);
          setAppLockedState(false);

        } else if (currentMode === 'forgot') {
          const email = (iForgotEmail?.value || '').trim();
          if (!email) { setFieldError(errForgotEmail, iForgotEmail, 'Vui lòng nhập email'); setLoading(btn, false); return; }
          await AuthService.forgotPassword(email);
          showBanner('📧 Hướng dẫn đặt lại mật khẩu đã được gửi đến email ' + email + '. Vui lòng kiểm tra hộp thư!', 'ok');
          setTimeout(() => switchMode('login'), 3000);
        }

      } catch (err) {
        const msg = err.message || '';
        if (msg.toLowerCase().includes('rate limit')) {
          showBanner('Supabase đang bị giới hạn tần suất. Vui lòng thử lại sau 30 giây.', 'err');
        } else if (msg.toLowerCase().includes('mật khẩu không đúng') || msg.toLowerCase().includes('invalid login credentials')) {
          // Ở bước 2 (đã xác nhận email), báo lỗi mật khẩu cụ thể
          setFieldError(errPass, iPass, 'Mật khẩu không đúng!');
          iPass.focus();
        } else if (msg.toLowerCase().includes('401') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('supabase')) {
          showBanner('⚠️ Không thể kết nối Supabase. Dữ liệu sẽ hoạt động cục bộ, không đồng bộ đám mây.', 'info');
          showAuthModal(false);
          setAppLockedState(false);
          setRateLimitWarning(true);
        } else {
          showBanner(msg, 'err');
        }
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // ── TOPBAR USER LABEL ──

  if (topbarUserLabel) {
    topbarUserLabel.style.cursor = 'pointer';
    topbarUserLabel.addEventListener('click', async () => {
      const isAuthed = typeof AuthService !== 'undefined' && await AuthService.isAuthenticated();
      if (!isAuthed) {
        switchMode('login');
        showAuthModal(true);
        setAppLockedState(true);
      }
    });
  }

  // ── LOGOUT ──

  if (btnTopbarLogout) {
    btnTopbarLogout.addEventListener('click', async () => {
      const isAuthed = typeof AuthService !== 'undefined' && await AuthService.isAuthenticated();
      if (!isAuthed) {
        switchMode('login');
        showAuthModal(true);
        setAppLockedState(true);
        return;
      }
      const ok = typeof showConfirmModal === 'function'
        ? await showConfirmModal('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?')
        : confirm('Bạn có chắc chắn muốn đăng xuất?');
      if (ok && typeof AuthService !== 'undefined') {
        await AuthService.logout();
        if (typeof showQuickToast === 'function') showQuickToast('ℹ️ Đã đăng xuất thành công!', 'info');
        switchMode('login');
        setAppLockedState(true);
        showAuthModal(true);
      }
    });
  }
}
