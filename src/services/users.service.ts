import { prisma } from "../prisma.js";


export const getAll = () => {
    return prisma.user.findMany();
}

export const createUser = (name: string | undefined, email: string, password: string) => {
    return prisma.user.create({
        data: { name: name ?? null, email, password }
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