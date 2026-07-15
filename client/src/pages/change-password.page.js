function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderChangePasswordPage({ user, message = '' }) {
  return `
    <main class="auth-shell">
      <section class="auth-panel" aria-label="เปลี่ยนรหัสผ่าน">
        <div class="brand-block compact">
          <img class="brand-logo small" src="/Compact2.png" alt="COMPACT" />
          <p class="eyebrow">เข้าสู่ระบบครั้งแรก</p>
          <h1>เปลี่ยนรหัสผ่าน</h1>
          <p class="support-text">${escapeHtml(user.fullName)} (${escapeHtml(user.employeeCode)})</p>
        </div>

        <form id="changePasswordForm" class="auth-form">
          <label class="field">
            <span>รหัสผ่านปัจจุบัน</span>
            <input
              name="currentPassword"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>

          <label class="field">
            <span>รหัสผ่านใหม่</span>
            <input
              name="newPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            />
          </label>

          <label class="field">
            <span>ยืนยันรหัสผ่านใหม่</span>
            <input
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            />
          </label>

          ${message ? `<p class="alert error">${escapeHtml(message)}</p>` : ''}

          <button class="primary-button" type="submit">บันทึกรหัสผ่านใหม่</button>
        </form>
      </section>
    </main>
  `;
}

export function bindChangePasswordPage({ onChangePassword }) {
  const form = document.querySelector('#changePasswordForm');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const currentPassword = String(formData.get('currentPassword') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');

    onChangePassword({
      currentPassword,
      newPassword,
      confirmPassword
    });
  });
}
