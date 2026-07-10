import * as UserServices from '../services/users.service.js';
export const getUsers = async (_req, res, next) => {
    try {
        const users = await UserServices.getAll();
        res.json(users);
    }
    catch (error) {
        next(error);
    }
};
export const deleteUser = async (req, res, next) => {
    const { id } = req.params;
    try {
        const user = await UserServices.deleteUser(Number(id));
        res.json(user);
    }
    catch (error) {
        next(error);
    }
};
export const updateUser = async (req, res, next) => {
    const { id } = req.params;
    const { name, email } = req.body;
    try {
        const user = await UserServices.updateUser(Number(id), name, email);
        res.json(user);
    }
    catch (error) {
        next(error);
    }
};
