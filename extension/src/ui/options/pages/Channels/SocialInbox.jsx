import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, Send, CheckCircle2, AlertCircle, Clock, 
  ExternalLink, FileText, ArrowRight, ShieldCheck, RefreshCw, User, Store
} from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { createDraftFromSocialMessage } from '../../../../domain/social/social-channel.adapter.js';

export default function SocialInbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [draftSuccess, setDraftSuccess] = useState('');

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud?.loadConfig?.();
      if (!sess?.access_token || !config?.url || !sess.active_shop_id) {
        setConversations([]);
        return;
      }

      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };

      const res = await fetch(
        `${config.url}/rest/v1/channel_conversations?shop_id=eq.${sess.active_shop_id}&order=last_message_at.desc&limit=50`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        setConversations(data || []);
      }
    } catch (err) {
      console.error('[SocialInbox] Load conversations error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId) => {
    setLoadingMessages(true);
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud?.loadConfig?.();
      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };

      const res = await fetch(
        `${config.url}/rest/v1/channel_messages?conversation_id=eq.${convId}&order=received_at.asc`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
      }
    } catch (err) {
      console.error('[SocialInbox] Load messages error:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id);
    } else {
      setMessages([]);
    }
  }, [selectedConv, loadMessages]);

  const handleCreateDraft = async (msg) => {
    try {
      const sess = await AuthSession.getSession();
      const draft = await createDraftFromSocialMessage({
        text: msg.text_redacted,
        provider: selectedConv.provider,
        external_message_id: msg.external_message_id,
        customer_ref: selectedConv.customer_ref
      }, sess?.active_shop_id);

      // Save draft into local draft queue or OrderStorage
      if (typeof globalThis.OrderStorage !== 'undefined' && typeof globalThis.OrderStorage.saveDraft === 'function') {
        await globalThis.OrderStorage.saveDraft(draft);
      }

      setDraftSuccess(`Đã tạo bản nháp đơn hàng #${draft.order_code}! Vui lòng chuyển sang tab "Hàng đợi đơn nháp" để duyệt.`);
      setTimeout(() => setDraftSuccess(''), 6000);
    } catch (err) {
      alert('Lỗi tạo bản nháp đơn: ' + err.message);
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (channelFilter === 'ALL') return true;
    return c.provider === channelFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={22} color="#2563eb" />
            Hộp Thư Đa Kênh Chính Thức (Unified Social Inbox)
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Gom hội thoại và bóc tách đơn hàng từ Meta Messenger Platform & Zalo Official Account chính thức
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13 }}
          >
            <option value="ALL">Tất cả kênh kết nối</option>
            <option value="META_MESSENGER">Meta Messenger (Facebook)</option>
            <option value="ZALO_OA">Zalo Official Account</option>
          </select>

          <button
            onClick={loadConversations}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Tải lại
          </button>
        </div>
      </div>

      {draftSuccess && (
        <div style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>{draftSuccess}</span>
        </div>
      )}

      {/* TWO-COLUMN INBOX LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, minHeight: 520, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        {/* LEFT: CONVERSATION LIST */}
        <div style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, fontSize: 13, color: '#334155' }}>
            Hội thoại ({filteredConversations.length})
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConversations.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                Chưa có hội thoại nào từ Webhook chính thức
              </div>
            ) : (
              filteredConversations.map(c => {
                const isSelected = selectedConv?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConv(c)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                        {c.customer_name || 'Khách hàng'}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: c.provider === 'META_MESSENGER' ? '#dbeafe' : '#e0e7ff',
                        color: c.provider === 'META_MESSENGER' ? '#1e40af' : '#4338ca'
                      }}>
                        {c.provider === 'META_MESSENGER' ? 'Messenger' : 'Zalo OA'}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.last_message_preview || 'Không có văn bản'}
                    </div>

                    <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                      {new Date(c.last_message_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(c.last_message_at).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: MESSAGE CHAT & DRAFT ACTIONS */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
          {selectedConv ? (
            <>
              {/* CHAT HEADER */}
              <div style={{ padding: '12px 18px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                    {selectedConv.customer_name || 'Khách hàng'}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    ID: {selectedConv.external_conversation_id} · Kênh: <b>{selectedConv.provider}</b>
                  </div>
                </div>
              </div>

              {/* MESSAGES LIST */}
              <div style={{ flex: 1, padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Đang tải tin nhắn...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Hội thoại chưa có tin nhắn nào.</div>
                ) : (
                  messages.map(m => {
                    const isInbound = m.direction === 'INBOUND';
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isInbound ? 'flex-start' : 'flex-end',
                          gap: 4
                        }}
                      >
                        <div style={{
                          maxWidth: '75%',
                          background: isInbound ? '#ffffff' : '#2563eb',
                          color: isInbound ? '#0f172a' : '#ffffff',
                          border: isInbound ? '1px solid #e2e8f0' : 'none',
                          borderRadius: 12,
                          padding: '10px 14px',
                          fontSize: 13,
                          lineHeight: 1.4,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                        }}>
                          {m.text_redacted}
                        </div>

                        {isInbound && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                            <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                              {new Date(m.received_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={() => handleCreateDraft(m)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                              title="Bóc tách thông tin tin nhắn này thành bản nháp đơn hàng"
                            >
                              <FileText size={12} /> Tạo bản nháp đơn
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: 8 }}>
              <MessageSquare size={36} color="#cbd5e1" />
              <span>Chọn một hội thoại bên trái để xem nội dung và bóc tách đơn hàng</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
