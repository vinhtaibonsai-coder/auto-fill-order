import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page = 1, pageSize = 25, total = 0, onPageChange, onPageSizeChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);

  return (
    <div className="admin-pagination" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '16px 4px 8px', flexWrap: 'wrap' }}>
      <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
        Hiển thị <strong>{total ? (current - 1) * pageSize + 1 : 0}–{Math.min(current * pageSize, total)}</strong> trên tổng số <strong>{total}</strong> bản ghi
      </span>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          aria-label="Số dòng mỗi trang"
          value={pageSize}
          onChange={e => onPageSizeChange?.(Number(e.target.value))}
          style={{ fontSize: 12, padding: '5px 8px' }}
        >
          {[10, 25, 50, 100].map(size => (
            <option key={size} value={size}>{size} dòng / trang</option>
          ))}
        </select>

        <button
          disabled={current <= 1}
          onClick={() => onPageChange?.(current - 1)}
          style={{ padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          <ChevronLeft size={14} /> Trước
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            aria-label="Chuyển đến trang"
            type="number"
            min="1"
            max={pages}
            value={current}
            onChange={e => onPageChange?.(Math.min(pages, Math.max(1, Number(e.target.value) || 1)))}
            style={{ width: 52, textAlign: 'center', padding: '5px 6px', fontSize: 12 }}
          />
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>/ {pages}</span>
        </div>

        <button
          disabled={current >= pages}
          onClick={() => onPageChange?.(current + 1)}
          style={{ padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          Sau <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
