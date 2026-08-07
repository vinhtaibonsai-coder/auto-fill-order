const fs = require('fs');
const html = fs.readFileSync('admin-dashboard/index.html', 'utf8');

// Regex patterns to remove specific elements (matching the whole main/div tag)
let newHtml = html.replace(/<main id="section-users"[\s\S]*?<\/main>/g, '');
newHtml = newHtml.replace(/<main id="section-audit"[\s\S]*?<\/main>/g, '');
newHtml = newHtml.replace(/<div id="create-shop-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '');
newHtml = newHtml.replace(/<div id="user-role-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '');
newHtml = newHtml.replace(/<div id="edit-shop-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '');

fs.writeFileSync('admin-dashboard/index.html', newHtml, 'utf8');
console.log('Admin sections removed successfully.');
