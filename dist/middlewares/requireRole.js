export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.userRole || !allowedRoles.includes(req.userRole)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        next();
    };
};
