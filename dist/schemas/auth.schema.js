import { z } from 'zod';
const emailField = z.string().trim().toLowerCase().email('Некорректный email');
export const registerSchema = z.object({
    email: emailField,
    password: z.string().min(6, 'Пароль должен быть не короче 6 символов'),
    name: z.string().min(1).optional()
});
export const loginSchema = z.object({
    email: emailField,
    password: z.string().min(1, 'Введите пароль')
});
