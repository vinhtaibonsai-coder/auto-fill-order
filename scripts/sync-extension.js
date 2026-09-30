const fs = require('fs');
const path = require('path');

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (_) {}
  }
}

function isIllegalFile(filename) {
  const lower = path.basename(filename).toLowerCase();
  return lower === 'desktop.ini' || lower === 'thumbs.db' || lower === '.ds_store' || lower.endsWith('_raw.json');
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  try {
    if (isIllegalFile(src)) return;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      ensureDirSync(dest);
      const children = fs.readdirSync(src);
      for (const child of children) {
        if (!isIllegalFile(child)) {
          copyRecursive(path.join(src, child), path.join(dest, child));
        }
      }
    } else {
      ensureDirSync(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  } catch (err) {
    console.warn(`[Sync] Notice copying ${src} -> ${dest}:`, err.message);
    throw err;
  }
}

function cleanIllegalFiles(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (isIllegalFile(entry.name)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (_) {
          try { fs.rmSync(fullPath, { force: true }); } catch (_) {}
        }
      } else if (entry.isDirectory()) {
        cleanIllegalFiles(fullPath);
      }
    }
  } catch (_) {}
}

const targetBase = path.resolve(__dirname, '..', 'extension');
ensureDirSync(targetBase);

const sourceItemsToSync = ['manifest.json', 'src', 'public', 'frontend'];
sourceItemsToSync.forEach(item => {
  const srcPath = path.resolve(__dirname, '..', item);
  const destPath = path.join(targetBase, item);
  copyRecursive(srcPath, destPath);
});

const distBase = path.resolve(__dirname, '..', 'dist');
const builtItemsToSync = ['admin.html', 'options.html', 'index.html', 'assets'];
if (fs.existsSync(distBase)) {
  // Clean extension/assets trước khi copy để tránh tích lũy file cũ (P0-2)
  const extAssets = path.join(targetBase, 'assets');
  if (fs.existsSync(extAssets)) {
    try { fs.rmSync(extAssets, { recursive: true, force: true }); } catch (_) {}
  }
  builtItemsToSync.forEach(item => {
    const srcPath = path.join(distBase, item);
    const destPath = path.join(targetBase, item);
    copyRecursive(srcPath, destPath);
  });

  ['privacy.html', 'terms.html'].forEach(item => {
    const srcPath = path.resolve(__dirname, '..', item);
    const destPath = path.join(targetBase, item);
    copyRecursive(srcPath, destPath);
  });

  const pwaItemsToSync = ['manifest.webmanifest', 'pwa-icon.svg'];
  pwaItemsToSync.forEach(item => {
    const srcPath = path.join(distBase, item);
    const destPath = path.join(targetBase, item);
    copyRecursive(srcPath, destPath);
  });
} else {
  ['admin.html', 'options.html', 'index.html', 'privacy.html', 'terms.html'].forEach(item => {
    const srcPath = path.resolve(__dirname, '..', item);
    const destPath = path.join(targetBase, item);
    copyRecursive(srcPath, destPath);
  });
}

// Ensure targetBase and any subdirectories never contain illegal files (e.g. desktop.ini)
cleanIllegalFiles(targetBase);

console.log('✅ Extension folder synchronized successfully with all latest source files (cleaned illegal OS files)!');

