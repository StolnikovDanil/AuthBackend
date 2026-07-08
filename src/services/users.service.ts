import bcrypt from 'bcrypt';
import { prisma } from "../prisma.js";
import {SALT_ROUNDS} from "../constants/app.constants.js";


export const getAll = () => {
    return prisma.user.findMany();
}

export const createUser = async (name: string | undefined, email: string, password: string) => {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return prisma.user.create({
        data: { name: name ?? null, email, password: hashedPassword }
    });
};

export const deleteUser = (id: number) => {
    return prisma.user.delete({
            where: {id},

        }
    )
}

export const updateUser = (
    id: number, name: string, email: string) => {
    return prisma.user.update({
        where: { id},
        data: { name, email }
    })
}