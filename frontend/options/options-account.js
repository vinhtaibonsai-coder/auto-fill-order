function safeAccountReady(fn) {
  if (document.readyState === 'interactive' || document.readyState === 'complete') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

safeAccountReady(async () => {
  initAccountUI();
});

async function initAccountUI() {
  const $ = id => document.getElementById(id);

  // ── Profile display ──
  const accAvatar = $('accAvatar');
  const accDisplayName = $('accDisplayName');
  const accDisplayEmail = $('accDisplayEmail');
  const accRoleBadge = $('accRoleBadge');
  const accDisplayShop = $('accDisplayShop');
  const accDisplayMemberSince = $('accDisplayMemberSince');

  // ── Edit modal ──
  const editModal = $('accEditModal');
  const editName = $('accEditName');
  const editPhone = $('accEditPhone');
  const editClose = $('accEditModalClose');
  const editCancel = $('accEditCancel');
  const editSave = $('accEditSave');
  const editBtn = $('accEditProfileBtn');

  // ── Password change ──
  const btnPwSave = $('btnSavePasswordChange');
  const txtNewPass = $('txtNewPassword');
  const txtConfirmPass = $('txtConfirmNewPassword');
  const chkLogoutAll = $('chkLogoutAllDevices');

  // ── Load profile ──
  let currentUser = null;
  let currentShop = null;

  async function loadProfile() {
    if (typeof AuthService !== 'undefined') {
      currentUser = await AuthService.getCurrentUser();
      if (currentUser && typeof AuthSession !== 'undefined') {
        const session = await AuthSession.getSession();
        currentUser.role = session?.role || 'VIEWER';
      }
    }
    if (typeof OrderStorage !== 'undefined') {
      currentShop = await OrderStorage.getActiveShop();
    }
    renderProfile();
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getRoleLabel(user) {
    if (!user) return 'Người dùng';
    if (user.role) {
      if (user.role === 'SYSTEM_ADMIN') return 'Quản trị viên';
      if (user.role === 'SHOP_OWNER' || user.role === 'SHOP_ADMIN') return 'Chủ Shop';
      if (user.role === 'SHOP_STAFF' || user.role === 'SHOP_MANAGER') return 'Nhân viên';
      if (user.role === 'VIEWER') return 'Khách (Chỉ xem)';
    }
    return 'Người dùng';
  }

  const topbarUserLabel = $('topbarUserLabel');
  const topbarAvatar = $('topbarAvatar');
  const topbarUserRoleLabel = $('topbarUserRoleLabel');
  const topbarUserProfilePill = $('topbarUserProfilePill');
  const userProfileDropdown = $('userProfileDropdown');
  const dropdownAvatar = $('dropdownAvatar');
  const dropdownUserName = $('dropdownUserName');
  const dropdownUserEmail = $('dropdownUserEmail');
  const dropdownRoleBadge = $('dropdownRoleBadge');
  const dropdownShopName = $('dropdownShopName');
  const btnDropdownAccount = $('btnDropdownAccount');
  const btnDropdownChangePassword = $('btnDropdownChangePassword');
  const btnDropdownAdminPortal = $('btnDropdownAdminPortal');
  const btnDropdownDevices = $('btnDropdownDevices');
  const btnDropdownLogout = $('btnDropdownLogout');
  const btnTopbarLogout = $('btnTopbarLogout');
  const btnProfileLogout = $('btnProfileLogout');
  const btnOpenLoginModal = $('btnOpenLoginModal');

  function renderProfile() {
    if (!currentUser) {
      if (accDisplayName) accDisplayName.textContent = 'Chưa đăng nhập';
      if (accDisplayEmail) accDisplayEmail.textContent = 'Bấm để đăng nhập';
      if (accAvatar) accAvatar.textContent = '?';
      if (accRoleBadge) accRoleBadge.textContent = 'Khách';

      if (topbarUserLabel) topbarUserLabel.textContent = 'Đăng nhập ngay';
      if (topbarUserRoleLabel) topbarUserRoleLabel.textContent = 'Chưa đăng nhập';
      if (topbarAvatar) topbarAvatar.textContent = '?';

      if (dropdownAvatar) dropdownAvatar.textContent = '?';
      if (dropdownUserName) dropdownUserName.textContent = 'Chưa đăng nhập';
      if (dropdownUserEmail) dropdownUserEmail.textContent = 'Bấm nút bên dưới để đăng nhập';
      if (dropdownRoleBadge) dropdownRoleBadge.textContent = 'Khách';
      if (dropdownShopName) dropdownShopName.textContent = '—';
      if (btnDropdownAdminPortal) btnDropdownAdminPortal.style.display = 'none';
      if (btnProfileLogout) btnProfileLogout.style.display = 'none';
      return;
    }

    const name = currentUser.full_name || currentUser.username || currentUser.email || 'Người dùng';
    const email = currentUser.email || '—';
    const roleLabel = getRoleLabel(currentUser);
    const initials = getInitials(name);
    const shopName = currentShop ? currentShop.name : 'Chưa chọn Shop';

    // Profile card inside settings tab
    if (accDisplayName) accDisplayName.textContent = name;
    if (accDisplayEmail) accDisplayEmail.textContent = email;
    if (accAvatar) accAvatar.textContent = initials;
    if (accRoleBadge) {
      accRoleBadge.textContent = roleLabel;
      if (roleLabel === 'Quản trị viên') accRoleBadge.style.background = '#7C3AED';
      else if (roleLabel === 'Chủ Shop') accRoleBadge.style.background = '#3C7363';
      else accRoleBadge.style.background = '#64748B';
    }
    if (accDisplayShop) accDisplayShop.textContent = shopName;
    if (accDisplayMemberSince) {
      accDisplayMemberSince.textContent = currentUser.created_at
        ? new Date(currentUser.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Hôm nay';
    }

    // Topbar User Profile Pill & Dropdown
    if (topbarUserLabel) topbarUserLabel.textContent = name;
    if (topbarUserRoleLabel) topbarUserRoleLabel.textContent = roleLabel;
    if (topbarAvatar) topbarAvatar.textContent = initials;

    if (dropdownAvatar) dropdownAvatar.textContent = initials;
    if (dropdownUserName) dropdownUserName.textContent = name;
    if (dropdownUserEmail) dropdownUserEmail.textContent = email;
    if (dropdownRoleBadge) {
      dropdownRoleBadge.textContent = roleLabel;
      if (roleLabel === 'Quản trị viên') dropdownRoleBadge.style.background = '#7C3AED';
      else if (roleLabel === 'Chủ Shop') dropdownRoleBadge.style.background = '#3C7363';
      else dropdownRoleBadge.style.background = '#64748B';
    }
    if (dropdownShopName) dropdownShopName.textContent = shopName;

    if (btnDropdownAdminPortal) {
      if (currentUser.role === 'SYSTEM_ADMIN' || currentUser.role === 'SHOP_OWNER') {
        btnDropdownAdminPortal.style.display = 'flex';
      } else {
        btnDropdownAdminPortal.style.display = 'none';
      }
    }
    if (btnProfileLogout) btnProfileLogout.style.display = 'inline-flex';
  }

  // ── Toggle Dropdown Menu ──
  if (topbarUserProfilePill) {
    topbarUserProfilePill.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!currentUser) {
        handleOpenLogin();
        return;
      }
      const isOpen = userProfileDropdown?.classList.contains('show');
      if (isOpen) {
        userProfileDropdown?.classList.remove('show');
        topbarUserProfilePill.classList.remove('active');
      } else {
        userProfileDropdown?.classList.add('show');
        topbarUserProfilePill.classList.add('active');
      }
    });
  }

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (userProfileDropdown && !userProfileDropdown.contains(e.target) && !topbarUserProfilePill?.contains(e.target)) {
      userProfileDropdown.classList.remove('show');
      topbarUserProfilePill?.classList.remove('active');
    }
  });

  // ── Dropdown Item Actions ──
  function switchTab(tabId) {
    const item = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (item) item.click();
  }

  if (btnDropdownAccount) {
    btnDropdownAccount.addEventListener('click', () => {
      userProfileDropdown?.classList.remove('show');
      topbarUserProfilePill?.classList.remove('active');
      switchTab('settings');
    });
  }

  if (btnDropdownChangePassword) {
    btnDropdownChangePassword.addEventListener('click', () => {
      userProfileDropdown?.classList.remove('show');
      topbarUserProfilePill?.classList.remove('active');
      switchTab('settings');
      setTimeout(() => {
        const passInp = $('txtNewPassword');
        if (passInp) passInp.focus();
      }, 200);
    });
  }

  if (btnDropdownDevices) {
    btnDropdownDevices.addEventListener('click', () => {
      userProfileDropdown?.classList.remove('show');
      topbarUserProfilePill?.classList.remove('active');
      switchTab('devices');
    });
  }

  if (btnDropdownLogout) {
    btnDropdownLogout.addEventListener('click', () => {
      userProfileDropdown?.classList.remove('show');
      topbarUserProfilePill?.classList.remove('active');
      handleLogout();
    });
  }

  // ── Logout & Login Modal Triggers ──
  async function handleLogout() {
    if (typeof AuthService !== 'undefined') {
      try {
        await AuthService.logout();
        currentUser = null;
        renderProfile();
        if (typeof showQuickToast === 'function') showQuickToast('✅ Đã đăng xuất tài khoản!', 'success');
        const authModal = $('authModal');
        if (authModal) authModal.classList.add('show');
      } catch (err) {
        if (typeof showQuickToast === 'function') showQuickToast('❌ ' + (err.message || 'Lỗi đăng xuất!'), 'error');
      }
    }
  }

  function handleOpenLogin() {
    const authModal = $('authModal');
    if (authModal) authModal.classList.add('show');
  }

  if (btnTopbarLogout) btnTopbarLogout.addEventListener('click', handleLogout);
  if (btnProfileLogout) btnProfileLogout.addEventListener('click', handleLogout);
  if (btnOpenLoginModal) btnOpenLoginModal.addEventListener('click', handleOpenLogin);

  const btnRefreshPermissions = $('btnRefreshPermissions');
  if (btnRefreshPermissions) {
    btnRefreshPermissions.addEventListener('click', async () => {
      const origText = btnRefreshPermissions.innerHTML;
      btnRefreshPermissions.innerHTML = '⏳ Đang làm mới...';
      btnRefreshPermissions.disabled = true;
      try {
        if (typeof AuthService !== 'undefined' && typeof AuthService.refreshPermissions === 'function') {
          const res = await AuthService.refreshPermissions();
          if (res.ok) {
            if (typeof showQuickToast === 'function') showQuickToast('✅ Đã cập nhật quyền mới nhất!', 'success');
            await loadProfile();
          } else {
            if (res.error) throw new Error(res.error);
            if (typeof showQuickToast === 'function') showQuickToast('ℹ️ Chế độ Offline, không thể làm mới từ Cloud.', 'info');
          }
        }
      } catch (err) {
        if (typeof showQuickToast === 'function') showQuickToast('❌ ' + err.message, 'error');
      } finally {
        btnRefreshPermissions.innerHTML = origText;
        btnRefreshPermissions.disabled = false;
      }
    });
  }

  // ── Edit modal ──
  function openEditModal() {
    if (!currentUser) return;
    if (editName) editName.value = currentUser.full_name || '';
    if (editPhone) editPhone.value = currentUser.phone || '';
    if (editModal) editModal.classList.add('show');
  }

  function closeEditModal() {
    if (editModal) editModal.classList.remove('show');
  }

  if (editBtn) editBtn.addEventListener('click', openEditModal);
  if (editClose) editClose.addEventListener('click', closeEditModal);
  if (editCancel) editCancel.addEventListener('click', closeEditModal);
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeEditModal();
    });
  }

  if (editSave) {
    editSave.addEventListener('click', async () => {
      const newName = (editName?.value || '').trim();
      const newPhone = (editPhone?.value || '').trim();
      if (!newName) {
        if (typeof showQuickToast === 'function') showQuickToast('⚠️ Vui lòng nhập họ tên!', 'error');
        return;
      }
      editSave.disabled = true;
      editSave.textContent = '⏳ Đang lưu...';
      try {
        if (typeof ProfileService !== 'undefined' && currentUser && currentUser.id) {
          const result = await ProfileService.updateProfile(currentUser.id, { full_name: newName, phone: newPhone });
          if (result) {
            currentUser = result;
            renderProfile();
            if (typeof showQuickToast === 'function') showQuickToast('✅ Hồ sơ đã được cập nhật!', 'success');
          } else {
            currentUser.full_name = newName;
            currentUser.phone = newPhone;
            if (typeof AuthSession !== 'undefined') {
              const session = await AuthSession.getSession();
              if (session) { session.user = currentUser; await AuthSession.saveSession(session); }
            }
            renderProfile();
            if (typeof showQuickToast === 'function') showQuickToast('✅ Hồ sơ đã được cập nhật (local).', 'success');
          }
        }
        closeEditModal();
      } catch (err) {
        if (typeof showQuickToast === 'function') showQuickToast('❌ ' + (err.message || 'Lỗi cập nhật hồ sơ!'), 'error');
      } finally {
        editSave.disabled = false;
        editSave.textContent = 'Lưu thay đổi';
      }
    });
  }

  // ── Password change ──
  if (btnPwSave) {
    btnPwSave.addEventListener('click', async (e) => {
      e.preventDefault();
      const newPass = (txtNewPass?.value || '').trim();
      const confirmPass = (txtConfirmPass?.value || '').trim();
      const logoutAll = chkLogoutAll ? chkLogoutAll.checked : false;

      if (!newPass || newPass.length < 6) {
        if (typeof showQuickToast === 'function') showQuickToast('⚠️ Mật khẩu mới phải có ít nhất 6 ký tự!', 'error');
        return;
      }
      if (newPass !== confirmPass) {
        if (typeof showQuickToast === 'function') showQuickToast('⚠️ Mật khẩu nhập lại không khớp!', 'error');
        return;
      }

      btnPwSave.disabled = true;
      btnPwSave.classList.add('loading');
      try {
        if (typeof AuthService !== 'undefined') {
          await AuthService.changePassword(newPass, logoutAll);
          if (typeof showQuickToast === 'function') {
            showQuickToast('✅ Đổi mật khẩu thành công!' + (logoutAll ? ' Đã đăng xuất các thiết bị khác.' : ''), 'success');
          }
          if (txtNewPass) txtNewPass.value = '';
          if (txtConfirmPass) txtConfirmPass.value = '';
        }
      } catch (err) {
        if (typeof showQuickToast === 'function') showQuickToast('❌ ' + (err.message || 'Đổi mật khẩu thất bại!'), 'error');
      } finally {
        btnPwSave.disabled = false;
        btnPwSave.classList.remove('loading');
      }
    });
  }

  // ── Init ──
  loadProfile();

  // Reload profile when tab is shown (event delegation)
  document.querySelector('.nav-menu')?.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (item && item.getAttribute('data-tab') === 'settings') {
      setTimeout(loadProfile, 300);
    }
  });
}
