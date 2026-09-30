import React, { useState } from 'react';
import { OrderStorage } from '../../../../application/storage.esm.js';
import '../../../../domain/parser/bulk-parser.service.js';

export default function Bulk() {
  const [rawText, setRawText] = useState('');
  const [status, setStatus] = useState('IDLE'); // IDLE, PROCESSING, SUCCESS
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [parsedOrders, setParsedOrders] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');

  const parser = globalThis.BulkParserService || {};

  const handleBulkParse = async () => {
    if (!rawText.trim()) return alert('Vui lòng nhập văn bản chứa thông tin đơn hàng!');
    if (typeof parser.parseBulkOrders !== 'function') {
      return alert('Dịch vụ bóc tách hàng loạt chưa sẵn sàng.');
    }

    setStatus('PROCESSING');
    setSaveStatus('');
    try {
      const results = await parser.parseBulkOrders(rawText, (prog) => {
        setProgress(prog);
      });
      setParsedOrders(results);
      setStatus('SUCCESS');
    } catch (err) {
      alert('Có lỗi xảy ra khi bóc tách: ' + err.message);
      setStatus('IDLE');
    }
  };

  const handleFieldChange = (index, field, value) => {
    setParsedOrders(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveToDrafts = async () => {
    if (!parsedOrders.length) return;
    setSaveStatus('SAVING');
    try {
      if (OrderStorage && typeof OrderStorage.saveOrder === 'function') {
        for (const order of parsedOrders) {
          await OrderStorage.saveOrder({
            name: order.name,
            phone: order.phone,
            address: order.address,
            cod_amount: Number(order.cod) || 0,
            order_code: order.orderCode,
            goods_name: order.goodsName,
            weight: order.weightGrams,
            notes: order.notes,
            status: 'draft',
            rawText: order.rawText
          });
        }
      }
      setSaveStatus('SAVED');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setSaveStatus('ERROR');
      alert('Lỗi lưu đơn nháp: ' + err.message);
    }
  };

  const handleExportVNPost = () => {
    if (!parsedOrders.length) return;
    const csv = parser.exportCarrierCsv(parsedOrders, 'vnpost');
    parser.downloadCsvFile(csv, `VNPost_DonHang_${Date.now()}.csv`);
  };

  const handleExportJT = () => {
    if (!parsedOrders.length) return;
    const csv = parser.exportCarrierCsv(parsedOrders, 'jt');
    parser.downloadCsvFile(csv, `JT_DonHang_${Date.now()}.csv`);
  };

  const handleReset = () => {
    setParsedOrders([]);
    setRawText('');
    setStatus('IDLE');
    setProgress({ current: 0, total: 0, percent: 0 });
    setSaveStatus('');
  };

  return (
    <div style={{ maxWidth: '1100px' }}>
      <h2 className="page-title">Tách đơn hàng loạt & Xuất File Excel</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '13.5px' }}>
        Copy và dán danh sách nhiều đơn hàng cùng lúc (Mỗi đơn cách nhau dòng trống, hoặc tự nhận diện theo SĐT).
        Hệ thống sẽ bóc tách vào bảng lưới, cho phép sửa trực tiếp và xuất file Excel chuẩn template bưu cục.
      </p>

      {/* INPUT CARD */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <textarea 
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Dán văn bản nhiều đơn vào đây... Ví dụ:&#10;Đơn 1: Chị Lan 0987654321, 123 Lê Lợi P. Bến Nghé Q1 HCM, thu hộ 250k, váy hoa&#10;Đơn 2: Anh Hùng 0912345678, số 15 Hai Bà Trưng Hoàn Kiếm Hà Nội, cod 300.000đ...`}
          style={{
            width: '100%',
            height: '180px',
            padding: '14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '13.5px',
            lineHeight: '1.6',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: '16px',
            background: 'var(--bg)'
          }}
        />

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={handleBulkParse}
            disabled={status === 'PROCESSING'}
            style={{ 
              background: 'var(--primary)', 
              color: 'white', 
              border: 'none', 
              padding: '11px 22px', 
              borderRadius: '8px', 
              fontWeight: 700, 
              cursor: status === 'PROCESSING' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: status === 'PROCESSING' ? 0.7 : 1
            }}
          >
            {status === 'PROCESSING' ? `🔄 Đang bóc tách (${progress.current}/${progress.total})...` : '⚡ Bóc tách tất cả (Bulk)'}
          </button>

          {parsedOrders.length > 0 && (
            <button
              onClick={handleReset}
              style={{
                padding: '11px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: 'pointer'
              }}
            >
              Làm mới / Nhập lại
            </button>
          )}
        </div>

        {/* PROGRESS BAR */}
        {status === 'PROCESSING' && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              <span>Tiến độ bóc tách</span>
              <span>{progress.percent}% ({progress.current}/{progress.total} đơn)</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress.percent}%`, height: '100%', background: 'var(--primary)', transition: 'width .2s ease' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* RESULTS DATA GRID */}
      {parsedOrders.length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Danh Sách Đơn Đã Bóc Tách ({parsedOrders.length} đơn)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Bạn có thể sửa trực tiếp nội dung từng ô trước khi lưu nháp hoặc xuất file Excel.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleSaveToDrafts}
                disabled={saveStatus === 'SAVING'}
                style={{
                  padding: '9px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#10b981',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {saveStatus === 'SAVING' ? 'Đang lưu...' : saveStatus === 'SAVED' ? '✓ Đã Lưu Xong' : '💾 Lưu Vào Đơn Nháp'}
              </button>

              <button
                onClick={handleExportVNPost}
                style={{
                  padding: '9px 16px',
                  borderRadius: '6px',
                  border: '1px solid #0056b3',
                  background: '#e0f2fe',
                  color: '#0056b3',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                📥 Xuất File VNPost (.csv)
              </button>

              <button
                onClick={handleExportJT}
                style={{
                  padding: '9px 16px',
                  borderRadius: '6px',
                  border: '1px solid #e11d48',
                  background: '#ffe4e6',
                  color: '#e11d48',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                📥 Xuất File J&T (.csv)
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', width: '40px' }}>STT</th>
                  <th style={{ padding: '10px', width: '110px' }}>Mã đơn</th>
                  <th style={{ padding: '10px', width: '130px' }}>Người nhận</th>
                  <th style={{ padding: '10px', width: '110px' }}>Điện thoại</th>
                  <th style={{ padding: '10px' }}>Địa chỉ nhận hàng</th>
                  <th style={{ padding: '10px', width: '100px' }}>Tiền COD</th>
                  <th style={{ padding: '10px', width: '120px' }}>Hàng hóa</th>
                  <th style={{ padding: '10px', width: '70px' }}>Gram</th>
                </tr>
              </thead>
              <tbody>
                {parsedOrders.map((ord, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="text"
                        value={ord.orderCode || ''}
                        onChange={(e) => handleFieldChange(idx, 'orderCode', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="text"
                        value={ord.name || ''}
                        onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="text"
                        value={ord.phone || ''}
                        onChange={(e) => handleFieldChange(idx, 'phone', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px', fontFamily: 'monospace' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="text"
                        value={ord.address || ''}
                        onChange={(e) => handleFieldChange(idx, 'address', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="number"
                        value={ord.cod || 0}
                        onChange={(e) => handleFieldChange(idx, 'cod', Number(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, color: 'var(--success)' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="text"
                        value={ord.goodsName || ''}
                        onChange={(e) => handleFieldChange(idx, 'goodsName', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="number"
                        value={ord.weightGrams || 200}
                        onChange={(e) => handleFieldChange(idx, 'weightGrams', Number(e.target.value) || 200)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
