import { pagePermissions } from '../config/app.config.js';

export function canUserOpenPage(user, page) {
  const allowedRoles = pagePermissions[page] || [];

  return Boolean(user && allowedRoles.includes(user.role));
}
