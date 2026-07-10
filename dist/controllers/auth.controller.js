import * as authService from '../services/auth.services.js';
import { REFRESH_COOKIE_OPTIONS } from '../constants/app.constants.js';
export const register = async (req, res, next) => {
    const { email, password, name } = req.body;
    try {
        const user = await authService.register(email, password, name);
        res.status(201).json({ message: 'User registered successfully', user });
    }
    catch (error) {
        next(error);
    }
};
export const login = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const { accessToken, refreshToken } = await authService.login(email, password, req.ip ?? 'unknown', req.headers['user-agent']);
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
        res.json({ accessToken });
    }
    catch (error) {
        next(error);
    }
};
export const refresh = async (req, res, next) => {
    try {
        const oldRefreshToken = req.cookies?.refreshToken;
        if (!oldRefreshToken) {
            return res.status(401).json({ error: 'No refresh token provided' });
        }
        const { accessToken, refreshToken } = await authService.refresh(oldRefreshToken);
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
        res.json({ accessToken });
    }
    catch (error) {
        next(error);
    }
};
export const logout = async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            await authService.logout(refreshToken);
        }
        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out' });
    }
    catch (error) {
        next(error);
    }
};
