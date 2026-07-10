import { z } from 'zod';
export const updateUserSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional()
});
