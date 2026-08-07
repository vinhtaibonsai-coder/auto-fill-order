// =========================================================================
// AUTH.EVENTS.JS — HỆ THỐNG PHÁT SỰ KIỆN XÁC THỰC (AUTH EVENT BUS)
// =========================================================================

const AuthEvents = {
  _listeners: {},

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  },

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  },

  emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`[AuthEvents] Lỗi khi xử lý sự kiện ${event}:`, e);
      }
    });
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.AuthEvents = AuthEvents;
}

export { AuthEvents };
