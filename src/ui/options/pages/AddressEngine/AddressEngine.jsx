import React, { useState, useEffect } from 'react';

export default function AddressEngine() {
  const [aliases, setAliases] = useState([]);
  
  useEffect(() => {
    if (chrome && chrome.storage) {
      chrome.storage.local.get(['af_address_aliases'], (result) => {
        if (result.af_address_aliases) {
          setAliases(result.af_address_aliases);
        } else {
          setAliases([
            { id: Date.now(), original: 'Thới Lai', mapping: 'Huyện Thới Lai, Cần Thơ' },
            { id: Date.now() + 1, original: 'Q9', mapping: 'Quận 9, TP Hồ Chí Minh' },
          ]);
        }
      });
    }
  }, []);

  const saveAlias = (newAliases) => {
    setAliases(newAliases);
    if (chrome && chrome.storage) {
      chrome.storage.local.set({ 'af_address_aliases': newAliases });
    }
  };

  const handleAdd = () => {
    const original = prompt('Nhập từ khóa viết tắt (VD: q1):');
    if (!original) return;
    const mapping = prompt('Nhập địa chỉ chuẩn xác (VD: Quận 1, TP Hồ Chí Minh):');
    if (!mapping) return;

    saveAlias([...aliases, { id: Date.now(), original, mapping }]);
  };

  const handleDelete = (id) => {
    if (confirm('Xóa từ khóa này?')) {
      saveAlias(aliases.filter(a => a.id !== id));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">Từ điển địa chỉ (Address Engine)</h2>
        <button onClick={handleAdd} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
          + Thêm Từ khóa
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Dạy AI hiểu các từ lóng, viết tắt địa phương để tăng độ chính xác khi nhận diện địa chỉ.
      </p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Từ khóa viết tắt</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Địa chỉ chuẩn xác</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', width: '100px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {aliases.map(alias => (
              <tr key={alias.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px', fontWeight: 600 }}>{alias.original}</td>
                <td style={{ padding: '16px', color: 'var(--primary)' }}>{alias.mapping}</td>
                <td style={{ padding: '16px' }}>
                  <button onClick={() => handleDelete(alias.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>Xóa</button>
                </td>
              </tr>
            ))}
            {aliases.length === 0 && (
              <tr>
                <td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có từ điển nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
