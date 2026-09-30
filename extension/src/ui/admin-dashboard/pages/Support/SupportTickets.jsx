import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Headphones, MessageSquare, AlertCircle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import FilterBar from '../../components/FilterBar';
import TicketDetailModal from '../../modals/TicketDetailModal';
import Pagination from '../../components/Pagination';

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await AdminService.getSupportTickets({ status: status || undefined });
    if (r.success) {
      setTickets(r.data || []);
    } else {
      alert(r.error);
    }
    setLoading(false);
  }, [status]);

  useEffect(() => {
    load();
    const handleRefresh = () => {
      load();
    };
    window.addEventListener('admin:refresh_data', handleRefresh);
    return () => window.removeEventListener('admin:refresh_data', handleRefresh);
  }, [load]);

  const rows = useMemo(() => tickets.filter(t => (
    `${t.subject || ''} ${t.shops?.name || ''}`.toLowerCase().includes(search.toLowerCase())
  )), [tickets, search]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const reply = async (data) => {
    const r = await AdminService.replySupportTicket(data.ticketId, data.reply, data.note);
    if (r.success) {
      setSelected(null);
      load();
    } else {
      alert(r.error);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Headphones size={22} color="#2563eb" />
          Trung Tâm Hỗ Trợ Kỹ Thuật (Support Tickets)
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Tiếp nhận câu hỏi, phản hồi lỗi phát sinh và ghi chú kỹ thuật nội bộ cho khách hàng doanh nghiệp
        </p>
      </div>

      {/* Filter */}
      <FilterBar
        onSearch={setSearch}
        placeholder="Tìm theo tiêu đề yêu cầu, tên shop..."
        filters={[
          {
            key: 'status',
            label: 'Trạng thái',
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'open', label: 'Yêu cầu mới' },
              { value: 'in_progress', label: 'Đang xử lý' },
              { value: 'resolved', label: 'Đã giải quyết' }
            ]
          }
        ]}
        actions={
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
        }
      />

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Mã Ticket</th>
                <th>Cửa hàng</th>
                <th>Tiêu đề yêu cầu</th>
                <th>Mức độ ưu tiên</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                    {loading ? 'Đang tải danh sách ticket...' : 'Không có yêu cầu hỗ trợ nào phù hợp.'}
                  </td>
                </tr>
              ) : (
                paginatedRows.map(t => {
                  const isResolved = t.status === 'resolved';
                  const isInProgress = t.status === 'in_progress';
                  const priority = String(t.priority || 'medium').toLowerCase();

                  return (
                    <tr key={t.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', fontSize: 12.5 }}>
                          #{String(t.id).slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: 13 }}>{t.shops?.name || '—'}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13.5 }}>
                          {t.subject}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            background: priority === 'high' || priority === 'urgent' ? '#fee2e2' : priority === 'medium' ? '#fef3c7' : '#f1f5f9',
                            color: priority === 'high' || priority === 'urgent' ? '#dc2626' : priority === 'medium' ? '#d97706' : '#475569',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase'
                          }}
                        >
                          {priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isResolved ? 'badge-success' : isInProgress ? 'badge-info' : 'badge-warning'}`}>
                          {isResolved ? 'Đã giải quyết' : isInProgress ? 'Đang xử lý' : 'Yêu cầu mới'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelected(t)}
                          style={{
                            padding: '5px 12px',
                            fontSize: 12,
                            background: '#ffffff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: 6,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <MessageSquare size={13} /> Xem & Phản hồi
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && rows.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="yêu cầu"
          />
        )}
      </div>

      <TicketDetailModal
        open={Boolean(selected)}
        ticket={selected}
        onClose={() => setSelected(null)}
        onSubmit={reply}
      />
    </div>
  );
}
