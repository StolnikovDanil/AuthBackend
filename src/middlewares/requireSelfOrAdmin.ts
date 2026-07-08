import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth.js';

export const requireSelfOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    const targetId = Number(req.params.id);

    if (req.userRole === 'ADMIN' || req.userId === targetId) {
        return next();
    }

    return res.status(403).json({ error: 'Недостаточно прав' });
};