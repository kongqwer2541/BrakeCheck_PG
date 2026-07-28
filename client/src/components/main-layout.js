import { pagePermissions } from '../config/app.config.js';

const roleLabels = {
  head: 'Manager',
  assistant: 'Assistant Manager',
  officer: 'Officer'
};

const menuGroups = [
  {
    label: 'หลัก',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '▦' },
      { id: 'barcode', label: 'ยิงบาร์โค้ด', icon: '⌗' },
      { id: 'importExcel', label: 'นำเข้า Excel', icon: '⇧' },
      { id: 'manualLot', label: 'เพิ่ม Lot Manual', icon: '+' }
    ]
  },
  {
    label: 'ตรวจสอบ',
    items: [
      { id: 'dimension', label: 'ตรวจมิติ', icon: '◇' },
      { id: 'packing', label: 'ตรวจบรรจุ', icon: '⬡' },
      { id: 'approval', label: 'ตรวจและอนุมัติ', icon: '✓' }
    ]
  },
  {
    label: 'รายงาน',
    items: [
      { id: 'history', label: 'ประวัติ & NG', icon: '↺' },
      { id: 'export', label: 'ส่งออก', icon: '⇩' },
      { id: 'exportDimension', label: 'Export Data', icon: '⇩' },
      { id: 'results', label: 'Results', icon: '⌕' },
      { id: 'summary', label: 'Summary', icon: '▤' }
    ]
  },
  {
    label: 'ตั้งค่า',
    items: [
      { id: 'users', label: 'ผู้ใช้งาน', icon: '♙' },
      { id: 'settings', label: 'ตั้งค่าระบบ', icon: '⚙' }
    ]
  }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderMenuItem(item, activePage, badges = {}) {
  const isActive = item.id === activePage;
  const disabledAttribute = item.disabled ? 'disabled aria-disabled="true"' : '';
  const badge = badges[item.id] ?? item.badge;

  return `
    <button
      class="nav-item ${isActive ? 'active' : ''}"
      type="button"
      data-page="${item.id}"
      ${disabledAttribute}
    >
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span>${escapeHtml(item.label)}</span>
      ${badge ? `<span class="nav-badge">${escapeHtml(badge)}</span>` : ''}
    </button>
  `;
}

function renderMenuGroups(user, activePage, badges = {}) {
  return menuGroups.map((group) => {
    const items = group.items.filter((item) => pagePermissions[item.id]?.includes(user.role));

    if (!items.length) {
      return '';
    }

    return `
      <div class="nav-group">
        <p>${escapeHtml(group.label)}</p>
        ${items.map((item) => renderMenuItem(item, activePage, badges)).join('')}
      </div>
    `;
  }).join('');
}

export function renderMainLayout({ user, activePage, pageTitle, children, badges = {} }) {
  return `
    <main class="main-layout">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img src="/Compact2.png" alt="COMPACT" />
          <strong>BrakeCheck</strong>
        </div>

        <nav class="sidebar-nav" aria-label="เมนูหลัก">
          ${renderMenuGroups(user, activePage, badges)}
        </nav>
      </aside>

      <section class="main-workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">${escapeHtml(roleLabels[user.role] || user.role)}</p>
            <h1>${escapeHtml(pageTitle)}</h1>
          </div>
          <div class="topbar-user">
            <div class="topbar-user-detail">
              <strong>${escapeHtml(user.fullName)}</strong>
              <span>${escapeHtml(user.position || roleLabels[user.role] || user.role)}</span>
            </div>
            <button id="logoutButton" class="secondary-button" type="button">ออกจากระบบ</button>
          </div>
        </header>

        ${children}
      </section>
    </main>
  `;
}

export function bindMainLayout({ onNavigate, onLogout }) {
  document.querySelectorAll('.nav-item:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      onNavigate(button.dataset.page);
    });
  });

  document.querySelector('#logoutButton').addEventListener('click', onLogout);
}
