import React, { useCallback, useEffect, useState } from 'react';
import { Truck, Activity, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

const TARGETS = {
  VNPOST: 'https://donhang.vnpost.vn',
  JT: 'https://jtexpress.vn'
};

export default function CarrierHealth() {
  const [rows, setRows] = useState([]);
  const [probing, setProbing] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectorHistory, setSelectorHistory] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await AdminService.getCarrierHealth();
    if (r.success) {
      setRows(r.data || []);
    } else {
      alert(r.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    Promise.all(Object.keys(TARGETS).map(code => AdminService.listRemoteSelectorReleases(code, 10)))
      .then(results => setSelectorHistory(results.flatMap((result, index) => (result.success ? result.data : []).map(item => ({ ...item, carrier_code: item.carrier_code || Object.keys(TARGETS)[index] })))))
      .catch(() => setSelectorHistory([]));
  }, [load]);

  const probe = async (code) => {
    setProbing(code);
    try {
      const result = await AdminService.probeCarrierHealth(code);
      if (!result.success) alert(result.error);
      await load();
    } catch (error) {
      alert(error.message || 'Không thể đo trạng thái hãng vận chuyển.');
    }
    setProbing('');
  };

  const publish = async (code) => {
    const raw = prompt(`JSON selector override cho hãng ${code}:`, '{}');
    if (!raw) return;
    try {
      const selectors = JSON.parse(raw);
      const minVersion = prompt('Phiên bản Extension tối thiểu:', '1.0.0') || '';
      const note = prompt('Lý do phát hành selector:', 'Website hãng thay đổi DOM') || '';
      const r = await AdminService.publishRemoteSelectors({ carrierCode: code, selectors, minVersion, note });
      alert(r.success ? 'Đã phát hành selector từ xa thành công.' : r.error);
      if (r.success) window.dispatchEvent(new CustomEvent('admin:refresh_data'));
    } catch (e) {
      alert('JSON selector không hợp lệ: ' + e.message);
    }
  };

  const rollback = async release => {
    const reason = prompt(`Lý do rollback ${release.carrier_code} về v${release.version}:`, 'Selector mới gây lỗi form');
    if (!reason) return;
    const result = await AdminService.rollbackRemoteSelectors(release.carrier_code, release.version, reason);
    alert(result.success ? `Đã rollback ${release.carrier_code} về v${release.version}.` : result.error);
    if (result.success) {
      const refreshed = await Promise.all(Object.keys(TARGETS).map(code => AdminService.listRemoteSelectorReleases(code, 10)));
      setSelectorHistory(refreshed.flatMap((r, i) => (r.success ? r.data : []).map(item => ({ ...item, carrier_code: item.carrier_code || Object.keys(TARGETS)[i] }))));
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={22} color="#2563eb" />
          Giám Sát & Kết Nối Hãng Vận Chuyển (Carrier Health)
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Kiểm tra trực tiếp độ phản hồi của cổng VNPost / J&T Express và cập nhật Remote DOM Selectors tức thì
        </p>
      </div>

      {/* Action Bar */}
      <div className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.keys(TARGETS).map(code => (
            <div key={code} style={{ display: 'inline-flex', gap: 6, background: '#f8fafc', padding: 4, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <button
                disabled={Boolean(probing)}
                onClick={() => probe(code)}
                style={{
                  background: '#ffffff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: probing ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Activity size={13} className={probing === code ? 'dash-spin' : ''} />
                {probing === code ? `Đang đo ${code}...` : `Đo ping ${code}`}
              </button>
              <button
                onClick={() => publish(code)}
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Send size={13} />
                Phát hành Selector {code}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={load}
          style={{
            padding: '7px 12px',
            fontSize: 12,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <RefreshCw size={13} className={loading ? 'dash-spin' : ''} /> Tải lại
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 10px' }}>Lịch sử Remote Selectors & Rollback</h3>
        {!selectorHistory.length ? <div style={{ color: '#64748b' }}>Chưa có bản phát hành selector.</div> : <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Hãng</th><th>Phiên bản</th><th>Trạng thái</th><th>Extension tối thiểu</th><th>Ghi chú</th><th>Thao tác</th></tr></thead><tbody>{selectorHistory.map(release => <tr key={release.id || `${release.carrier_code}-${release.version}`}><td>{release.carrier_code}</td><td>v{release.version}</td><td>{release.status}</td><td>{release.min_extension_version || 'Mọi phiên bản'}</td><td>{release.release_note || '—'}</td><td><button disabled={release.status === 'active'} onClick={() => rollback(release)}>Rollback về bản này</button></td></tr>)}</tbody></table></div>}
      </div>

      {/* Results Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Hãng vận chuyển</th>
                <th>Trạng thái cổng kết nối</th>
                <th>Thời gian phản hồi</th>
                <th>Chi tiết lỗi</th>
                <th>Thời điểm ghi nhận</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                    {loading ? 'Đang tải lịch sử kết nối...' : 'Chưa có bản ghi đo lường nào.'}
                  </td>
                </tr>
              ) : (
                rows.map(r => {
                  const isHealthy = r.status === 'healthy';
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong style={{ fontSize: 13.5, color: '#0f172a' }}>{r.carrier_code}</strong>
                      </td>
                      <td>
                        <span className={`badge ${isHealthy ? 'badge-success' : 'badge-danger'}`}>
                          {isHealthy ? (
                            <><CheckCircle2 size={12} /> Hoạt động tốt (Healthy)</>
                          ) : (
                            <><AlertCircle size={12} /> Ngoại tuyến / Lỗi (Offline)</>
                          )}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: r.response_time_ms < 500 ? '#16a34a' : '#d97706', fontSize: 13 }}>
                          {r.response_time_ms} ms
                        </span>
                      </td>
                      <td>
                        <span style={{ color: r.error_message ? '#dc2626' : '#64748b', fontSize: 12 }}>
                          {r.error_message || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#475569', fontSize: 12 }}>
                          {new Date(r.detected_at).toLocaleString('vi-VN')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
