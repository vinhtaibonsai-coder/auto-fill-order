import React from 'react';

export function SkeletonBox({ width = '100%', height = '16px', style = {}, className = '' }) {
  return (
    <div
      className={`skeleton-box ${className}`}
      style={{
        width,
        height,
        ...style
      }}
    />
  );
}

export function SkeletonKpiCard({ style = {} }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        ...style
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBox width="55%" height="12px" />
        <SkeletonBox width="20px" height="20px" style={{ borderRadius: '50%' }} />
      </div>
      <SkeletonBox width="40%" height="22px" style={{ margin: '4px 0' }} />
      <SkeletonBox width="75%" height="11px" />
    </div>
  );
}

export function SkeletonHeroKpis({ count = 4, columns = 'repeat(auto-fit, minmax(220px, 1fr))' }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: '14px',
        width: '100%'
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKpiCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTableRows({ columns = 4, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} style={{ padding: '12px 16px' }}>
              <div
                className="skeleton-box skeleton-text"
                style={{ width: c === 0 ? '75%' : c === 1 ? '60%' : '45%', marginBottom: 0 }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonTable({ columns = 4, rows = 5 }) {
  return (
    <div className="admin-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
      <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f8fafc' }}>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} style={{ padding: '10px 16px' }}>
                <div className="skeleton-box skeleton-text" style={{ width: '50%', marginBottom: 0 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SkeletonTableRows columns={columns} rows={rows} />
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCard({ height = 180, style = {} }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        height: `${height}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxSizing: 'border-box',
        ...style
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBox width="30%" height="16px" />
        <SkeletonBox width="40px" height="16px" />
      </div>
      <SkeletonBox width="100%" height={`${height - 70}px`} style={{ borderRadius: '8px' }} />
    </div>
  );
}

export default {
  SkeletonBox,
  SkeletonKpiCard,
  SkeletonHeroKpis,
  SkeletonTableRows,
  SkeletonTable,
  SkeletonCard
};
