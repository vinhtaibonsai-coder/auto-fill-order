import React from 'react';

export default function OrderSettings() {
  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 className="page-title">Order Workflow & Defaults</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Cấu hình các giá trị mặc định khi tự động điền đơn hàng trên các hãng vận chuyển.
      </p>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Giá trị mặc định (Defaults)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Hãng vận chuyển mặc định</label>
            <select style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <option>VNPost</option>
              <option>J&T Express</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Tên Hàng Hóa Mặc Định</label>
            <input type="text" placeholder="Quần áo" defaultValue="Quần áo" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Trọng Lượng Mặc Định (gram)</label>
            <input type="number" defaultValue={500} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Tiền Thu Hộ (COD) Mặc Định</label>
            <input type="number" defaultValue={0} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Tự động hóa (Workflow)</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input type="checkbox" defaultChecked id="wf-1" style={{ width: '18px', height: '18px' }} />
          <div>
            <label htmlFor="wf-1" style={{ fontWeight: 600, display: 'block' }}>Tự động phân tích (Auto Parse)</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tự động đưa text vào AI ngay khi copy.</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input type="checkbox" defaultChecked id="wf-2" style={{ width: '18px', height: '18px' }} />
          <div>
            <label htmlFor="wf-2" style={{ fontWeight: 600, display: 'block' }}>Tự động chuẩn hóa địa chỉ</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Chạy qua Address Engine để mapping phường/xã.</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input type="checkbox" defaultChecked id="wf-3" style={{ width: '18px', height: '18px' }} />
          <div>
            <label htmlFor="wf-3" style={{ fontWeight: 600, display: 'block' }}>Dừng xem xét nếu độ tin cậy {'< 90%'}</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nếu AI không chắc chắn, sẽ hiện bảng để nhân viên kiểm tra lại.</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input type="checkbox" id="wf-4" style={{ width: '18px', height: '18px' }} />
          <div>
            <label htmlFor="wf-4" style={{ fontWeight: 600, display: 'block', color: 'var(--danger)' }}>Tự động Lưu Đơn (Auto Submit) - RỦI RO</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tự động click nút Lưu trên Hãng vận chuyển sau khi điền (Không khuyến nghị).</span>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '24px' }}>
        <button style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
          Lưu Cấu Hình
        </button>
      </div>
    </div>
  );
}
