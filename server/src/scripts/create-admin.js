import bcrypt from 'bcrypt';
import { postgresDb } from '../config/database.js';

const adminUser = {
  employeeCode: process.env.ADMIN_EMPLOYEE_CODE || 'admin',
  fullName: process.env.ADMIN_FULL_NAME || 'ผู้ดูแลระบบ',
  position: process.env.ADMIN_POSITION || 'หัวหน้าหน่วย QC',
  role: 'head'
};

const blockedAdminPasswords = new Set([
  'Admin1234'
]);

function readAdminPassword() {
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!password.trim()) {
    throw new Error('ADMIN_PASSWORD must be set before creating the admin user.');
  }

  if (blockedAdminPasswords.has(password)) {
    throw new Error('ADMIN_PASSWORD must not use the old default password.');
  }

  return password;
}

async function createAdmin() {
  const adminPassword = readAdminPassword();
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const { rows: existingUsers } = await postgresDb.query(
    'SELECT id, employee_code, role FROM users WHERE employee_code = $1 LIMIT 1',
    [adminUser.employeeCode]
  );

  if (existingUsers.length > 0) {
    const existingUser = existingUsers[0];
    console.log(`User "${existingUser.employee_code}" already exists with role "${existingUser.role}".`);
    console.log('No new user was created.');
    return;
  }

  await postgresDb.query(
    `INSERT INTO users (
      employee_code,
      password_hash,
      full_name,
      position,
      role,
      status,
      must_change_password
    ) VALUES ($1, $2, $3, $4, $5, 'active', TRUE)`,
    [
      adminUser.employeeCode,
      passwordHash,
      adminUser.fullName,
      adminUser.position,
      adminUser.role
    ]
  );

  console.log('Admin user created successfully.');
  console.log(`Employee code: ${adminUser.employeeCode}`);
  console.log('Role: head');
  console.log('Must change password: true');
}

try {
  await createAdmin();
} catch (error) {
  console.error('Failed to create admin user.');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await postgresDb.end();
}
