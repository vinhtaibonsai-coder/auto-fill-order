// tests/security/xss-escape.test.mjs — P0-5 XSS escape for extraNote + audit innerHTML
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function escapeHTML(s){
  return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// 1. escapeHTML unit
{
  const payload = '<img src=x onerror=alert(1)>';
  const escaped = escapeHTML(payload);
  assert.equal(escaped, '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escaped.includes('<img'), false);
  assert.ok(escaped.includes('&lt;img'));
}
{
  const payload = 'a & b "c" \'d\' <e>';
  assert.equal(escapeHTML(payload), 'a &amp; b &quot;c&quot; &#39;d&#39; &lt;e&gt;');
}
console.log('PASS [escapeHTML unit]');

// 2. Kiểm tra ParseReview.jsx dùng input value (React escape) không dùng dangerouslySetInnerHTML cho extraNote
{
  const parseReview = fs.readFileSync(path.join(root,'src/ui/panel/components/ParseReview.jsx'),'utf8');
  assert.ok(parseReview.includes('value={formData.extraNote}'), 'ParseReview phải render extraNote qua value/input (escaped by React)');
  assert.ok(!parseReview.includes('dangerouslySetInnerHTML'), 'ParseReview không được dùng dangerouslySetInnerHTML');
  // đảm bảo không có innerHTML = extraNote
  assert.ok(!/innerHTML\s*=\s*[^;]*extraNote/.test(parseReview), 'Không render extraNote qua innerHTML');
}
console.log('PASS [ParseReview extraNote escaped via React]');

// 3. Audit toàn repo: toast message phải được escapeHTML
{
  const toastFiles = [
    'frontend/options/options-init.js',
    'extension/frontend/options/options-init.js',
    'admin-dashboard/options-init.js'
  ];
  for(const rel of toastFiles){
    const p=path.join(root,rel);
    if(!fs.existsSync(p)) continue;
    const c=fs.readFileSync(p,'utf8');
    // toast innerHTML phải có escapeHTML(message)
    if(c.includes('toast.innerHTML')){
      assert.ok(c.includes('escapeHTML(message)'), `${rel} toast phải escape message: ${rel}`);
    }
  }
}
console.log('PASS [toast message escape]');

// 4. Audit device/role/shop selects phải escape
{
  const checkFiles = [
    'admin-dashboard/shops.js',
    'admin-dashboard/app.js',
    'frontend/options/options-logs.js'
  ];
  for(const rel of checkFiles){
    const p=path.join(root,rel);
    if(!fs.existsSync(p)) continue;
    const c=fs.readFileSync(p,'utf8');
    // nếu có devices.map với innerHTML thì phải có escapeHTML
    if(c.includes('devices.map') && c.includes('innerHTML')){
      // kiểm tra có escapeHTML(d) trong file
      assert.ok(c.includes('escapeHTML(d)'), `${rel} devices.map phải escape d`);
    }
  }
}
console.log('PASS [devices/roles escape]');

// 5. Chạy audit script logic (P0-5) - đảm bảo không còn violation dạng extraNote without escape
{
  // reuse audit logic inline - ensure no innerHTML with extraNote without escape
  const scanDirs=['src','frontend','extension/src','extension/frontend','admin-dashboard'];
  function getFiles(dir){
    const out=[];
    const full=path.join(root,dir);
    if(!fs.existsSync(full)) return out;
    for(const e of fs.readdirSync(full,{withFileTypes:true})){
      if(e.name.startsWith('.') || e.name==='node_modules' || e.name==='dist' || e.name==='assets') continue;
      const fp=path.join(full,e.name);
      if(e.isDirectory()) out.push(...getFiles(path.join(dir,e.name)));
      else if(/\.(js|jsx|ts|tsx)$/.test(e.name)) out.push(fp);
    }
    return out;
  }
  let violations=[];
  for(const d of scanDirs){
    const files=getFiles(d);
    for(const f of files){
      const content=fs.readFileSync(f,'utf8');
      const lines=content.split('\n');
      lines.forEach((line,idx)=>{
        if(line.includes('innerHTML') && line.includes('=') && line.includes('extraNote')){
          const window=lines.slice(Math.max(0,idx-2),idx+3).join('\n');
          const hasEscape=window.includes('escapeHTML')||window.includes('esc(')||window.includes('DOMPurify');
          if(!hasEscape){
            violations.push(`${path.relative(root,f)}:${idx+1}`);
          }
        }
      });
    }
  }
  assert.equal(violations.length,0, `Found innerHTML with extraNote without escape: ${violations.join(', ')}`);
}
console.log('PASS [audit extraNote innerHTML]');

console.log('\n== XSS Escape Security Test == ALL PASS ✅');
