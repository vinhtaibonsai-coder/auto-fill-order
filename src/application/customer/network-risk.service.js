import { AuthSession } from '../../domain/auth/auth.session.esm.js';

async function rpc(name, payload) {
  const config = await globalThis.SupabaseCloud?.loadConfig();
  const session = await AuthSession.getSession();
  if (!config?.url || !session?.access_token) throw new Error('Cần đăng nhập Cloud để kiểm tra mạng lưới rủi ro.');
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Không thể kiểm tra rủi ro (${response.status}).`);
  return data;
}

export const NetworkRiskService = {
  check(phone) { return rpc('check_network_risk', { p_phone: String(phone || '') }); },
  report(phone, riskType, severity = 1, note = '') { return rpc('report_network_risk', { p_phone: String(phone || ''), p_risk_type: riskType, p_severity: severity, p_note: note || null }); }
};
