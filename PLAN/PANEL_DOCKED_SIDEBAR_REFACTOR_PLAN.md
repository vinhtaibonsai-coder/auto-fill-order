# KẾ HOẠCH TRIỂN KHAI (PLAN CHO CODEX): NÂNG CẤP PANEL SANG DẠNG GHIM PHẢI (DOCKED RIGHT SIDEBAR) KÈM CHẾ ĐỘ NỔI (DUAL MODE)

> **Mục tiêu:** Chuyển đổi Injected Panel bóc tách đơn hàng trên các trang bưu điện (`my.vnpost.vn`, `jtexpress.vn`) từ dạng cửa sổ nổi che khuất màn hình sang **Dạng Thanh Bên Ghim Phải (Docked Right Drawer)** chuẩn Side-by-Side, đồng thời hỗ trợ chuyển đổi linh hoạt sang **Dạng Nổi (Floating Window)** theo nhu cầu người dùng.

---

## 1. Yêu Cầu Kỹ Thuật & Kiến Trúc (Architecture Overview)

### A. Hai Chế Độ Hiển Thị (Dual Display Modes)

```text
Chế độ 1: DOCKED (Mặc định - Ghim Cạnh Phải)
+-------------------------------------------------------------+-----------------------+
|                                                             | ⚡ AF ORDER [📌][_][✕] |
|                                                             ├───────────────────────┤
|               TRANG BƯU ĐIỆN VNPOST / J&T                   | 📋 Dán tin nhắn chat  |
|                                                             | [                   ] |
| Họ tên:     [ Nguyễn Văn A                                ] | [⚡ BÓC TÁCH]         |
| SĐT:        [ 0912345678                                  ] ├───────────────────────┤
| Tỉnh/Thành: [ TP. Hồ Chí Minh                           ▼ ] | ✅ Kết quả trích xuất |
| Quận/Huyện: [ Quận 1                                    ▼ ] | • Tên: Nguyễn Văn A   |
| Phường/Xã:  [ Phường Bến Thành                          ▼ ] | • SĐT: 0912345678     |
| Tiền COD:   [ 500.000 đ                                   ] | [🚀 ĐIỀN FORM NGAY]   |
+-------------------------------------------------------------+-----------------------+

Chế độ 1 khi Thu Gọn (Collapsed State):
+----------------------------------------------------------------------------------+---+
|                                                                                  | ⚡|
|                           TRANG BƯU ĐIỆN VNPOST / J&T                            | A |
|                                                                                  | F |
|                                                                                  | ◀ |
+----------------------------------------------------------------------------------+---+
(Panel trượt ẩn sang phải, chỉ hiện Tab nhỏ ở mép màn hình, bấm vào để mở lại)

Chế độ 2: FLOATING (Thả Nổi Tự Do)
- Panel trở thành cửa sổ nổi có thể kéo thả (Drag & Drop) đến bất kỳ vị trí nào trên trang.
```

### B. State Management trong Local Storage
Lưu trạng thái giao diện vào `chrome.storage.local`:
- `panel_display_mode`: `'docked'` (mặc định) hoặc `'floating'`.
- `panel_dock_collapsed`: `true` hoặc `false`.
- `panel_float_position`: `{ top: number, left: number }`.

---

## 2. Danh Sách Tệp Cần Chỉnh Sửa (Target Files)

1. [frontend/panel/styling/styles.js](file:///g:/Other%20computers/My%20Computer/WEBAPP/ODER%20AUTO%20FILL/frontend/panel/styling/styles.js) (và [ui.js / style.css](file:///g:/Other%20computers/My%20Computer/WEBAPP/ODER%20AUTO%20FILL/style.css)):
   - Bổ sung CSS cho class `.panel-docked`, `.panel-docked.collapsed`, `.panel-floating`.
   - Bổ sung CSS cho nút Tab mép phải `#vnpost-dock-toggle-tab`.
   - Bổ sung animation trượt `transform: translateX(100%)` mượt mà (cubic-bezier).
2. [frontend/panel/panel.js](file:///g:/Other%20computers/My%20Computer/WEBAPP/ODER%20AUTO%20FILL/frontend/panel/panel.js):
   - Thêm icon `dock` / `undock` vào `PANEL_ICONS`.
   - Thêm nút chuyển đổi chế độ `#vnpost-btn-dock-toggle` trên Header.
   - Thêm phần tử `#vnpost-dock-toggle-tab` hiển thị khi thu gọn ở chế độ Docked.
   - Cập nhật sự kiện kéo thả (Drag): Chỉ kích hoạt Drag khi đang ở chế độ `'floating'`.

---

## 3. Chi Tiết Triển Khai Kỹ Thuật (Step-by-Step Instructions)

### Bước 1: Cập Nhật CSS trong `frontend/panel/styling/styles.js`

Thêm và cập nhật các CSS rules sau vào chuỗi `PANEL_CSS`:

```css
/* --- CHẾ ĐỘ 1: DOCKED (GHIM MÉP PHẢI) --- */
#vnpost-autofill-panel.panel-docked {
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    left: auto !important;
    width: 380px !important;
    max-width: 90vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
    border-top: none !important;
    border-right: none !important;
    border-bottom: none !important;
    border-left: 1px solid var(--border-panel);
    box-shadow: -5px 0 25px rgba(0, 0, 0, 0.25) !important;
    transform: translateX(0);
    transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 280ms ease;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
}

#vnpost-autofill-panel.panel-docked #vnpost-panel-body {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 24px;
}

/* Trạng thái thu gọn khi Docked */
#vnpost-autofill-panel.panel-docked.collapsed {
    transform: translateX(100%) !important;
    box-shadow: none !important;
}

/* Tab nút bấm nổi ở mép phải khi thu gọn */
#vnpost-dock-toggle-tab {
    position: fixed !important;
    top: 50% !important;
    right: 0 !important;
    transform: translateY(-50%) !important;
    background: var(--theme-color, #0056b3) !important;
    color: #ffffff !important;
    padding: 12px 6px !important;
    border-top-left-radius: 10px !important;
    border-bottom-left-radius: 10px !important;
    border: 1px solid rgba(255, 255, 255, 0.25) !important;
    border-right: none !important;
    box-shadow: -3px 0 15px rgba(0, 0, 0, 0.2) !important;
    cursor: pointer !important;
    z-index: 2147483646 !important;
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    user-select: none;
    transition: transform 150ms ease, background 150ms ease;
}

#vnpost-dock-toggle-tab:hover {
    background: #2563eb !important;
    transform: translateY(-50%) scale(1.05) !important;
}

#vnpost-autofill-panel.panel-docked.collapsed ~ #vnpost-dock-toggle-tab,
#vnpost-autofill-panel.panel-docked.collapsed + #vnpost-dock-toggle-tab {
    display: flex !important;
}

/* --- CHẾ ĐỘ 2: FLOATING (THẢ NỔI TỰ DO) --- */
#vnpost-autofill-panel.panel-floating {
    position: fixed !important;
    width: 360px !important;
    max-height: 90vh !important;
    border-radius: 14px !important;
    border: 1px solid var(--border-panel) !important;
    box-shadow: var(--shadow-xl) !important;
    transform: none !important;
    z-index: 2147483647 !important;
}

#vnpost-autofill-panel.panel-floating.minimized {
    width: 48px !important;
    height: 48px !important;
    border-radius: 50% !important;
    overflow: hidden !important;
}
```

---

### Bước 2: Cập Nhật Logic trong `frontend/panel/panel.js`

1. **Thêm Icon vào `PANEL_ICONS`**:
   ```javascript
   dock: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Ghim mép phải"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
   float: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Thả nổi tự do"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><polyline points="9 11 12 14 22 4"/><polyline points="21 10 21 3 14 3"/></svg>`,
   ```

2. **Thêm Nút Dock/Float vào Header**:
   Trong HTML template của Header:
   ```html
   <button id="vnpost-btn-dock-toggle" title="Chuyển chế độ Ghim phải / Thả nổi">${PANEL_ICONS.float}</button>
   <button id="vnpost-btn-theme" title="Chuyển chế độ Sáng/Tối">${PANEL_ICONS.theme}</button>
   <button id="vnpost-btn-settings" title="Cài đặt">${PANEL_ICONS.settings}</button>
   <button id="vnpost-btn-minimize" title="Thu gọn">${PANEL_ICONS.minimize}</button>
   ```

3. **Tạo Phần Tử Tab Mép Phải (`#vnpost-dock-toggle-tab`) trong Shadow DOM**:
   ```javascript
   const dockTab = document.createElement('div');
   dockTab.id = 'vnpost-dock-toggle-tab';
   dockTab.innerHTML = `<span>⚡ AUTO FILL</span>`;
   dockTab.title = "Mở bảng Auto Fill Order";
   dockTab.onclick = () => {
     panel.classList.remove('collapsed');
     dockTab.style.display = 'none';
     chrome.storage.local.set({ panel_dock_collapsed: false });
   };
   root.appendChild(dockTab);
   ```

4. **Khởi Tạo Trạng Thái & Xử Lý Sự Kiện Chuyển Đổi**:
   ```javascript
   // Khởi tạo mode từ storage (mặc định là docked)
   chrome.storage.local.get(['panel_display_mode', 'panel_dock_collapsed', 'panel_float_position'], (res) => {
     const mode = res?.panel_display_mode || 'docked';
     const isCollapsed = Boolean(res?.panel_dock_collapsed);
     
     if (mode === 'docked') {
       panel.classList.add('panel-docked');
       panel.classList.remove('panel-floating');
       if (isCollapsed) {
         panel.classList.add('collapsed');
         dockTab.style.display = 'flex';
       }
     } else {
       panel.classList.add('panel-floating');
       panel.classList.remove('panel-docked');
       if (res?.panel_float_position) {
         panel.style.top = res.panel_float_position.top + 'px';
         panel.style.left = res.panel_float_position.left + 'px';
       }
     }
   });

   // Nút bấm chuyển Dock <-> Float
   const btnDockToggle = root.getElementById('vnpost-btn-dock-toggle');
   if (btnDockToggle) {
     btnDockToggle.onclick = (e) => {
       e.stopPropagation();
       const isCurrentlyDocked = panel.classList.contains('panel-docked');
       if (isCurrentlyDocked) {
         // Chuyển sang Floating
         panel.classList.remove('panel-docked', 'collapsed');
         panel.classList.add('panel-floating');
         dockTab.style.display = 'none';
         btnDockToggle.innerHTML = PANEL_ICONS.dock;
         btnDockToggle.title = "Ghim vào mép phải màn hình";
         chrome.storage.local.set({ panel_display_mode: 'floating' });
       } else {
         // Chuyển sang Docked
         panel.classList.remove('panel-floating', 'minimized');
         panel.classList.add('panel-docked');
         panel.style.top = '';
         panel.style.left = '';
         panel.style.right = '';
         btnDockToggle.innerHTML = PANEL_ICONS.float;
         btnDockToggle.title = "Thả nổi tự do";
         chrome.storage.local.set({ panel_display_mode: 'docked' });
       }
     };
   }

   // Nút Minimize khi ở chế độ Docked -> Thu gọn sang phải và hiện Tab
   const btnMinimize = root.getElementById('vnpost-btn-minimize');
   if (btnMinimize) {
     btnMinimize.onclick = (e) => {
       e.stopPropagation();
       if (panel.classList.contains('panel-docked')) {
         panel.classList.add('collapsed');
         dockTab.style.display = 'flex';
         chrome.storage.local.set({ panel_dock_collapsed: true });
       } else {
         panel.classList.toggle('minimized');
       }
     };
   }
   ```

5. **Ràng Buộc Kéo Thả (Drag & Drop)**:
   Chỉ cho phép kéo thả panel khi `panel.classList.contains('panel-floating')`. Khi ở chế độ `.panel-docked`, vô hiệu hóa sự kiện `mousedown` kéo panel để không làm xô lệch layout cố định.

---

## 4. Danh Mục Kiểm Thử (Verification Checklist)

- [ ] **Khởi động trên VNPost & J&T:** Panel xuất hiện ngay ngắn ở mép phải màn hình, không che khuất các input form bưu điện.
- [ ] **Thao tác thu gọn:** Bấm nút `[_]` (Minimize), panel trượt êm sang phải và xuất hiện nút Tab dọc `[⚡ AUTO FILL]` ở mép phải.
- [ ] **Thao tác mở lại:** Bấm vào nút Tab dọc, panel trượt ra lại vị trí cũ.
- [ ] **Chuyển đổi sang Chế độ Nổi (Float):** Bấm nút `📌`, panel biến thành cửa sổ nổi và kéo thả tự do khắp màn hình được.
- [ ] **Lưu cấu hình:** Tải lại trang (F5), panel nhớ đúng chế độ và trạng thái (Docked/Floating, Mở/Đóng) trước đó của người dùng.
- [ ] **Kiểm tra Autofill:** Điền đơn, bóc tách AI, chọn địa chỉ và sao chép dữ liệu hoạt động 100% bình thường.

---

## 5. Lệnh Chạy Kiểm Tra Build
```bash
npm run build
```
Đảm bảo build thành công không lỗi syntax hoặc thiếu icon.
