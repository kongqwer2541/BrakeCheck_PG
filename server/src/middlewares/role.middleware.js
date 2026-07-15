export function requireRole(allowedRoles) {
  return (req, res, next) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!req.user || !roles.includes(req.user.role)) {
      const error = new Error('สิทธิ์ไม่เพียงพอ');
      error.statusCode = 403;
      next(error);
      return;
    }

    next();
  };
}
