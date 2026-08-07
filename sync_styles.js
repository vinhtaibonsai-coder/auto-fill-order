const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'ui', 'styling', 'style.css');
const jsPath = path.join(__dirname, 'ui', 'styling', 'styles.js');

try {
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  // Escape backticks and placeholders to avoid breaking JS template literals
  const escapedCss = cssContent.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  
  const jsContent = `// SOURCE: ui/styling/style.css — chỉnh sửa CSS ở file .css, đồng bộ lại vào đây
(() => {
  const PANEL_CSS = \`
${escapedCss}
\`;

  globalThis.PANEL_CSS = PANEL_CSS;
})();
`;
  
  fs.writeFileSync(jsPath, jsContent, 'utf8');
  console.log('Successfully synced style.css to styles.js');
} catch (err) {
  console.error('Error syncing styles:', err);
  process.exit(1);
}
