import * as UserServices from '../services/users.service.js';
import type { Request, Response, NextFunction } from 'express';

export const getUsers = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
        try {
            const users = await UserServices.getAll();
            res.json(users);
        }
        catch (error) {
            next(error);
        }
}

export const deleteUser = async (
    req: Request, res: Response, next: NextFunction) => {
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId)) {
        return res.status(400).json({ error: 'Неверный ID' });
    }

    try {
        const user = await UserServices.deleteUser(targetId);
        res.json(user);
    } catch (error) {
        next(error);
    }
}

export const updateUser = async (
    req: Request, res: Response, next: NextFunction
) => {
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId)) {
        return res.status(400).json({ error: 'Неверный ID' });
    }

    const { name, email } = req.body;

    try {
        const user = await UserServices.updateUser(targetId, name, email);
        res.json(user);
    } catch (error) {
        next(error);
    }
}