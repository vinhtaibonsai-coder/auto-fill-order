import React from 'react';

export function SkeletonTableRows({ columns = 4, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} style={{ padding: '12px 16px' }}>
              <div className="skeleton-box skeleton-text" style={{ width: c === 0 ? '80%' : '50%', marginBottom: 0 }}></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function SkeletonTable({ columns = 4, rows = 5 }) {
  return (
    <div className="admin-table-container">
      <table className="admin-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}><div className="skeleton-box skeleton-text" style={{ width: '60%', marginBottom: 0 }}></div></th>
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
