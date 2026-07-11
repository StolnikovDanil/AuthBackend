import { z } from 'zod';
export const updateUserSchema = z.object({
    email: z.string().trim().toLowerCase().email('Некорректный email').optional(),
    name: z.string().min(1).optional()
});
