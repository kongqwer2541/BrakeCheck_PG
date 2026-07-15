const roleLabels = {
  head: 'Manager',
  assistant: 'Assistant Manager',
  officer: 'Officer'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderHomePage({ user }) {
  return `
    <main class="app-shell">
      <header class="app-header">
        <div class="app-brand">
          <img class="header-logo" src="/Compact2.png" alt="COMPACT" />
          <div>
            <h1>BrakeCheck</h1>
          </div>
        </div>
        <div class="header-actions">
          ${user.role === 'head' ? '<button id="manageUsersButton" class="secondary-button" type="button">จัดการผู้ใช้</button>' : ''}
          <button id="logoutButton" class="secondary-button" type="button">ออกจากระบบ</button>
        </div>
      </header>

      <section class="dashboard-panel">
        <div>
          <p class="eyebrow">ผู้ใช้งานปัจจุบัน</p>
          <h2>${escapeHtml(user.fullName)}</h2>
        </div>

        <dl class="user-grid">
          <div>
            <dt>รหัสพนักงาน</dt>
            <dd>${escapeHtml(user.employeeCode)}</dd>
          </div>
          <div>
            <dt>ตำแหน่ง</dt>
            <dd>${escapeHtml(user.position)}</dd>
          </div>
          <div>
            <dt>สิทธิ์</dt>
            <dd>${roleLabels[user.role] || escapeHtml(user.role)}</dd>
          </div>
        </dl>
      </section>
    </main>
  `;
}

export function bindHomePage({ onLogout, onManageUsers }) {
  const manageUsersButton = document.querySelector('#manageUsersButton');
  if (manageUsersButton) {
    manageUsersButton.addEventListener('click', onManageUsers);
  }

  document.querySelector('#logoutButton').addEventListener('click', onLogout);
}
