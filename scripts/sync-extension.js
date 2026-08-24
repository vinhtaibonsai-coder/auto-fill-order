const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const children = fs.readdirSync(src);
    for (const child of children) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

const itemsToSync = ['manifest.json', 'src', 'public', 'admin.html', 'options.html', 'index.html'];
const targetBase = path.resolve(__dirname, '..', 'extension');

itemsToSync.forEach(item => {
  const srcPath = path.resolve(__dirname, '..', item);
  const destPath = path.join(targetBase, item);
  copyRecursive(srcPath, destPath);
});

console.log('✅ Extension folder synchronized successfully with all latest source files!');
