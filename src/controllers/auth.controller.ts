import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.services.js';

const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password, name } = req.body;
    try {
        const user = await authService.register(email, password, name);
        res.status(201).json({ message: 'User registered successfully', user });
    }
    catch (error) {
        next(error);
    }
}

export const login = async (req: Request, res: Response, next: NextFunction) => {
    const {email, password} = req.body;

    try {
        const { accessToken, refreshToken } = await authService.login(email, password);

        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
        res.json({ accessToken });
    } catch (error) {
        next(error);
    }
}

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const oldRefreshToken = req.cookies?.refreshToken;

        if(!oldRefreshToken) {
            return res.status(401).json({ error: 'No refresh token provided' });
        }

        const { accessToken, refreshToken } = await authService.refresh(oldRefreshToken);

        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
        res.json({ accessToken });
    }
    catch (error) {
        next(error);
    }
}

export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if(refreshToken) {
            await authService.logout(refreshToken)
        }

        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out' });
    }
    catch (error) {
        next(error);
    }

}