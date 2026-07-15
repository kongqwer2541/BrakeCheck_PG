const roleLabels = {
  head: 'Manager',
  assistant: 'Assistant Manager',
  officer: 'Officer'
};

const statusLabels = {
  active: 'ใช้งาน',
  suspended: 'ปิดใช้งาน'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderRoleOptions(selectedRole = 'officer') {
  return Object.entries(roleLabels)
    .map(([value, label]) => (
      `<option value="${value}" ${value === selectedRole ? 'selected' : ''}>${label}</option>`
    ))
    .join('');
}

function renderStatusOptions(selectedStatus = 'active') {
  return Object.entries(statusLabels)
    .map(([value, label]) => (
      `<option value="${value}" ${value === selectedStatus ? 'selected' : ''}>${label}</option>`
    ))
    .join('');
}

function renderRows(users) {
  if (!users.length) {
    return `
      <tr>
        <td colspan="7" class="empty-cell">ยังไม่มีผู้ใช้ในระบบ</td>
      </tr>
    `;
  }

  return users.map((user) => `
    <tr>
      <td>${escapeHtml(user.employeeCode)}</td>
      <td>${escapeHtml(user.fullName)}</td>
      <td>${escapeHtml(user.position)}</td>
      <td>${roleLabels[user.role] || escapeHtml(user.role)}</td>
      <td>
        <span class="status-pill ${user.status === 'active' ? 'active' : 'suspended'}">
          ${statusLabels[user.status] || escapeHtml(user.status)}
        </span>
      </td>
      <td>${user.mustChangePassword ? 'ต้องเปลี่ยน' : 'ปกติ'}</td>
      <td class="table-actions">
        <button class="secondary-button small-button" type="button" data-action="edit" data-user-id="${user.id}">แก้ไข</button>
        <button class="secondary-button small-button" type="button" data-action="reset" data-user-id="${user.id}">Reset</button>
      </td>
    </tr>
  `).join('');
}

export function renderUsersPage({ users, selectedUser = null, resetUser = null, message = '', error = '' }) {
  const isEditing = Boolean(selectedUser);

  return `
    <section class="users-page">
      ${message ? `<p class="alert success">${escapeHtml(message)}</p>` : ''}
      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}

      <section class="workspace-grid">
        <section class="management-panel wide-panel">
          <div class="panel-heading">
            <h2>รายชื่อผู้ใช้</h2>
            <p>${users.length} บัญชี</p>
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>รหัสพนักงาน</th>
                  <th>ชื่อ</th>
                  <th>ตำแหน่ง</th>
                  <th>สิทธิ์</th>
                  <th>สถานะ</th>
                  <th>รหัสผ่าน</th>
                  <th>คำสั่ง</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(users)}
              </tbody>
            </table>
          </div>
        </section>

        <form id="userForm" class="management-panel form-panel">
          <h2>${isEditing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</h2>
          <input type="hidden" name="userId" value="${selectedUser ? selectedUser.id : ''}" />

          <label class="field">
            รหัสพนักงาน
            <input
              name="employeeCode"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              maxlength="9"
              value="${selectedUser ? escapeHtml(selectedUser.employeeCode) : ''}"
              ${isEditing ? 'disabled' : 'required'}
            />
          </label>

          <label class="field">
            ชื่อ-นามสกุล
            <input name="fullName" type="text" value="${selectedUser ? escapeHtml(selectedUser.fullName) : ''}" required />
          </label>

          <label class="field">
            ตำแหน่ง
            <input name="position" type="text" value="${selectedUser ? escapeHtml(selectedUser.position) : 'เจ้าหน้าที่'}" required />
          </label>

          <label class="field">
            สิทธิ์
            <select name="role">
              ${renderRoleOptions(selectedUser ? selectedUser.role : 'officer')}
            </select>
          </label>

          <label class="field">
            สถานะ
            <select name="status">
              ${renderStatusOptions(selectedUser ? selectedUser.status : 'active')}
            </select>
          </label>

          ${isEditing ? '' : `
            <label class="field">
              รหัสผ่านชั่วคราว
              <input name="temporaryPassword" type="password" autocomplete="new-password" minlength="8" required />
            </label>
          `}

          <div class="form-actions">
            <button class="primary-button" type="submit">${isEditing ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}</button>
            ${isEditing ? '<button id="cancelEditButton" class="secondary-button" type="button">ยกเลิก</button>' : ''}
          </div>
        </form>

        ${resetUser ? `
          <form id="resetPasswordForm" class="management-panel form-panel reset-panel">
            <h2>Reset Password</h2>
            <p class="support-text">${escapeHtml(resetUser.employeeCode)} - ${escapeHtml(resetUser.fullName)}</p>

            <label class="field">
              รหัสผ่านชั่วคราว
              <input name="temporaryPassword" type="password" autocomplete="new-password" minlength="8" required />
            </label>

            <label class="field">
              ยืนยันรหัสผ่านชั่วคราว
              <input name="confirmTemporaryPassword" type="password" autocomplete="new-password" minlength="8" required />
            </label>

            <div class="form-actions">
              <button class="primary-button" type="submit">Reset Password</button>
              <button id="cancelResetButton" class="secondary-button" type="button">ยกเลิก</button>
            </div>
          </form>
        ` : ''}
      </section>
    </section>
  `;
}

export function bindUsersPage({
  onSubmitUser,
  onEditUser,
  onCancelEdit,
  onStartResetPassword,
  onCancelResetPassword,
  onConfirmResetPassword
}) {
  document.querySelector('#userForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    onSubmitUser({
      userId: formData.get('userId'),
      employeeCode: formData.get('employeeCode'),
      fullName: formData.get('fullName'),
      position: formData.get('position'),
      role: formData.get('role'),
      status: formData.get('status'),
      temporaryPassword: formData.get('temporaryPassword')
    });
  });

  const cancelButton = document.querySelector('#cancelEditButton');
  if (cancelButton) {
    cancelButton.addEventListener('click', onCancelEdit);
  }

  const resetPasswordForm = document.querySelector('#resetPasswordForm');
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(event.currentTarget);
      onConfirmResetPassword({
        temporaryPassword: formData.get('temporaryPassword'),
        confirmTemporaryPassword: formData.get('confirmTemporaryPassword')
      });
    });
  }

  const cancelResetButton = document.querySelector('#cancelResetButton');
  if (cancelResetButton) {
    cancelResetButton.addEventListener('click', onCancelResetPassword);
  }

  document.querySelector('.data-table').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const userId = Number(button.dataset.userId);
    if (button.dataset.action === 'edit') {
      onEditUser(userId);
      return;
    }

    if (button.dataset.action === 'reset') {
      onStartResetPassword(userId);
    }
  });
}
