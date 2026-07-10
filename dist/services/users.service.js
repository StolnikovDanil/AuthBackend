import bcrypt from 'bcrypt';
import { prisma } from "../prisma.js";
import { SALT_ROUNDS } from "../constants/app.constants.js";
export const getAll = () => {
    return prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true
        }
    });
};
export const createUser = async (name, email, password) => {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return prisma.user.create({
        data: { name: name ?? null, email, password: hashedPassword },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true
        }
    });
};
export const deleteUser = (id) => {
    return prisma.user.delete({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true
        }
    });
};
export const updateUser = (id, name, email) => {
    return prisma.user.update({
        where: { id },
        data: { name, email },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true
        }
    });
};
