import './realtime.service.js';

const RealtimeService = globalThis.RealtimeService || (typeof window !== 'undefined' ? window.RealtimeService : null);

export { RealtimeService };
