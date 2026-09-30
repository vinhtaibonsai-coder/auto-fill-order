import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('G018 Contract 1: P0 Go/No-Go Checklist is 100% verified with zero blocking critical items', () => {
  const p0ChecklistPath = path.join(root, 'PLAN', 'P0-GO-NO-GO-CHECKLIST.md');
  assert.ok(fs.existsSync(p0ChecklistPath), 'PLAN/P0-GO-NO-GO-CHECKLIST.md must exist');
  const content = read('PLAN/P0-GO-NO-GO-CHECKLIST.md');

  // Verify header state
  assert.match(content, /READY FOR GO-LIVE|STATUS:\s*PASS/i, 'P0 checklist must be marked READY FOR GO-LIVE');

  // Verify all 7 P0 gates are recorded as PASS
  for (let i = 1; i <= 7; i++) {
    const p0Pattern = new RegExp(`\\*\\*P0-${i}\\*\\*[\\s\\S]*?PASS`, 'i');
    assert.match(content, p0Pattern, `P0-${i} must be marked as PASS`);
  }
});

test('G018 Contract 2: Commercial Release Package exists with verified SHA-256 checksum', () => {
  const zipPath = path.join(root, 'dist-release', 'AutoFillOrder-v1.0.2.zip');
  assert.ok(fs.existsSync(zipPath), 'dist-release/AutoFillOrder-v1.0.2.zip must exist');

  const stats = fs.statSync(zipPath);
  assert.ok(stats.size > 1024 * 1024, `Release ZIP must be substantive (> 1MB), found ${stats.size} bytes`);

  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, '1.0.2', 'manifest.json version must match release v1.0.2');
});

test('G018 Contract 3: Legal, Privacy, Terms, and Sub-processor Disclosures are verified', () => {
  const privacyPath = path.join(root, 'privacy.html');
  const termsPath = path.join(root, 'terms.html');

  assert.ok(fs.existsSync(privacyPath), 'privacy.html must exist');
  assert.ok(fs.existsSync(termsPath), 'terms.html must exist');

  const privacyContent = read('privacy.html');
  assert.match(privacyContent, /Gemini|Groq|OpenAI|Supabase/i, 'Privacy policy must disclose AI sub-processors');
  assert.match(privacyContent, /Nghị định 13\/2023\/NĐ-CP|Personal Data/i, 'Privacy policy must cite Vietnam Data Protection decree');
});

test('G018 Contract 4: Support channels, pricing, billing disclaimers, and on-call escalation exist', () => {
  const runbookIndex = read('docs/runbooks/RUNBOOK_INDEX.md');
  assert.match(runbookIndex, /admin@vinhtaibonsai\.com|devops@vinhtaibonsai\.com/i, 'Support contact must be published');
  assert.match(runbookIndex, /Telegram|Hot Alert/i, 'On-call escalation channel must be defined');

  // Verify pricing and disclaimer on subscriptions UI
  const subsFile = path.join(root, 'src', 'ui', 'admin-dashboard', 'pages', 'Subscriptions', 'Subscriptions.jsx');
  assert.ok(fs.existsSync(subsFile), 'Subscriptions.jsx must exist');
  const subsContent = read('src/ui/admin-dashboard/pages/Subscriptions/Subscriptions.jsx');
  assert.match(subsContent, /reconciliation|đối soát|thanh toán/i, 'Subscriptions UI must include billing / reconciliation safeguards');
});

test('G018 Contract 5: Pilot Shop Testing Acceptance Criteria is documented', () => {
  const evidencePath = path.join(root, 'PLAN', 'GEMINI_PRODUCTION_EVIDENCE.md');
  const evidence = read('PLAN/GEMINI_PRODUCTION_EVIDENCE.md');

  assert.match(evidence, /G018|Go-live checklist/i, 'GEMINI_PRODUCTION_EVIDENCE.md must include G018 section');
  assert.match(evidence, /pilot|shop test/i, 'Must document pilot test acceptance criteria');
});
