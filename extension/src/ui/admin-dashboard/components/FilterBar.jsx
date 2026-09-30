import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export default function FilterBar({ value = '', onSearch, filters = [], actions = null, placeholder = 'Tìm kiếm…' }) {
  const [query, setQuery] = useState(value);
  useEffect(() => setQuery(value), [value]);
  useEffect(() => { const timer = setTimeout(() => onSearch?.(query), 300); return () => clearTimeout(timer); }, [query, onSearch]);

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
      <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
        <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', paddingLeft: 34, boxSizing: 'border-box' }}
        />
      </div>

      {filters.map(filter => (
        <label key={filter.key} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#475569', fontWeight: 600 }}>
          {filter.label}:
          <select value={filter.value} onChange={e => filter.onChange(e.target.value)} style={{ fontWeight: 500 }}>
            {filter.options.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ))}

      {actions}
    </div>
  );
}
