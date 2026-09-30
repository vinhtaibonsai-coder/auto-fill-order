// =============================================================================
// SOCIAL WEBHOOK - Supabase Edge Function (Deno) (EPIC D)
// 
// Production Webhook Gateway for Official Meta Messenger & Zalo Official Account.
// Handles GET verification challenge and POST message ingestion into
// channel_conversations and channel_messages with strict HMAC validation.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const metaAppSecret = (Deno.env.get('META_APP_SECRET') || '').trim();
const metaVerifyToken = (Deno.env.get('META_VERIFY_TOKEN') || '').trim();
const zaloOaSecret = (Deno.env.get('ZALO_OA_SECRET') || '').trim();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-zevent-signature, x-timestamp',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a.toLowerCase().trim());
  const bb = enc.encode(b.toLowerCase().trim());
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return hexEncode(sig);
}

async function computeSha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return hexEncode(digest);
}

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // 1. GET CHALLENGE VERIFICATION (Meta Messenger & Zalo Handshake)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token) {
      if (metaVerifyToken && token === metaVerifyToken) {
        console.log('[Social Webhook] Meta challenge verification successful.');
        return new Response(challenge || 'ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      } else {
        console.warn('[Social Webhook] Meta token mismatch.');
        return new Response('Forbidden: Token mismatch', { status: 403 });
      }
    }

    // Zalo Challenge Handshake (if parameterized)
    const zaloChallenge = url.searchParams.get('challenge');
    if (zaloChallenge) {
      return new Response(zaloChallenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return json({ message: 'Social Webhook Gateway ready' }, 200);
  }

  // 2. POST WEBHOOK INGESTION
  if (req.method === 'POST') {
    const rawBody = await req.text();
    const metaSignature = req.headers.get('x-hub-signature-256') || '';
    const zaloSignature = req.headers.get('x-zevent-signature') || req.headers.get('x-mac') || '';
    const timestamp = req.headers.get('x-timestamp') || '';

    let channelType = 'UNKNOWN';

    // A. Verify Meta Signature
    if (metaSignature) {
      channelType = 'META_MESSENGER';
      if (metaAppSecret) {
        const parts = metaSignature.split('=');
        const actualHex = parts.length === 2 ? parts[1] : metaSignature;
        const expectedHex = await computeHmacSha256Hex(metaAppSecret, rawBody);
        if (!timingSafeEqual(expectedHex, actualHex)) {
          console.warn('[Social Webhook] Invalid Meta HMAC signature.');
          return json({ error: 'INVALID_SIGNATURE' }, 401);
        }
      }
    } 
    // B. Verify Zalo Signature
    else if (zaloSignature) {
      channelType = 'ZALO_OA';
      if (zaloOaSecret) {
        // Check replay window (300 seconds)
        const nowSec = Math.floor(Date.now() / 1000);
        if (timestamp && Math.abs(nowSec - Number(timestamp)) > 300) {
          console.warn('[Social Webhook] Zalo replay attack window exceeded.');
          return json({ error: 'REPLAY_EXPIRED' }, 401);
        }
        const expectedMac = await computeSha256Hex(zaloOaSecret + rawBody + timestamp);
        if (!timingSafeEqual(expectedMac, zaloSignature)) {
          console.warn('[Social Webhook] Invalid Zalo MAC signature.');
          return json({ error: 'INVALID_SIGNATURE' }, 401);
        }
      }
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch (_) {
      return json({ error: 'INVALID_JSON' }, 400);
    }

    // 3. Process & Persist Message into Supabase
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      try {
        if (channelType === 'META_MESSENGER' && Array.isArray(payload.entry)) {
          for (const entry of payload.entry) {
            const pageId = entry.id;
            const messagingList = entry.messaging || [];

            for (const msg of messagingList) {
              const senderId = msg.sender?.id;
              const text = msg.message?.text || '';
              const mid = msg.message?.mid;

              if (!senderId || !mid) continue;

              // Find active channel connection for this Meta page
              const { data: connection } = await supabase
                .from('channel_connections')
                .select('id, shop_id, status')
                .eq('channel_type', 'META_MESSENGER')
                .eq('external_account_id', pageId)
                .single();

              if (!connection || connection.status !== 'ACTIVE') {
                console.warn(`[Social Webhook] No active connection for Meta page ${pageId}`);
                continue;
              }

              // Upsert Conversation
              let { data: conv } = await supabase
                .from('channel_conversations')
                .select('id')
                .eq('connection_id', connection.id)
                .eq('external_conversation_id', senderId)
                .single();

              if (!conv) {
                const { data: newConv } = await supabase
                  .from('channel_conversations')
                  .insert({
                    shop_id: connection.shop_id,
                    connection_id: connection.id,
                    external_conversation_id: senderId,
                    customer_ref: `meta_${senderId}`,
                    status: 'OPEN'
                  })
                  .select('id')
                  .single();
                conv = newConv;
              }

              if (conv?.id) {
                // Insert message (idempotent by external_message_id)
                await supabase
                  .from('channel_messages')
                  .insert({
                    conversation_id: conv.id,
                    shop_id: connection.shop_id,
                    external_message_id: mid,
                    direction: 'INBOUND',
                    text_redacted: text,
                    is_draft_created: false
                  });
              }
            }
          }
        } else if (channelType === 'ZALO_OA') {
          const oaId = payload.oa_id || payload.recipient?.id;
          const senderId = payload.sender?.id;
          const text = payload.message?.text || '';
          const msgId = payload.message?.msg_id || `zalo_${Date.now()}`;

          if (oaId && senderId) {
            const { data: connection } = await supabase
              .from('channel_connections')
              .select('id, shop_id, status')
              .eq('channel_type', 'ZALO_OA')
              .eq('external_account_id', oaId)
              .single();

            if (connection && connection.status === 'ACTIVE') {
              let { data: conv } = await supabase
                .from('channel_conversations')
                .select('id')
                .eq('connection_id', connection.id)
                .eq('external_conversation_id', senderId)
                .single();

              if (!conv) {
                const { data: newConv } = await supabase
                  .from('channel_conversations')
                  .insert({
                    shop_id: connection.shop_id,
                    connection_id: connection.id,
                    external_conversation_id: senderId,
                    customer_ref: `zalo_${senderId}`,
                    status: 'OPEN'
                  })
                  .select('id')
                  .single();
                conv = newConv;
              }

              if (conv?.id) {
                await supabase
                  .from('channel_messages')
                  .insert({
                    conversation_id: conv.id,
                    shop_id: connection.shop_id,
                    external_message_id: msgId,
                    direction: 'INBOUND',
                    text_redacted: text,
                    is_draft_created: false
                  });
              }
            }
          }
        }
      } catch (err: any) {
        console.error('[Social Webhook] Ingestion processing error:', err.message);
      }
    }

    // Always respond 200 OK to Webhook provider to prevent retry flood
    return json({ status: 'EVENT_RECEIVED', channel: channelType }, 200);
  }

  return json({ error: 'Method not allowed' }, 405);
});
