import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth.js';

export const requireRole = (...allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.userRole || !allowedRoles.includes(req.userRole)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        next();
    };
};