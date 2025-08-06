"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFCMToken = exports.updateProfile = exports.searchUsers = exports.findUserByEmail = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const findUserByEmail = async (req, res) => {
    const { email } = req.query;
    const currentUserId = req.user.id;
    if (!email)
        return res.status(400).json({ message: "Email is required" });
    const user = await prisma_1.default.user.findUnique({ where: { email: email.toString() } });
    if (!user || user.id === currentUserId) {
        return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
};
exports.findUserByEmail = findUserByEmail;
const searchUsers = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { query } = req.query;
        if (!query || typeof query !== "string" || query.trim().length < 2) {
            return res.status(400).json({ message: "Search query too short" });
        }
        const users = await prisma_1.default.user.findMany({
            where: {
                id: { not: currentUserId },
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                    // {username:{contains:query,mode:"insensitive"}}, in future we can add username search
                ],
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                fcmToken: true,
            },
            take: 10,
        });
        res.json({ users });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.searchUsers = searchUsers;
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { name, bio, avatar, username } = req.body;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                name, bio, avatar, username
            }
        });
        res.json({ user: updatedUser });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateProfile = updateProfile;
const updateFCMToken = async (req, res) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;
        await prisma_1.default.user.update({
            where: { id: userId },
            data: { fcmToken: token }
        });
        res.json({ message: "FCM token updated successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateFCMToken = updateFCMToken;
