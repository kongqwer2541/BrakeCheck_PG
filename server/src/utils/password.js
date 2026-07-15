import bcrypt from 'bcrypt';

const saltRounds = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, saltRounds);
}

export function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  }

  return null;
}
