"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jwt_1 = require("../utils/jwt");
const prisma_1 = __importDefault(require("../config/prisma"));
const register = async (req, res) => {
    // console.log("Hello World controller")
    try {
        const { name, email, password } = req.body;
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ message: 'User already exists' });
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const newUser = await prisma_1.default.user.create({ data: { name, email, password: hashedPassword } });
        const token = (0, jwt_1.generateToken)(newUser.id);
        res.status(201).json({
            user: { id: newUser.id, name: newUser.name, email: newUser.email },
            token,
            message: 'User created successfully'
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.register = register;
const login = async (req, res) => {
    // console.log("Hello World controller")
    try {
        const { email, password } = req.body;
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            return res.status(400).json({ message: 'Invalid credentials' });
        const token = (0, jwt_1.generateToken)(user.id);
        res.status(200).json({
            user: { id: user.id, name: user.name, email: user.email },
            token,
            message: 'User logged in successfully'
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.login = login;
