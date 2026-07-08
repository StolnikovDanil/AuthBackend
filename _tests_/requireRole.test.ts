import { describe, it, expect, vi } from 'vitest';
import { requireRole} from "../src/middlewares/requireRole.js";
import type { Response } from 'express';
import type { AuthRequest} from "../src/types/auth.js";


describe('requireRole middleware', () => {
    const createMockRes = () => {
        const res = {} as Response;
        res.status = vi.fn().mockReturnValue(res);
        res.json = vi.fn().mockReturnValue(res);
        return res;
    };

    it('пропускает пользователя с разрешённой ролью', () => {
        const req = { userRole: 'ADMIN' } as AuthRequest;
        const res = createMockRes();
        const next = vi.fn();

        requireRole('ADMIN')(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('блокирует пользователя без разрешённой роли', () => {
        const req = { userRole: 'USER' } as AuthRequest;
        const res = createMockRes();
        const next = vi.fn();

        requireRole('ADMIN')(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Недостаточно прав' });
    });

    it('блокирует запрос без роли вообще', () => {
        const req = {} as AuthRequest;
        const res = createMockRes();
        const next = vi.fn();

        requireRole('ADMIN')(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('пропускает если разрешено несколько ролей', () => {
        const req = { userRole: 'MODERATOR' } as AuthRequest;
        const res = createMockRes();
        const next = vi.fn();

        requireRole('ADMIN', 'MODERATOR')(req, res, next);

        expect(next).toHaveBeenCalledOnce();
    });
});