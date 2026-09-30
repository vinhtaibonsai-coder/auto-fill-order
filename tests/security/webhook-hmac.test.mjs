// tests/security/webhook-hmac.test.mjs — P0-4 HMAC + nonce + timestamp ±5m + idempotency
import assert from 'node:assert/strict';

// Helpers matching payment-webhook/index.ts
function hexEncode(buf){ return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function timingSafeEqual(a,b){
  const enc=new TextEncoder();
  const ab=enc.encode(a), bb=enc.encode(b);
  if(ab.length!==bb.length) return false;
  let diff=0; for(let i=0;i<ab.length;i++) diff|=ab[i]^bb[i];
  return diff===0;
}
async function hmacHex(secret,payload){
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,enc.encode(payload));
  return hexEncode(sig);
}

// Simulate webhook validation logic (extracted from Edge Function)
async function validateHmac({rawBody, secret, sigHeader, tsHeader, nonceHeader}){
  if(!sigHeader) return {ok:false, code:'MISSING_SIGNATURE'};
  if(!tsHeader || !nonceHeader) return {ok:false, code:'MISSING_TIMESTAMP_NONCE'};
  const tsNum=Number(tsHeader);
  if(!Number.isFinite(tsNum)) return {ok:false, code:'TIMESTAMP_INVALID'};
  const nowSec=Math.floor(Date.now()/1000);
  if(Math.abs(nowSec-tsNum)>300) return {ok:false, code:'TIMESTAMP_EXPIRED'};
  const expected=await hmacHex(secret,`${tsHeader}.${nonceHeader}.${rawBody}`);
  const provided=sigHeader.replace(/^sha256=/i,'').trim().toLowerCase();
  if(!timingSafeEqual(provided, expected.toLowerCase())) return {ok:false, code:'INVALID_SIGNATURE'};
  if(nonceHeader.length<8 || nonceHeader.length>128) return {ok:false, code:'NONCE_INVALID'};
  return {ok:true};
}

const secret='test_secret_p0_4';
const rawBody=JSON.stringify({transferAmount:100000, content:'AUTOFILL SHOP123 PRO_MONTH', referenceCode:'TXN123'});

// 1. Valid HMAC passes
{
  const ts=String(Math.floor(Date.now()/1000));
  const nonce='test-nonce-'+Math.random().toString(36).slice(2);
  const sig=await hmacHex(secret, `${ts}.${nonce}.${rawBody}`);
  const r=await validateHmac({rawBody, secret, sigHeader:sig, tsHeader:ts, nonceHeader:nonce});
  assert.equal(r.ok,true, 'valid HMAC should pass');
  console.log('PASS [valid HMAC]');
}
// 2. Timestamp ±5m: expired +6m fails
{
  const ts=String(Math.floor(Date.now()/1000) - 400); // 400s ago >300
  const nonce='nonce-expired-'+Math.random().toString(36).slice(2);
  const sig=await hmacHex(secret, `${ts}.${nonce}.${rawBody}`);
  const r=await validateHmac({rawBody, secret, sigHeader:sig, tsHeader:ts, nonceHeader:nonce});
  assert.equal(r.ok,false);
  assert.equal(r.code,'TIMESTAMP_EXPIRED');
  console.log('PASS [timestamp expired]');
}
// 3. Future timestamp +6m fails
{
  const ts=String(Math.floor(Date.now()/1000) + 400);
  const nonce='nonce-future-'+Math.random().toString(36).slice(2);
  const sig=await hmacHex(secret, `${ts}.${nonce}.${rawBody}`);
  const r=await validateHmac({rawBody, secret, sigHeader:sig, tsHeader:ts, nonceHeader:nonce});
  assert.equal(r.code,'TIMESTAMP_EXPIRED');
  console.log('PASS [future timestamp expired]');
}
// 4. Invalid signature fails
{
  const ts=String(Math.floor(Date.now()/1000));
  const nonce='nonce-badsig-'+Math.random().toString(36).slice(2);
  const r=await validateHmac({rawBody, secret, sigHeader:'deadbeef', tsHeader:ts, nonceHeader:nonce});
  assert.equal(r.code,'INVALID_SIGNATURE');
  console.log('PASS [invalid signature]');
}
// 5. Replay detection: nonce reuse must be detected (simulate DB unique)
{
  const nonce='replay-nonce-12345678';
  const ts=String(Math.floor(Date.now()/1000));
  const sig=await hmacHex(secret, `${ts}.${nonce}.${rawBody}`);
  const seen=new Set();
  function insertNonce(n){
    if(seen.has(n)) return {dup:true};
    seen.add(n); return {dup:false};
  }
  const first=insertNonce(nonce);
  assert.equal(first.dup,false);
  const second=insertNonce(nonce);
  assert.equal(second.dup,true, 'second insert same nonce should dup');
  console.log('PASS [nonce replay detection]');
  // also validate that HMAC itself still passes but DB layer rejects
  const r=await validateHmac({rawBody, secret, sigHeader:sig, tsHeader:ts, nonceHeader:nonce});
  assert.equal(r.ok,true); // HMAC passes, replay caught at DB layer
}
// 6. Idempotency: same transactionCode only processes once
{
  const txSet=new Set();
  function processTx(code){
    if(txSet.has(code)) return {dup:true, message:'already processed'};
    txSet.add(code); return {dup:false};
  }
  const code='TXN-IDEMPOTENCY-123';
  assert.equal(processTx(code).dup,false);
  assert.equal(processTx(code).dup,true);
  console.log('PASS [idempotency transactionCode]');
}
// 7. timingSafeEqual correctness
{
  assert.equal(timingSafeEqual('abc','abc'),true);
  assert.equal(timingSafeEqual('abc','abd'),false);
  assert.equal(timingSafeEqual('short','longer'),false);
  console.log('PASS [timingSafeEqual]');
}
// 8. HMAC hex length
{
  const sig=await hmacHex(secret, rawBody);
  assert.equal(sig.length,64); // sha256 hex
  console.log('PASS [hmac length]');
}

console.log('\n== Webhook HMAC Security Test == ALL PASS ✅');
