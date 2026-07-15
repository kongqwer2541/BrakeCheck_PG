const roleLabels = {
  head: 'Manager',
  assistant: 'Assistant Manager',
  officer: 'Officer'
};

const menuGroups = [
  {
    label: 'หลัก',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '▦', roles: ['head', 'assistant', 'officer'] },
      { id: 'barcode', label: 'ยิงบาร์โค้ด', icon: '⌗', roles: ['head', 'assistant', 'officer'] },
      { id: 'importExcel', label: 'นำเข้า Excel', icon: '⇧', roles: ['head', 'assistant'] },
      { id: 'manualLot', label: 'เพิ่ม Lot Manual', icon: '+', roles: ['head', 'assistant'] }
    ]
  },
  {
    label: 'ตรวจสอบ',
    items: [
      { id: 'dimension', label: 'ตรวจมิติ', icon: '◇', roles: ['head', 'assistant', 'officer'] },
      { id: 'packing', label: 'ตรวจบรรจุ', icon: '⬡', roles: ['head', 'assistant', 'officer'] },
      { id: 'approval', label: 'ตรวจและอนุมัติ', icon: '✓', roles: ['head', 'assistant'] }
    ]
  },
  {
    label: 'รายงาน',
    items: [
      { id: 'history', label: 'ประวัติ & NG', icon: '↺', roles: ['head', 'assistant', 'officer'] },
      { id: 'export', label: 'ส่งออก', icon: '⇩', roles: ['head', 'assistant'] },
      { id: 'exportDimension', label: 'Export Data', icon: '⇩', roles: ['head', 'assistant'] },
      { id: 'results', label: 'Results', icon: '⌕', roles: ['head', 'assistant', 'officer'] }
    ]
  },
  {
    label: 'ตั้งค่า',
    items: [
      { id: 'users', label: 'ผู้ใช้งาน', icon: '♙', roles: ['head'] },
      { id: 'settings', label: 'ตั้งค่าระบบ', icon: '⚙', roles: ['head', 'assistant'] }
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
    const items = group.items.filter((item) => item.roles.includes(user.role));

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
