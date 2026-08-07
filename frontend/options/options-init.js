// options-init.js — extracted from options.js
// Đồng bộ giao diện sáng/tối
(function initTheme() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['theme'], (res) => {
      if (res && res.theme === 'dark') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.theme) {
        if (changes.theme.newValue === 'dark') {
          document.body.classList.add('dark-mode');
        } else {
          document.body.classList.remove('dark-mode');
        }
      }
    });
  } else {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }
})();

function onDOMReady(fn) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

// Khởi tạo các Element UI
const tabItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// Elements cho Tab API Key
const apiKeyInput = document.getElementById('apiKey');
const apiModelSelect = document.getElementById('apiModel');
const btnSaveApi = document.getElementById('btnSaveApi');
const btnTestApi = document.getElementById('btnTestApi');
const statusEl = document.getElementById('status');

// Elements cho Tab Orders
const statTotalOrders = document.getElementById('stat-total-orders');
const statTotalCod = document.getElementById('stat-total-cod');
const searchInp = document.getElementById('searchInp');
const searchClearOrders = document.getElementById('searchClearOrders');
const filterPlatform = document.getElementById('filterPlatform');
const filterDevice = document.getElementById('filterDevice');
const filterFrom = document.getElementById('filterFrom');
const filterTo = document.getElementById('filterTo');
const btnClearFilters = document.getElementById('btnClearFilters');
const btnOpenAddModal = document.getElementById('btnOpenAddModal');
const ordersListEl = document.getElementById('ordersList');
const emptyStateEl = document.getElementById('emptyState');

// Elements cho Modal Add/Edit
const orderModal = document.getElementById('orderModal');
const orderForm = document.getElementById('orderForm');
const modalTitle = document.getElementById('modalTitle');
const orderIdInput = document.getElementById('orderId');
const formName = document.getElementById('formName');
const formPhone = document.getElementById('formPhone');
const formCode = document.getElementById('formCode');
const formCod = document.getElementById('formCod');
const formDate = document.getElementById('formDate');
const formPlatform = document.getElementById('formPlatform');
const formCollectFee = document.getElementById('formCollectFee');
const formAddress = document.getElementById('formAddress');
const btnCancelModal = document.getElementById('btnCancelModal');
const btnCloseModal = document.getElementById('btnCloseModal');

// Elements cho Modal Delete
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const btnCancelDelModal = document.getElementById('btnCancelDelModal');
const btnCloseDelModal = document.getElementById('btnCloseDelModal');
const btnConfirmDelOrder = document.getElementById('btnConfirmDelOrder');

// Elements cho Bulk Delete
const btnBulkDelete = document.getElementById('btnBulkDelete');
const selectedCountEl = document.getElementById('selectedCount');
const bulkDeleteConfirmModal = document.getElementById('bulkDeleteConfirmModal');
const bulkDeleteCountEl = document.getElementById('bulkDeleteCount');
const btnCloseBulkDelModal = document.getElementById('btnCloseBulkDelModal');
const btnCancelBulkDelModal = document.getElementById('btnCancelBulkDelModal');
const btnConfirmBulkDelete = document.getElementById('btnConfirmBulkDelete');

// Elements cho Quick Time Filters
const btnFilterToday = document.getElementById('btnFilterToday');
const btnFilter7Days = document.getElementById('btnFilter7Days');
const btnFilter30Days = document.getElementById('btnFilter30Days');
const btnFilterThisMonth = document.getElementById('btnFilterThisMonth');
const selectAllOrders = document.getElementById('selectAllOrders');

// Danh sách nút lọc nhanh để quản lý active state
const quickFilterBtns = [btnFilterToday, btnFilter7Days, btnFilter30Days, btnFilterThisMonth];

// Đánh dấu nút active, bỏ active các nút khác
function setActiveFilterBtn(activeBtn) {
  quickFilterBtns.forEach(btn => {
    btn.classList.remove('btn-filter-active');
  });
  if (activeBtn) activeBtn.classList.add('btn-filter-active');
}

// State của trang
// Pagination elements
const ordersPagination = document.getElementById('ordersPagination');
const ordersPageInfo = document.getElementById('ordersPageInfo');
const ordersTotalLabel = document.getElementById('ordersTotalLabel');
const ordersPerPageEl = document.getElementById('ordersPerPage');
const ordersPrevBtn = document.getElementById('ordersPrevBtn');
const ordersNextBtn = document.getElementById('ordersNextBtn');

let allOrders = [];
let filteredOrders = [];
let selectedOrderIds = new Set();
let activeDeleteId = null;
let ordersPage = 1;
let ordersPerPage = 20;

async function loadOrders() {
  try {
    let orders = [];
    if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getOrders === 'function') {
      orders = await OrderStorage.getOrders();
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const key = (typeof OrderStorage !== 'undefined' && OrderStorage._getSavedOrdersKey)
        ? await OrderStorage._getSavedOrdersKey()
        : 'savedOrders';
      orders = await new Promise(r => chrome.storage.local.get([key, 'savedOrders'], res => r(res[key] || res.savedOrders || [])));
    }

    allOrders = Array.isArray(orders) ? orders : [];
    filterOrders();
  } catch (err) {
    console.error('Lỗi khi tải danh sách Đơn nháp:', err);
  }
}

function filterOrders() {
  const searchInpEl = document.getElementById('searchInp');
  const filterPlatformEl = document.getElementById('filterPlatform');

  const query = (searchInpEl?.value || '').trim().toLowerCase();
  const platform = (filterPlatformEl?.value || '').trim().toLowerCase();

  filteredOrders = allOrders.filter(o => {
    if (!o) return false;
    if (query) {
      const matchName = (o.name || '').toLowerCase().includes(query);
      const matchPhone = (o.phone || '').replace(/\D/g, '').includes(query.replace(/\D/g, ''));
      const matchCode = (o.orderCode || '').toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchCode) return false;
    }
    if (platform) {
      const p = (o.platform || '').toLowerCase();
      if (!p.includes(platform)) return false;
    }
    return true;
  });

  // Calculate totals
  let totalCod = 0;
  filteredOrders.forEach(o => {
    totalCod += Number(o.codAmount || 0);
  });

  if (statTotalOrders) statTotalOrders.textContent = filteredOrders.length;
  if (statTotalCod) statTotalCod.textContent = totalCod.toLocaleString('vi-VN') + 'đ';

  ordersPage = 1;
  renderOrdersList();
}

function renderOrdersList() {
  const tbody = document.getElementById('ordersList');
  const emptyEl = document.getElementById('emptyState');
  if (!tbody) return;

  if (filteredOrders.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (ordersPagination) ordersPagination.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (ordersPagination) ordersPagination.style.display = 'flex';

  const startIndex = (ordersPage - 1) * ordersPerPage;
  const pageOrders = filteredOrders.slice(startIndex, startIndex + ordersPerPage);

  let html = '';
  pageOrders.forEach(o => {
    const isChecked = selectedOrderIds.has(o.id) ? 'checked' : '';
    const platformLabel = (o.platform || '').toLowerCase().includes('jt') ? 'J&T Express' : 'VNPost';
    const platformClass = (o.platform || '').toLowerCase().includes('jt') ? 'badge-jt' : 'badge-vnpost';
    const codText = o.codAmount ? Number(o.codAmount).toLocaleString('vi-VN') + 'đ' : '0đ';

    const dateDisplay = o.createdAt
      ? (o.createdAt.length > 16 ? o.createdAt.substring(0, 16) : o.createdAt)
      : '—';

    html += `
      <tr data-id="${o.id}">
        <td style="text-align:center"><input type="checkbox" class="order-checkbox" value="${o.id}" ${isChecked}></td>
        <td>
          <div style="font-weight:700;color:var(--text-p)">${o.name || '—'}</div>
          <div style="font-size:12px;color:var(--primary);font-family:monospace">${o.phone || '—'}</div>
        </td>
        <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.address || ''}">${o.address || '—'}</td>
        <td>
          <div style="font-family:monospace;font-size:12px;font-weight:600">${o.orderCode || '—'}</div>
        </td>
        <td style="text-align:right;font-weight:700;color:#059669">${codText}</td>
        <td style="text-align:center">${o.collectFee ? '<span style="color:#2563eb;font-weight:700">Có</span>' : '<span style="color:#94a3b8">Không</span>'}</td>
        <td><span class="badge ${platformClass}">${platformLabel}</span></td>
        <td style="font-size:11px;color:var(--text-s)">${o.deviceName || 'Máy cục bộ'}</td>
        <td style="font-size:11px;color:var(--text-s)">${dateDisplay}</td>
        <td style="text-align:center">
          <button class="btn btn-primary btn-sm btn-fill-order" data-id="${o.id}" title="Nhập đơn lên trang web">🚀 Nhập đơn</button>
          <button class="btn btn-secondary btn-sm btn-view-order" data-id="${o.id}" title="Xem chi tiết">👁️</button>
          <button class="btn btn-danger btn-sm btn-del-order" data-id="${o.id}" title="Xóa">🗑️</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Pagination info
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage) || 1;
  if (ordersPageInfo) ordersPageInfo.textContent = `Trang ${ordersPage} / ${totalPages}`;
  if (ordersTotalLabel) ordersTotalLabel.textContent = `(${filteredOrders.length} đơn)`;
}

window.loadOrders = loadOrders;

// Elements cho Tab Submitted Orders (Đơn hàng đã lên đơn)
const subStatTotal = document.getElementById('stat-submitted-total');
const subStatCod = document.getElementById('stat-submitted-cod');
const subSearchInp = document.getElementById('submittedSearchInp');
const subSearchClear = document.getElementById('submittedSearchClear');
const subFilterPlatform = document.getElementById('submittedFilterPlatform');
const subFilterDevice = document.getElementById('submittedFilterDevice');
const subFilterFrom = document.getElementById('submittedFilterFrom');
const subFilterTo = document.getElementById('submittedFilterTo');
const subBtnClearFilters = document.getElementById('submittedBtnClearFilters');
const subBtnBulkDelete = document.getElementById('submittedBtnBulkDelete');
const subSelectedCount = document.getElementById('submittedSelectedCount');
const subListEl = document.getElementById('submittedList');
const subEmptyEl = document.getElementById('submittedEmpty');
const subSelectAll = document.getElementById('submittedSelectAll');
const subPagination = document.getElementById('submittedPagination');
const subPageInfo = document.getElementById('submittedPageInfo');
const subTotalLabel = document.getElementById('submittedTotalLabel');
const subPerPageEl = document.getElementById('submittedPerPage');
const subPrevBtn = document.getElementById('submittedPrevBtn');
const subNextBtn = document.getElementById('submittedNextBtn');
const subBtnToday = document.getElementById('submittedBtnToday');
const subBtn7Days = document.getElementById('submittedBtn7Days');
const subBtn30Days = document.getElementById('submittedBtn30Days');
const subBtnThisMonth = document.getElementById('submittedBtnThisMonth');

let allSubmittedOrders = [];
let filteredSubmittedOrders = [];
let selectedSubmittedIds = new Set();
let submittedPage = 1;
let submittedPerPage = 20;

async function loadSubmittedOrders() {
  try {
    let orders = [];
    if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getSubmittedOrders === 'function') {
      orders = await OrderStorage.getSubmittedOrders();
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const key = (typeof OrderStorage !== 'undefined' && OrderStorage._getSubmittedKey)
        ? await OrderStorage._getSubmittedKey()
        : 'submittedOrders';
      orders = await new Promise(r => chrome.storage.local.get([key, 'submittedOrders'], res => r(res[key] || res.submittedOrders || [])));
    }

    allSubmittedOrders = Array.isArray(orders) ? orders : [];
    filterSubmittedOrders();
  } catch (err) {
    console.error('Lỗi khi tải danh sách Đơn đã lên đơn:', err);
  }
}

function filterSubmittedOrders() {
  const query = (subSearchInp?.value || '').trim().toLowerCase();
  const platform = (subFilterPlatform?.value || '').trim().toLowerCase();
  const fromDate = subFilterFrom?.value || '';
  const toDate = subFilterTo?.value || '';

  filteredSubmittedOrders = allSubmittedOrders.filter(o => {
    if (!o) return false;
    if (query) {
      const matchName = (o.name || '').toLowerCase().includes(query);
      const matchPhone = (o.phone || '').replace(/\D/g, '').includes(query.replace(/\D/g, ''));
      const matchCode = (o.orderCode || '').toLowerCase().includes(query);
      const matchTracking = (o.trackingCode || '').toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchCode && !matchTracking) return false;
    }
    if (platform) {
      const p = (o.platform || '').toLowerCase();
      if (!p.includes(platform)) return false;
    }
    if (fromDate || toDate) {
      const orderDateStr = o.submittedDate || (o.submittedAt ? o.submittedAt.substring(0, 10) : '');
      if (orderDateStr) {
        if (fromDate && orderDateStr < fromDate) return false;
        if (toDate && orderDateStr > toDate) return false;
      }
    }
    return true;
  });

  // Calculate totals
  let totalCod = 0;
  filteredSubmittedOrders.forEach(o => {
    totalCod += Number(o.codAmount || 0);
  });

  if (subStatTotal) subStatTotal.textContent = filteredSubmittedOrders.length;
  if (subStatCod) subStatCod.textContent = totalCod.toLocaleString('vi-VN') + 'đ';

  submittedPage = 1;
  renderSubmittedOrdersList();
}

function renderSubmittedOrdersList() {
  const tbody = document.getElementById('submittedList');
  const emptyEl = document.getElementById('submittedEmpty');
  if (!tbody) return;

  if (filteredSubmittedOrders.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (subPagination) subPagination.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (subPagination) subPagination.style.display = 'flex';

  const startIndex = (submittedPage - 1) * submittedPerPage;
  const pageOrders = filteredSubmittedOrders.slice(startIndex, startIndex + submittedPerPage);

  let html = '';
  pageOrders.forEach(o => {
    const isChecked = selectedSubmittedIds.has(o.id) ? 'checked' : '';
    const platformLabel = (o.platform || '').toLowerCase().includes('jt') ? 'J&T Express' : 'VNPost';
    const platformClass = (o.platform || '').toLowerCase().includes('jt') ? 'badge-jt' : 'badge-vnpost';
    const codText = o.codAmount ? Number(o.codAmount).toLocaleString('vi-VN') + 'đ' : '0đ';
    const trackingHtml = o.trackingCode && o.trackingCode !== '—'
      ? `<span class="badge badge-success" style="font-family:monospace;font-size:11px">${o.trackingCode}</span>`
      : `<span style="color:var(--text-s);font-size:11px">Chờ cấp mã</span>`;

    const dateDisplay = o.submittedAt
      ? new Date(o.submittedAt).toLocaleString('vi-VN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : (o.submittedDate || '—');

    html += `
      <tr data-id="${o.id}">
        <td style="text-align:center"><input type="checkbox" class="sub-checkbox" value="${o.id}" ${isChecked}></td>
        <td>
          <div style="font-weight:700;color:var(--text-p)">${o.name || '—'}</div>
          <div style="font-size:12px;color:var(--primary);font-family:monospace">${o.phone || '—'}</div>
        </td>
        <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.address || ''}">${o.address || '—'}</td>
        <td>
          <div style="font-family:monospace;font-size:12px;font-weight:600">${o.orderCode || '—'}</div>
        </td>
        <td>${trackingHtml}</td>
        <td style="text-align:right;font-weight:700;color:#059669">${codText}</td>
        <td style="text-align:center">${o.collectFee ? '<span style="color:#2563eb;font-weight:700">Có</span>' : '<span style="color:#94a3b8">Không</span>'}</td>
        <td><span class="badge ${platformClass}">${platformLabel}</span></td>
        <td style="font-size:11px;color:var(--text-s)">${o.deviceName || 'Máy cục bộ'}</td>
        <td style="font-size:11px;color:var(--text-s)">${dateDisplay}</td>
        <td style="text-align:center">
          <button class="btn btn-secondary btn-sm btn-view-sub" data-id="${o.id}" title="Xem chi tiết">👁️</button>
          <button class="btn btn-danger btn-sm btn-del-sub" data-id="${o.id}" title="Xóa">🗑️</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Pagination info
  const totalPages = Math.ceil(filteredSubmittedOrders.length / submittedPerPage) || 1;
  if (subPageInfo) subPageInfo.textContent = `Trang ${submittedPage} / ${totalPages}`;
  if (subTotalLabel) subTotalLabel.textContent = `(${filteredSubmittedOrders.length} đơn)`;
}

window.loadSubmittedOrders = loadSubmittedOrders;

// Elements cho Tab Customers
const statTotalCustomers = document.getElementById('stat-total-customers');
const statVipCustomers = document.getElementById('stat-vip-customers');
const customerSearch = document.getElementById('customerSearch');
const searchClearCustomers = document.getElementById('searchClearCustomers');
const filterCustomerSegment = document.getElementById('filterCustomerSegment');
const filterCustomerCarrier = document.getElementById('filterCustomerCarrier');
const btnClearCustomerFilters = document.getElementById('btnClearCustomerFilters');
const customersTable = document.getElementById('customersTable');
const customersList = document.getElementById('customersList');
const customersEmpty = document.getElementById('customersEmpty');
const customersPagination = document.getElementById('customersPagination');
const customersTotalLabel = document.getElementById('customersTotalLabel');
const customersPerPageEl = document.getElementById('customersPerPage');
const customersPrevBtn = document.getElementById('customersPrevBtn');
const customersPageNumbers = document.getElementById('customersPageNumbers');
const customersNextBtn = document.getElementById('customersNextBtn');

// Elements cho Customer Modal
const customerModal = document.getElementById('customerModal');
const btnCloseCustomerModal = document.getElementById('btnCloseCustomerModal');
const custPhoneHidden = document.getElementById('custPhoneHidden');
const custNameInput = document.getElementById('custNameInput');
const custPhoneInput = document.getElementById('custPhoneInput');
const custFbInput = document.getElementById('custFbInput');
const custTagsSelect = document.getElementById('custTagsSelect');
const custNotesInput = document.getElementById('custNotesInput');
const btnCancelCustomerModal = document.getElementById('btnCancelCustomerModal');
const btnSaveCustomerModal = document.getElementById('btnSaveCustomerModal');

let customerMap = {};
let allCustomersList = [];
let filteredCustomersList = [];
let customerPage = 1;
let customerPerPage = 20;

async function renderCustomers() {
  try {
    let savedOrders = [];
    let submittedOrders = [];
    let customerMeta = {};

    if (typeof OrderStorage !== 'undefined') {
      if (typeof OrderStorage.getOrders === 'function') savedOrders = await OrderStorage.getOrders();
      if (typeof OrderStorage.getSubmittedOrders === 'function') submittedOrders = await OrderStorage.getSubmittedOrders();
      if (typeof OrderStorage.getCustomerMetadata === 'function') customerMeta = await OrderStorage.getCustomerMetadata();
    }

    customerMap = {};

    // 1. Process customer metadata map
    Object.entries(customerMeta || {}).forEach(([phoneKey, meta]) => {
      const cleanPhone = String(phoneKey).replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 8) return;
      customerMap[cleanPhone] = {
        phone: cleanPhone,
        name: meta.name || meta.fullName || 'Khách hàng',
        address: meta.address || '',
        totalOrders: meta.totalOrders || 0,
        totalCod: meta.totalCod || 0,
        lastOrderDate: meta.lastOrderDate || meta.updatedAt || '',
        platform: meta.platform || '',
        segment: meta.segment || (meta.totalOrders >= 3 ? 'vip' : 'new'),
        notes: meta.notes || ''
      };
    });

    // 2. Aggregate from saved draft orders
    (savedOrders || []).forEach(o => {
      if (!o || !o.phone) return;
      const cleanPhone = String(o.phone).replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 8) return;

      if (!customerMap[cleanPhone]) {
        customerMap[cleanPhone] = {
          phone: cleanPhone,
          name: o.name || 'Khách hàng',
          address: o.address || '',
          totalOrders: 0,
          totalCod: 0,
          lastOrderDate: o.createdAt || '',
          platform: o.platform || '',
          segment: 'new',
          notes: ''
        };
      }

      const c = customerMap[cleanPhone];
      c.totalOrders += 1;
      c.totalCod += Number(o.codAmount || 0);
      if (o.name && o.name !== 'Khách hàng' && (!c.name || c.name === 'Khách hàng')) c.name = o.name;
      if (o.address && !c.address) c.address = o.address;
      if (o.createdAt && (!c.lastOrderDate || o.createdAt > c.lastOrderDate)) c.lastOrderDate = o.createdAt;
      if (o.platform) c.platform = o.platform;
    });

    // 3. Aggregate from submitted orders
    (submittedOrders || []).forEach(o => {
      if (!o || !o.phone) return;
      const cleanPhone = String(o.phone).replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 8) return;

      if (!customerMap[cleanPhone]) {
        customerMap[cleanPhone] = {
          phone: cleanPhone,
          name: o.name || 'Khách hàng',
          address: o.address || '',
          totalOrders: 0,
          totalCod: 0,
          lastOrderDate: o.submittedAt || o.submittedDate || '',
          platform: o.platform || '',
          segment: 'new',
          notes: ''
        };
      }

      const c = customerMap[cleanPhone];
      c.totalOrders += 1;
      c.totalCod += Number(o.codAmount || 0);
      if (o.name && o.name !== 'Khách hàng' && (!c.name || c.name === 'Khách hàng')) c.name = o.name;
      if (o.address && !c.address) c.address = o.address;
      const orderDate = o.submittedAt || o.submittedDate || '';
      if (orderDate && (!c.lastOrderDate || orderDate > c.lastOrderDate)) c.lastOrderDate = orderDate;
      if (o.platform) c.platform = o.platform;
    });

    // Update Segment classification
    Object.values(customerMap).forEach(c => {
      if (c.totalOrders >= 3) c.segment = 'vip';
      else if (c.totalOrders === 2) c.segment = 'regular';
      else c.segment = 'new';
    });

    allCustomersList = Object.values(customerMap);
    allCustomersList.sort((a, b) => b.totalOrders - a.totalOrders || b.totalCod - a.totalCod);

    filterCustomersList();
  } catch (err) {
    console.error('Lỗi khi nạp danh sách Khách hàng:', err);
  }
}

function filterCustomersList() {
  const query = (customerSearch?.value || '').trim().toLowerCase();
  const segment = (filterCustomerSegment?.value || '').trim().toLowerCase();
  const carrier = (filterCustomerCarrier?.value || '').trim().toLowerCase();

  filteredCustomersList = allCustomersList.filter(c => {
    if (!c) return false;
    if (query) {
      const matchName = (c.name || '').toLowerCase().includes(query);
      const matchPhone = (c.phone || '').includes(query.replace(/\D/g, ''));
      const matchAddress = (c.address || '').toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchAddress) return false;
    }
    if (segment) {
      if (c.segment !== segment) return false;
    }
    if (carrier) {
      const p = (c.platform || '').toLowerCase();
      if (!p.includes(carrier)) return false;
    }
    return true;
  });

  const vipCount = allCustomersList.filter(c => c.segment === 'vip' || c.totalOrders >= 3).length;
  if (statTotalCustomers) statTotalCustomers.textContent = allCustomersList.length;
  if (statVipCustomers) statVipCustomers.textContent = vipCount;

  customerPage = 1;
  renderCustomersTable();
}

function renderCustomersTable() {
  const tbody = document.getElementById('customersList');
  const emptyEl = document.getElementById('customersEmpty');
  if (!tbody) return;

  if (filteredCustomersList.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (customersPagination) customersPagination.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (customersPagination) customersPagination.style.display = 'flex';

  const startIndex = (customerPage - 1) * customerPerPage;
  const pageCustomers = filteredCustomersList.slice(startIndex, startIndex + customerPerPage);

  let html = '';
  pageCustomers.forEach(c => {
    const badgeSegment = c.segment === 'vip'
      ? '<span class="badge badge-success" style="font-weight:700;font-size:10px">⭐ VIP</span>'
      : (c.segment === 'regular'
        ? '<span class="badge badge-info" style="font-weight:700;font-size:10px">Thường xuyên</span>'
        : '<span class="badge badge-secondary" style="font-weight:600;font-size:10px">Mới</span>');

    const dateDisplay = c.lastOrderDate
      ? (c.lastOrderDate.length > 10 ? c.lastOrderDate.substring(0, 10) : c.lastOrderDate)
      : '—';

    const codDisplay = c.totalCod ? Number(c.totalCod).toLocaleString('vi-VN') + 'đ' : '0đ';

    html += `
      <tr data-phone="${c.phone}">
        <td>
          <div style="font-weight:700;color:var(--text-p)">${c.name || 'Khách hàng'}</div>
          <div style="margin-top:2px">${badgeSegment}</div>
        </td>
        <td>
          <div style="font-size:12.5px;color:var(--primary);font-family:monospace;font-weight:600">${c.phone || '—'}</div>
        </td>
        <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.address || ''}">${c.address || '—'}</td>
        <td style="text-align:center;font-weight:700;color:var(--text-p)">${c.totalOrders || 0}</td>
        <td style="text-align:right;font-weight:700;color:#059669">${codDisplay}</td>
        <td style="font-size:11px;color:var(--text-s)">${dateDisplay}</td>
        <td style="text-align:center">
          <button class="btn btn-secondary btn-sm btn-edit-customer" data-phone="${c.phone}" title="Sửa ghi chú/gán thẻ">✏️ Ghi chú</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Pagination info
  const totalPages = Math.ceil(filteredCustomersList.length / customerPerPage) || 1;
  if (customersTotalLabel) customersTotalLabel.textContent = `(${filteredCustomersList.length} khách hàng)`;
}

window.renderCustomers = renderCustomers;

async function renderAnalytics() {
  try {
    let savedOrders = [];
    let submittedOrders = [];

    if (typeof OrderStorage !== 'undefined') {
      if (typeof OrderStorage.getOrders === 'function') savedOrders = await OrderStorage.getOrders();
      if (typeof OrderStorage.getSubmittedOrders === 'function') submittedOrders = await OrderStorage.getSubmittedOrders();
    }

    const allCombined = [...(savedOrders || []), ...(submittedOrders || [])];
    const currentMonthPrefix = new Date().toISOString().substring(0, 7);

    let monthTotalCount = 0;
    let monthTotalCod = 0;
    let vnpostCount = 0;
    let jtCount = 0;
    let submittedCount = (submittedOrders || []).length;
    let draftsCount = (savedOrders || []).length;

    allCombined.forEach(o => {
      if (!o) return;
      const platform = (o.platform || '').toLowerCase();
      if (platform.includes('jt')) jtCount++;
      else vnpostCount++;

      const dateStr = o.submittedAt || o.createdAt || o.submittedDate || '';
      if (dateStr && dateStr.startsWith(currentMonthPrefix)) {
        monthTotalCount++;
        monthTotalCod += Number(o.codAmount || 0);
      } else if (!dateStr) {
        monthTotalCount++;
        monthTotalCod += Number(o.codAmount || 0);
      }
    });

    const totalOrdersCount = allCombined.length || 1;
    const vnpostPct = Math.round((vnpostCount / totalOrdersCount) * 100);
    const jtPct = Math.round((jtCount / totalOrdersCount) * 100);

    const submittedPct = Math.round((submittedCount / totalOrdersCount) * 100);
    const draftsPct = Math.round((draftsCount / totalOrdersCount) * 100);

    // Update DOM
    const elMonthTotal = document.getElementById('stat-analytics-month-total');
    const elMonthCod = document.getElementById('stat-analytics-month-cod');
    const elVnpostCount = document.getElementById('stat-analytics-vnpost-count');
    const elJtCount = document.getElementById('stat-analytics-jt-count');

    if (elMonthTotal) elMonthTotal.textContent = monthTotalCount;
    if (elMonthCod) elMonthCod.textContent = monthTotalCod.toLocaleString('vi-VN') + 'đ';
    if (elVnpostCount) elVnpostCount.textContent = vnpostCount;
    if (elJtCount) elJtCount.textContent = jtCount;

    // Carrier Progress Bars
    const elVnpostPct = document.getElementById('analyticsVnpostPercent');
    const elVnpostBar = document.getElementById('analyticsVnpostBar');
    const elJtPct = document.getElementById('analyticsJtPercent');
    const elJtBar = document.getElementById('analyticsJtBar');

    if (elVnpostPct) elVnpostPct.textContent = `${vnpostPct}% (${vnpostCount} đơn)`;
    if (elVnpostBar) elVnpostBar.style.width = `${vnpostPct}%`;
    if (elJtPct) elJtPct.textContent = `${jtPct}% (${jtCount} đơn)`;
    if (elJtBar) elJtBar.style.width = `${jtPct}%`;

    // Status Progress Bars
    const elSubPct = document.getElementById('analyticsSubmittedPercent');
    const elSubBar = document.getElementById('analyticsSubmittedBar');
    const elDraftPct = document.getElementById('analyticsDraftsPercent');
    const elDraftBar = document.getElementById('analyticsDraftsBar');

    if (elSubPct) elSubPct.textContent = `${submittedPct}% (${submittedCount} đơn)`;
    if (elSubBar) elSubBar.style.width = `${submittedPct}%`;
    if (elDraftPct) elDraftPct.textContent = `${draftsPct}% (${draftsCount} đơn)`;
    if (elDraftBar) elDraftBar.style.width = `${draftsPct}%`;

  } catch (err) {
    console.error('Lỗi khi nạp dữ liệu Thống kê & Báo cáo:', err);
  }
}

window.renderAnalytics = renderAnalytics;

onDOMReady(async () => {
  // Load danh sách Đơn nháp, Đơn đã lên đơn, Khách hàng & Thống kê
  if (typeof loadOrders === 'function') loadOrders();
  if (typeof loadSubmittedOrders === 'function') loadSubmittedOrders();
  if (typeof renderCustomers === 'function') renderCustomers();
  if (typeof renderAnalytics === 'function') renderAnalytics();

  const btn = document.getElementById('btnOpenDashboard');
  if (btn) {
    btn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'openDashboard' });
      }
    });
  }

  // Khởi tạo phân quyền và ẩn tab theo vai trò
  let role = null;
  if (typeof AuthSession !== 'undefined') {
    const session = await AuthSession.getSession().catch(() => null);
    role = session?.role || 'VIEWER';
  } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const res = await new Promise(r => chrome.storage.local.get(['current_role'], r));
    role = res?.current_role || 'VIEWER';
  }

  // SHOP_STAFF hides certain tabs
  const staffHiddenTabs = ['shops', 'devices', 'address', 'logs'];
  // VIEWER hides even more, including settings and analytics
  const viewerHiddenTabs = [...staffHiddenTabs, 'settings', 'analytics', 'bulk', 'history'];

  let tabsToHide = [];
  if (role === 'VIEWER') tabsToHide = viewerHiddenTabs;
  else if (role === 'SHOP_STAFF' || role === 'SHOP_MANAGER') tabsToHide = staffHiddenTabs;

  if (tabsToHide.length > 0) {
    tabItems.forEach(item => {
      const tabName = item.getAttribute('data-tab');
      if (tabsToHide.includes(tabName)) {
        item.style.display = 'none';
      }
    });
  }

  // Lắng nghe tín hiệu thiết bị bị thu hồi từ Service Worker → tự đăng xuất
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && (request.type === 'deviceRevoked' || request.action === 'deviceRevoked')) {
        try {
          if (typeof AuthService !== 'undefined' && typeof AuthService.logout === 'function') AuthService.logout();
          else AuthSession.clearSession();
        } catch (_) {}
        chrome.storage.session?.remove(['fbAuthTokens', 'fbDeviceId', 'fbDeviceName'])?.catch?.(() => {});
        chrome.storage.local?.remove(['vnpost_session', 'fbAuthTokens', 'fbDeviceId', 'fbDeviceName'], () => {
          if (typeof showQuickToast === 'function') {
            showQuickToast('⚠️ Thiết bị này đã bị thu hồi. Vui lòng đăng nhập lại bằng thiết bị được phép.', 'error', 6000);
          } else {
            alert('Thiết bị này đã bị thu hồi. Bạn sẽ được chuyển đến trang đăng nhập.');
          }
          setTimeout(() => { window.location.href = 'options.html'; }, 2000);
        });
        if (sendResponse) sendResponse({ ok: true });
      }
    });
  }
});
