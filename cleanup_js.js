const fs = require('fs');

// 1. Remove script tags from options.html
let optionsHtml = fs.readFileSync('frontend/options/options.html', 'utf8');
const scriptsToRemove = [
    'options-shops.js',
    'options-orders.js',
    'options-history.js',
    'options-analytics.js',
    'options-customers.js',
    'options-bulk.js',
    'options-submitted.js'
];
for (const script of scriptsToRemove) {
    const regex = new RegExp('<script src="' + script + '"></script>\\s*', 'g');
    optionsHtml = optionsHtml.replace(regex, '');
}
fs.writeFileSync('frontend/options/options.html', optionsHtml, 'utf8');
console.log('Cleaned options.html');

// 2. Remove script tag from index.html
let indexHtml = fs.readFileSync('admin-dashboard/index.html', 'utf8');
indexHtml = indexHtml.replace(/<script src="shops\.js"><\/script>\s*/g, '');
fs.writeFileSync('admin-dashboard/index.html', indexHtml, 'utf8');
console.log('Cleaned index.html');

// 3. Delete redundant JS files from filesystem
const path = require('path');
const frontendOptionsDir = path.join(__dirname, 'frontend/options');
for (const script of scriptsToRemove) {
    const filePath = path.join(frontendOptionsDir, script);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Deleted ' + script);
    }
}
