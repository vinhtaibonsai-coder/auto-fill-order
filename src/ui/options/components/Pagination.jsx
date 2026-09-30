import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({
  page = 1,
  pageSize = 25,
  total = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'bản ghi'
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, total);

  // Generate page numbers for smart pagination
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        background: 'var(--surface-muted, #f8fafc)',
        borderTop: '1px solid var(--border, #e2e8f0)',
        flexWrap: 'wrap',
        fontSize: '13px',
        color: 'var(--text-main, #0f172a)'
      }}
    >
      {/* Left: Record summary */}
      <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '13px', fontWeight: 500 }}>
        Hiển thị <strong>{startRecord}–{endRecord}</strong> trên tổng số <strong>{total.toLocaleString('vi-VN')}</strong> {itemLabel}
      </div>

      {/* Right: Controls & Page buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Page size selector */}
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <select
              aria-label="Số lượng mỗi trang"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--card, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '12.5px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} / trang
                </option>
              ))}
            </select>
          </div>
        )}

        {/* First Page */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          title="Trang đầu tiên"
          style={{
            padding: '5px 7px',
            borderRadius: '6px',
            border: '1px solid var(--border, #cbd5e1)',
            background: currentPage <= 1 ? 'transparent' : 'var(--card, #ffffff)',
            color: currentPage <= 1 ? 'var(--text-subtle, #94a3b8)' : 'var(--text-main, #0f172a)',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: currentPage <= 1 ? 0.5 : 1
          }}
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Trang trước"
          style={{
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border, #cbd5e1)',
            background: currentPage <= 1 ? 'transparent' : 'var(--card, #ffffff)',
            color: currentPage <= 1 ? 'var(--text-subtle, #94a3b8)' : 'var(--text-main, #0f172a)',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12.5px',
            fontWeight: 600,
            opacity: currentPage <= 1 ? 0.5 : 1
          }}
        >
          <ChevronLeft size={14} /> Trước
        </button>

        {/* Page numbers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`dot_${idx}`}
                  style={{ padding: '0 4px', color: 'var(--text-muted, #94a3b8)', fontSize: '12px' }}
                >
                  …
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '28px',
                  height: '28px',
                  padding: '0 6px',
                  borderRadius: '6px',
                  border: isCurrent ? '1px solid var(--primary, #2563eb)' : '1px solid transparent',
                  background: isCurrent ? 'var(--primary, #2563eb)' : 'transparent',
                  color: isCurrent ? '#ffffff' : 'var(--text-main, #0f172a)',
                  fontWeight: isCurrent ? 700 : 500,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Trang tiếp theo"
          style={{
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border, #cbd5e1)',
            background: currentPage >= totalPages ? 'transparent' : 'var(--card, #ffffff)',
            color: currentPage >= totalPages ? 'var(--text-subtle, #94a3b8)' : 'var(--text-main, #0f172a)',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12.5px',
            fontWeight: 600,
            opacity: currentPage >= totalPages ? 0.5 : 1
          }}
        >
          Sau <ChevronRight size={14} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Trang cuối cùng"
          style={{
            padding: '5px 7px',
            borderRadius: '6px',
            border: '1px solid var(--border, #cbd5e1)',
            background: currentPage >= totalPages ? 'transparent' : 'var(--card, #ffffff)',
            color: currentPage >= totalPages ? 'var(--text-subtle, #94a3b8)' : 'var(--text-main, #0f172a)',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: currentPage >= totalPages ? 0.5 : 1
          }}
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
