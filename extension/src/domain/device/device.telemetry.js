/**
 * Device Telemetry & Browser Fingerprinting Engine
 * Thu thập và chuẩn hóa dữ liệu phần cứng, trình duyệt, hệ điều hành và môi trường mạng.
 */

export class DeviceTelemetry {
  /**
   * Phát hiện chính xác trình duyệt và phiên bản
   */
  static detectBrowser() {
    if (typeof navigator === 'undefined') return { name: 'Node.js', version: '1.0', engine: 'V8' };

    const ua = navigator.userAgent || '';
    const vendor = navigator.vendor || '';

    // 1. Cốc Cốc (Dựa trên coc_coc_browser hoặc CocCoc token)
    if (/coc_coc_browser|coccoc/i.test(ua)) {
      const match = ua.match(/coc_coc_browser\/([\d.]+)|coccoc\/([\d.]+)/i);
      return {
        name: 'Cốc Cốc',
        code: 'coccoc',
        version: match ? (match[1] || match[2]) : 'Latest',
        color: '#10b981',
        icon: 'coccoc'
      };
    }

    // 2. Microsoft Edge
    if (/edg\/([\d.]+)/i.test(ua)) {
      const match = ua.match(/edg\/([\d.]+)/i);
      return {
        name: 'Microsoft Edge',
        code: 'edge',
        version: match ? match[1] : 'Latest',
        color: '#0284c7',
        icon: 'edge'
      };
    }

    // 3. Brave
    if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
      const match = ua.match(/chrom(?:e|ium)\/([\d.]+)/i);
      return {
        name: 'Brave Browser',
        code: 'brave',
        version: match ? match[1] : 'Latest',
        color: '#f97316',
        icon: 'brave'
      };
    }

    // 4. Opera / Opera GX
    if (/opr\/([\d.]+)|opera/i.test(ua)) {
      const match = ua.match(/opr\/([\d.]+)/i);
      return {
        name: 'Opera',
        code: 'opera',
        version: match ? match[1] : 'Latest',
        color: '#ef4444',
        icon: 'opera'
      };
    }

    // 5. Google Chrome
    if (/chrome|chromium/i.test(ua) && /google inc/i.test(vendor)) {
      const match = ua.match(/chrom(?:e|ium)\/([\d.]+)/i);
      return {
        name: 'Google Chrome',
        code: 'chrome',
        version: match ? match[1] : 'Latest',
        color: '#2563eb',
        icon: 'chrome'
      };
    }

    // 6. Firefox
    if (/firefox\/([\d.]+)/i.test(ua)) {
      const match = ua.match(/firefox\/([\d.]+)/i);
      return {
        name: 'Mozilla Firefox',
        code: 'firefox',
        version: match ? match[1] : 'Latest',
        color: '#ea580c',
        icon: 'firefox'
      };
    }

    // 7. Safari
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      const match = ua.match(/version\/([\d.]+)/i);
      return {
        name: 'Apple Safari',
        code: 'safari',
        version: match ? match[1] : 'Latest',
        color: '#0ea5e9',
        icon: 'safari'
      };
    }

    return {
      name: 'Chromium Browser',
      code: 'chromium',
      version: '1.0',
      color: '#64748b',
      icon: 'globe'
    };
  }

  /**
   * Phát hiện hệ điều hành và kiến trúc chip
   */
  static detectOS() {
    if (typeof navigator === 'undefined') return { name: 'Unknown OS', code: 'unknown', arch: '64-bit' };

    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';

    // Windows
    if (/windows nt 10\.0/i.test(ua)) {
      return { name: 'Windows 10/11', code: 'windows', icon: 'windows', arch: /win64|x64|wow64/i.test(ua) ? '64-bit' : '32-bit' };
    }
    if (/windows nt 6\.3/i.test(ua)) return { name: 'Windows 8.1', code: 'windows', icon: 'windows', arch: '64-bit' };
    if (/windows nt 6\.1/i.test(ua)) return { name: 'Windows 7', code: 'windows', icon: 'windows', arch: '64-bit' };
    if (/windows/i.test(ua)) return { name: 'Windows OS', code: 'windows', icon: 'windows', arch: '64-bit' };

    // macOS
    if (/mac os x/i.test(ua) || /macintosh|macintel/i.test(platform)) {
      const match = ua.match(/mac os x ([\d_]+)/i);
      const ver = match ? match[1].replace(/_/g, '.') : '';
      return { name: `macOS ${ver}`.trim(), code: 'macos', icon: 'apple', arch: 'Apple Silicon / Intel' };
    }

    // Linux
    if (/linux/i.test(ua) || /linux/i.test(platform)) {
      if (/ubuntu/i.test(ua)) return { name: 'Ubuntu Linux', code: 'linux', icon: 'linux', arch: 'x86_64' };
      if (/android/i.test(ua)) return { name: 'Android OS', code: 'android', icon: 'smartphone', arch: 'ARM' };
      return { name: 'Linux OS', code: 'linux', icon: 'linux', arch: 'x86_64' };
    }

    // iOS
    if (/iphone|ipad|ipod/i.test(ua)) {
      return { name: 'Apple iOS', code: 'ios', icon: 'smartphone', arch: 'ARM64' };
    }

    return { name: platform || 'Hệ điều hành khác', code: 'other', icon: 'monitor', arch: '64-bit' };
  }

  /**
   * Thu thập thông tin phần cứng & WebGL GPU
   */
  static getHardwareDetails() {
    if (typeof window === 'undefined') return {};

    const details = {
      screenResolution: typeof screen !== 'undefined' ? `${screen.width} x ${screen.height}` : '1920 x 1080',
      pixelRatio: typeof window !== 'undefined' ? (window.devicePixelRatio || 1) + 'x' : '1x',
      colorDepth: typeof screen !== 'undefined' ? `${screen.colorDepth}-bit` : '24-bit',
      cpuCores: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) + ' cores' : '4 cores',
      deviceMemory: typeof navigator !== 'undefined' && navigator.deviceMemory ? `${navigator.deviceMemory} GB RAM` : '>= 8 GB RAM',
      gpuRenderer: 'Đồ họa tích hợp'
    };

    // Khai thác WebGL Unmasked Renderer để lấy tên card đồ họa (NVIDIA, AMD, Intel, Apple M1/M2)
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (renderer) details.gpuRenderer = renderer.replace(/angle\s*\((.+)\)/i, '$1');
        }
      }
    } catch (_) {}

    return details;
  }

  /**
   * Thu thập thông tin môi trường mạng & Ngôn ngữ
   */
  static getNetworkDetails() {
    if (typeof navigator === 'undefined') return {};

    return {
      language: navigator.language || 'vi-VN',
      languages: navigator.languages ? navigator.languages.join(', ') : 'vi-VN, en-US',
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh' : 'Asia/Ho_Chi_Minh',
      connectionType: navigator.connection?.effectiveType || 'Wifi / High Speed'
    };
  }

  /**
   * Tổng hợp toàn bộ hồ sơ thiết bị (Full Telemetry Snapshot)
   */
  static async collectFullTelemetry(activeShopId = null, currentCarrier = null) {
    const browser = this.detectBrowser();
    const os = this.detectOS();
    const hardware = this.getHardwareDetails();
    const network = this.getNetworkDetails();

    const clientVersion = typeof chrome !== 'undefined' && chrome.runtime?.getManifest
      ? chrome.runtime.getManifest().version : 'v2.4 Pro';

    const deviceName = `${browser.name} (${os.name})`;

    return {
      deviceName,
      browserName: browser.name,
      browserCode: browser.code,
      browserVersion: browser.version,
      osName: os.name,
      osCode: os.code,
      osArch: os.arch,
      clientVersion,
      screenResolution: hardware.screenResolution,
      pixelRatio: hardware.pixelRatio,
      colorDepth: hardware.colorDepth,
      cpuCores: hardware.cpuCores,
      deviceMemory: hardware.deviceMemory,
      gpuRenderer: hardware.gpuRenderer,
      language: network.language,
      timezone: network.timezone,
      connectionType: network.connectionType,
      activeShopId,
      currentCarrier: currentCarrier || (typeof window !== 'undefined' && window.location?.href.includes('vnpost') ? 'VNPost' : typeof window !== 'undefined' && window.location?.href.includes('jtexpress') ? 'J&T Express' : 'Extension Workspace'),
      capturedAt: new Date().toISOString()
    };
  }
}
