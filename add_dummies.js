const fs = require('fs');

let indexHtml = fs.readFileSync('admin-dashboard/index.html', 'utf8');

const dummies = 
    <!-- DUMMY ELEMENTS FOR PREVENTING APP.JS NULL ERRORS -->
    <div style="display:none;" id="dummy-container">
      <div id="nav-tab-shops"></div>
      <div id="nav-tab-users"></div>
      <div id="nav-tab-audit"></div>
      <div id="right-nav-shops"></div>
      <div id="right-nav-users"></div>
      <div id="right-nav-audit"></div>
      <div id="section-shops"></div>
      <div id="section-users"></div>
      <div id="section-audit"></div>
      <div id="create-shop-btn"></div>
      <div id="btn-add-user"></div>
      <div id="btn-refresh-audit"></div>
      <div id="user-role-modal"></div>
      <div id="create-shop-modal"></div>
      <div id="edit-shop-modal"></div>
    </div>
</body>
</html>
;

indexHtml = indexHtml.replace(/<\/body>\s*<\/html>/i, dummies);
fs.writeFileSync('admin-dashboard/index.html', indexHtml, 'utf8');
console.log('Added dummy DOM elements to index.html');
