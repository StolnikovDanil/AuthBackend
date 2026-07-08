import { z } from 'zod';

export const registerSchema = z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(6, 'Пароль должен быть не короче 6 символов'),
    name: z.string().min(1).optional()
});

export const loginSchema = z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(1, 'Введите пароль')
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;