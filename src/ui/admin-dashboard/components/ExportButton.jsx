import React from 'react';
import { Download } from 'lucide-react';

const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function ExportButton({ rows = [], columns = [], filename = 'du-lieu-admin.csv', label = 'Xuất CSV' }) {
  const download = () => {
    const cols = columns.length ? columns : Object.keys(rows[0] || {}).map(key => ({ key, label: key }));
    const csv = '\uFEFF' + [cols.map(c => quote(c.label)).join(','), ...rows.map(row => cols.map(c => quote(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={!rows.length}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        padding: '7px 12px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 8,
        cursor: rows.length ? 'pointer' : 'not-allowed',
        color: rows.length ? '#334155' : '#94a3b8'
      }}
    >
      <Download size={14} />
      {label}
    </button>
  );
}
