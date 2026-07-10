export const requireSelfOrAdmin = (req, res, next) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) {
        return res.status(400).json({ error: 'Неверный ID' });
    }
    if (req.userRole === 'ADMIN' || req.userId === targetId) {
        return next();
    }
    return res.status(403).json({ error: 'Недостаточно прав' });
};
