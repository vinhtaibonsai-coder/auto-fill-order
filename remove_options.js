const fs = require('fs');
let html = fs.readFileSync('frontend/options/options.html', 'utf8');

// Remove nav items
const navsToRemove = ['submitted', 'orders', 'customers', 'shops', 'analytics', 'bulk'];
for (const nav of navsToRemove) {
    const regex = new RegExp('<button class="nav-item[\\s\\S]*?data-tab="' + nav + '"[\\s\\S]*?</button>', 'g');
    html = html.replace(regex, '');
}

// Remove the actual tab content divs.
const tabsToRemove = ['tab-orders', 'tab-submitted', 'tab-customers', 'tab-shops', 'tab-analytics', 'tab-bulk'];
for (const tab of tabsToRemove) {
    const regex = new RegExp('<div id="' + tab + '" class="tab-content"[\\s\\S]*?</div>\\s*<!-- TAB', 'g');
    html = html.replace(regex, '<!-- TAB');
}

fs.writeFileSync('frontend/options/options.html', html, 'utf8');
console.log('Removed successfully.');
