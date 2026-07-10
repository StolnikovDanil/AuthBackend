import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../src/schemas/auth.schema.js';
import { updateUserSchema } from '../src/schemas/users.schema.js';

describe('email normalization in schemas', () => {
    describe('registerSchema', () => {
        it('приводит email к нижнему регистру и обрезает пробелы', () => {
            const result = registerSchema.parse({
                email: '  User@Mail.Com  ',
                password: 'password123'
            });

            expect(result.email).toBe('user@mail.com');
        });

        it('отклоняет некорректный email после нормализации', () => {
            const result = registerSchema.safeParse({
                email: '  not-an-email  ',
                password: 'password123'
            });

            expect(result.success).toBe(false);
        });
    });

    describe('loginSchema', () => {
        it('приводит email к нижнему регистру и обрезает пробелы', () => {
            const result = loginSchema.parse({
                email: ' User@Mail.Com',
                password: 'anyPassword'
            });

            expect(result.email).toBe('user@mail.com');
        });
    });

    describe('updateUserSchema', () => {
        it('нормализует email, если он передан', () => {
            const result = updateUserSchema.parse({ email: 'Another.User@Example.COM' });

            expect(result.email).toBe('another.user@example.com');
        });

        it('не требует email (опционален)', () => {
            const result = updateUserSchema.parse({ name: 'Just a name' });

            expect(result.email).toBeUndefined();
        });
    });
});