function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderLoginPage({ onLogin, message = '' }) {
  return `
    <main class="auth-shell">
      <section class="auth-panel" aria-label="เข้าสู่ระบบ BrakeCheck">
        <div class="brand-block">
          <img class="brand-logo" src="/Compact2.png" alt="COMPACT" />
          <h1>BrakeCheck</h1>
        </div>

        <form id="loginForm" class="auth-form">
          <label class="field">
            <span>รหัสพนักงาน</span>
            <input
              id="employeeCode"
              name="employeeCode"
              autocomplete="username"
              inputmode="text"
              minlength="5"
              maxlength="20"
              placeholder="กรอกรหัสพนักงาน"
              required
            />
          </label>

          <label class="field">
            <span>รหัสผ่าน</span>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              minlength="8"
              required
            />
          </label>

          ${message ? `<p class="alert error">${escapeHtml(message)}</p>` : ''}

          <button class="primary-button" type="submit">เข้าสู่ระบบ</button>
        </form>
      </section>
    </main>
  `;
}

export function bindLoginPage({ onLogin }) {
  const form = document.querySelector('#loginForm');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    onLogin({
      employeeCode: String(formData.get('employeeCode') || '').trim(),
      password: String(formData.get('password') || '')
    });
  });
}
