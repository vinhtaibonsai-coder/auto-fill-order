import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

console.log('Running OTA Version Checker and Packager Unit Tests...');

// 1. Test compareSemver algorithm
import { compareSemver, normalizeRolloutPercentage } from '../../src/domain/version/version-checker.js';

assert.equal(compareSemver('1.0.1', '1.0.0'), 1, '1.0.1 must be greater than 1.0.0');
assert.equal(compareSemver('1.0.0', '1.0.1'), -1, '1.0.0 must be less than 1.0.1');
assert.equal(compareSemver('1.0.0', '1.0.0'), 0, '1.0.0 must equal 1.0.0');
assert.equal(compareSemver('2.0.0', '1.9.9'), 1, '2.0.0 must be greater than 1.9.9');
assert.equal(compareSemver('1.1.0', '1.0.9'), 1, '1.1.0 must be greater than 1.0.9');
assert.equal(compareSemver('v1.2.3', '1.2.3'), 0, 'Prefix v must be normalized');
assert.equal(compareSemver('1.1', '1.0.5'), 1, 'Short version 1.1 must be treated as 1.1.0 and exceed 1.0.5');
assert.equal(compareSemver('1.0.0', '1.1'), -1, '1.0.0 must be less than 1.1.0');
assert.equal(normalizeRolloutPercentage(0), 0, 'Zero rollout must remain zero');
assert.equal(normalizeRolloutPercentage('25'), 25, 'Numeric rollout strings must be normalized');
assert.equal(normalizeRolloutPercentage(150), 100, 'Rollout must be clamped to 100');
assert.equal(normalizeRolloutPercentage(-5), 0, 'Rollout must be clamped to zero');
assert.equal(normalizeRolloutPercentage(null), null, 'Missing rollout must remain unknown');
assert.equal(normalizeRolloutPercentage('invalid'), null, 'Invalid rollout must remain unknown');

console.log('✅ SemVer comparison algorithm tests passed.');

// 2. Test Force Update & Blocking Logic
function evaluateUpdateStatus(currentVersion, release) {
  const hasUpdate = compareSemver(release.version, currentVersion) > 0;
  const isBelowMin = release.min_supported_version ? compareSemver(currentVersion, release.min_supported_version) < 0 : false;
  const isForceUpdate = hasUpdate && (release.is_force_update === true || isBelowMin);
  return {
    hasUpdate,
    isForceUpdate,
    isBlocked: isForceUpdate
  };
}

// Case A: Minor patch, not force update
const resA = evaluateUpdateStatus('1.0.0', {
  version: '1.0.1',
  min_supported_version: '1.0.0',
  is_force_update: false
});
assert.equal(resA.hasUpdate, true, 'Should detect update');
assert.equal(resA.isForceUpdate, false, 'Should not force update when current equals min');
assert.equal(resA.isBlocked, false, 'Should not block app');

// Case B: Current version is below min_supported_version (e.g. 1.0.0 < 1.1.0)
const resB = evaluateUpdateStatus('1.0.0', {
  version: '1.1.0',
  min_supported_version: '1.1.0',
  is_force_update: false
});
assert.equal(resB.hasUpdate, true, 'Should detect update');
assert.equal(resB.isForceUpdate, true, 'Should force update when current is below min');
assert.equal(resB.isBlocked, true, 'Should block app when below min supported version');

// Case C: Explicit is_force_update = true
const resC = evaluateUpdateStatus('1.0.1', {
  version: '1.0.2',
  min_supported_version: '1.0.0',
  is_force_update: true
});
assert.equal(resC.isForceUpdate, true, 'Should force update when flag is set');
assert.equal(resC.isBlocked, true, 'Should block app');

// Case D: Already on latest version
const resD = evaluateUpdateStatus('1.1.0', {
  version: '1.1.0',
  min_supported_version: '1.0.0',
  is_force_update: true
});
assert.equal(resD.hasUpdate, false, 'Latest version has no update');
assert.equal(resD.isBlocked, false, 'Latest version is not blocked');

console.log('✅ Force Update and Blocking logic tests passed.');

// 3. Test Database Migration v95 contracts
const migrationV95 = readSource('database/migrations/v95_release_download_url.sql');
assert.match(migrationV95, /download_url TEXT/, 'Migration v95 must add download_url column');
assert.match(migrationV95, /p_download_url TEXT DEFAULT NULL/, 'admin_publish_release must accept p_download_url');

// 4. Test Service Worker Integration
const serviceWorker = readSource('src/runtime/service-worker/service-worker.js');
assert.match(serviceWorker, /ALARM_VERSION_CHECK\s*=\s*'ag_version_check'/, 'Service worker must define ALARM_VERSION_CHECK');
assert.match(serviceWorker, /_autoCheckVersion/, 'Service worker must implement _autoCheckVersion');
assert.match(serviceWorker, /message\.action\s*===\s*'checkAppUpdate'/, 'Service worker must handle checkAppUpdate message');

// 5. Test Options and Panel UI Integration
const optionsApp = readSource('src/ui/options/App.jsx');
assert.match(optionsApp, /updateStatus\?\.hasUpdate/, 'Options App must display update banner when update is available');
assert.match(optionsApp, /updateStatus\.isBlocked/, 'Options App must style blocking alert on force update');

const panelApp = readSource('src/ui/panel/App.jsx');
assert.match(panelApp, /updateStatus\?\.hasUpdate/, 'Panel App must display update banner in DraggableCard');
assert.match(panelApp, /updateStatus\.downloadUrl/, 'Panel App must provide download link button');

// 6. Test Package Release Script and package.json configuration
const packageJson = readSource('package.json');
const pkg = JSON.parse(packageJson);
assert.match(packageJson, /"release:pack":\s*"node scripts\/package-release\.js"/, 'package.json must expose release:pack script');
assert.match(packageJson, /"version":\s*"\d+\.\d+\.\d+"/, 'package.json must have standardized SemVer format');

const manifestJson = readSource('manifest.json');
const manifest = JSON.parse(manifestJson);
assert.match(manifestJson, /"version":\s*"\d+\.\d+\.\d+"/, 'manifest.json must have standardized SemVer format');
assert.equal(pkg.version, manifest.version, 'package.json and manifest.json versions must match');

const packScript = readSource('scripts/package-release.js');
assert.match(packScript, /AutoFillOrder-v/, 'package-release.js must generate AutoFillOrder-v{version}.zip');
assert.match(packScript, /replace\(\/\\\\\/g,\s*'\/'\)/, 'package-release.js must normalize all path separators to POSIX forward slashes');

// 7. Verify generated release ZIP (if present) conforms strictly to POSIX forward slashes
const releaseZipPath = path.join(rootDir, `dist-release/AutoFillOrder-v${pkg.version}.zip`);
const fallbackZipPath = path.join(rootDir, 'dist-release/AutoFillOrder-v1.0.0.zip');
const targetZip = fs.existsSync(releaseZipPath) ? releaseZipPath : (fs.existsSync(fallbackZipPath) ? fallbackZipPath : null);
if (targetZip) {
  const buf = fs.readFileSync(targetZip);
  const pos = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(pos > 0, 'Release ZIP must contain End of Central Directory record');
  const cdOffset = buf.readUInt32LE(pos + 16);
  let curr = cdOffset;
  const entries = [];
  while (curr < pos) {
    const sig = buf.readUInt32LE(curr);
    if (sig !== 0x02014b50) break;
    const fnLen = buf.readUInt16LE(curr + 28);
    const extraLen = buf.readUInt16LE(curr + 30);
    const commentLen = buf.readUInt16LE(curr + 32);
    const fn = buf.toString('utf8', curr + 46, curr + 46 + fnLen);
    entries.push(fn);
    curr += 46 + fnLen + extraLen + commentLen;
  }
  const backslashes = entries.filter(e => e.includes('\\'));
  assert.equal(backslashes.length, 0, `Release ZIP entries MUST NOT contain backslashes: ${backslashes.slice(0, 5).join(', ')}`);
  assert.ok(entries.some(e => e === 'src/runtime/service-worker/service-worker.js'), 'Release ZIP must contain src/runtime/service-worker/service-worker.js');
  console.log(`✅ Release ZIP path normalization verified: 0 backslashes across ${entries.length} entries.`);
}

console.log('\n🎉 ALL OTA VERSION CHECKER AND RELEASE PACKAGER CONTRACT TESTS PASSED!');
