/**
 * Clipboard Adapter an toàn cho Mobile & iOS Safari (QC-03)
 * Thực hiện tuần tự navigator.clipboard -> textarea fallback document.execCommand
 */

export async function copyToClipboard(text) {
  if (text === undefined || text === null) return false;
  const str = String(text);

  // 1. Thử sử dụng navigator.clipboard.writeText (Secure Context)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch (err) {
      // Bỏ qua lỗi để thử fallback
    }
  }

  // 2. Fallback: Dùng textarea tạm thời tương thích với Safari iOS / WebView
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = str;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');
      
      document.body.appendChild(textarea);
      
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) return true;
    } catch (_) {}
  }

  return false;
}
