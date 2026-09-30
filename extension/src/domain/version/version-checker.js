/**
 * Module Kiểm Tra Cập Nhật Phiên Bản Extension (OTA Version Checker)
 * Tự động đối soát phiên bản máy khách với bảng release_versions trên Supabase Cloud.
 */

function parseSemver(v) {
  if (!v) return [0, 0, 0];
  const clean = String(v).replace(/^v/i, '').trim();
  const parts = clean.split('.').map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

export function compareSemver(v1, v2) {
  const [maj1, min1, pat1] = parseSemver(v1);
  const [maj2, min2, pat2] = parseSemver(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
}

export function normalizeRolloutPercentage(value) {
  if (value === null || value === undefined || value === '') return null;
  const percentage = Number(value);
  if (!Number.isFinite(percentage)) return null;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

export class VersionChecker {
  static getCurrentVersion() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
        return chrome.runtime.getManifest().version || '1.0.0';
      }
    } catch (_) {}
    return '1.0.0';
  }

  static async getStoredStatus() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await new Promise(r => chrome.storage.local.get(['app_update_status'], r));
        return res?.app_update_status || null;
      } else if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('app_update_status');
        return raw ? JSON.parse(raw) : null;
      }
    } catch (_) {}
    return null;
  }

  static async checkUpdate() {
    try {
      let supabaseUrl = '';
      let anonKey = '';

      if (typeof globalThis.SupabaseCloud !== 'undefined' && typeof globalThis.SupabaseCloud._getConfig === 'function') {
        const cfg = globalThis.SupabaseCloud._getConfig();
        supabaseUrl = (cfg.url || '').replace(/\/$/, '');
        anonKey = (cfg.anonKey || '').trim();
      }

      if (!supabaseUrl || !anonKey) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const stored = await new Promise(r => chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey'], r));
          supabaseUrl = (stored?.supabaseUrl || '').replace(/\/$/, '');
          anonKey = (stored?.supabaseAnonKey || '').trim();
        } else if (typeof localStorage !== 'undefined') {
          supabaseUrl = (localStorage.getItem('supabaseUrl') || '').replace(/\/$/, '');
          anonKey = (localStorage.getItem('supabaseAnonKey') || '').trim();
        }
      }

      if (!supabaseUrl || !anonKey) {
        return { ok: false, reason: 'SUPABASE_NOT_CONFIGURED' };
      }

      const endpoint = `${supabaseUrl}/rest/v1/release_versions?order=created_at.desc&limit=1`;
      const res = await fetch(endpoint, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      });

      if (!res.ok) {
        return { ok: false, reason: `HTTP_${res.status}` };
      }

      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        return { ok: true, hasUpdate: false, status: null };
      }

      const latest = rows[0];
      const current = this.getCurrentVersion();
      const hasUpdate = compareSemver(latest.version, current) > 0;
      const isBelowMin = latest.min_supported_version ? compareSemver(current, latest.min_supported_version) < 0 : false;
      const isForceUpdate = hasUpdate && (latest.is_force_update === true || isBelowMin);
      const isBlocked = isForceUpdate;

      const status = {
        currentVersion: current,
        latestVersion: latest.version,
        minSupportedVersion: latest.min_supported_version || '',
        hasUpdate,
        isForceUpdate,
        isBlocked,
        releaseNotes: latest.release_notes || '',
        downloadUrl: latest.download_url || '',
        rolloutPercentage: normalizeRolloutPercentage(latest.rollout_percentage),
        publishedAt: latest.created_at || '',
        checkedAt: Date.now()
      };

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise(r => chrome.storage.local.set({ app_update_status: status }, r));
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('app_update_status', JSON.stringify(status));
      }

      return { ok: true, hasUpdate, isBlocked, status };
    } catch (err) {
      console.warn('[VersionChecker] Check failed:', err.message);
      return { ok: false, reason: err.message };
    }
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.VersionChecker = VersionChecker;
  globalThis.compareSemver = compareSemver;
}
