import React, { useState, useRef, useEffect } from 'react';
import { User, Shield, LogOut, ExternalLink, ChevronUp, Check, Zap } from 'lucide-react';
import { AuthService } from '../../../domain/auth/auth.service.esm.js';

export default function UserProfileCard({ currentUser, userRole, uiRole, onOpenAdmin, onOpenWorkspace, onLogout, appVersion }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getRoleTitle = (role) => {
    const r = String(role || '').toUpperCase();
    if (['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(r)) return 'Quản trị viên';
    if (['OWNER', 'SHOP_OWNER'].includes(r)) return 'Chủ cửa hàng';
    if (['MANAGER', 'SHOP_MANAGER'].includes(r)) return 'Quản lý cửa hàng';
    if (['STAFF', 'SHOP_STAFF'].includes(r)) return 'Nhân viên';
    return 'Quản trị viên';
  };

  const displayName = currentUser?.full_name || getRoleTitle(userRole);
  const email = currentUser?.email || 'Chưa cập nhật email';
  const avatarUrl = currentUser?.avatar_url || currentUser?.avatarUrl;

  const isExtensionEnvironment = () => {
    return typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function';
  };

  const getWorkspaceUrl = () => {
    if (isExtensionEnvironment()) {
      return chrome.runtime.getURL('index.html');
    }
    return '/index.html';
  };

  const getAdminDashboardUrl = () => {
    if (isExtensionEnvironment()) {
      return chrome.runtime.getURL('admin.html');
    }
    return '/admin';
  };

  const navigateToPortal = (url) => {
    if (!url) return;
    const isExtension = isExtensionEnvironment();
    const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 900 || 'ontouchstart' in window);
    if (!isExtension || isMobile) {
      window.location.assign(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleLogout = async () => {
    setIsOpen(false);
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) {
      if (onLogout) {
        onLogout();
      } else {
        await AuthService.logout();
        window.location.reload();
      }
    }
  };

  return (
    <div className="user-profile-bottom-container" ref={dropdownRef}>
      {isOpen && (
        <div className="user-profile-popover">
          <div className="popover-header">
            <div className="popover-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} />
              ) : (
                <div className="avatar-placeholder">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="popover-user-info">
              <div className="popover-name">{displayName}</div>
              <div className="popover-email">{email}</div>
              <span className="popover-role-badge">{getRoleTitle(userRole)}</span>
            </div>
          </div>

          <div className="popover-divider"></div>

          <div className="popover-menu">
            <button
              className="popover-menu-item"
              onClick={() => {
                setIsOpen(false);
                if (onOpenWorkspace) {
                  onOpenWorkspace();
                } else {
                  navigateToPortal(getWorkspaceUrl());
                }
              }}
            >
              <Zap size={15} className="popover-icon" color="#f59e0b" />
              <span>Mobile Workspace (Bán hàng)</span>
              <ExternalLink size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            </button>

            {uiRole === 'master_admin' && (
              <button
                className="popover-menu-item"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenAdmin) {
                    onOpenAdmin();
                  } else {
                    navigateToPortal(getAdminDashboardUrl());
                  }
                }}
              >
                <Shield size={15} className="popover-icon" color="#2563eb" />
                <span>Bảng quản trị Master Admin</span>
                <ExternalLink size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />
              </button>
            )}

            <button className="popover-menu-item logout" onClick={handleLogout}>
              <LogOut size={15} className="popover-icon" />
              <span>Đăng xuất tài khoản</span>
            </button>
          </div>

          <div className="popover-footer-version">
            <span className="popover-version-label">Tiện ích Auto-Fill</span>
            <span className="popover-version-tag">v{appVersion || '1.0.1'}</span>
          </div>
        </div>
      )}

      <div
        className={`user-profile-card ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Nhấp để xem tùy chọn tài khoản"
        role="button"
        tabIndex={0}
      >
        <div className="user-card-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} />
          ) : (
            <div className="avatar-placeholder">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="user-card-info">
          <div className="user-card-name">{displayName}</div>
          <div className="user-card-email">{email}</div>
        </div>
        <ChevronUp
          size={16}
          className={`user-card-chevron ${isOpen ? 'rotate' : ''}`}
        />
      </div>
    </div>
  );
}
