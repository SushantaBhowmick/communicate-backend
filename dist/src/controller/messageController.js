"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessagesByChat = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const chatService_1 = require("../services/chatService");
const getMessagesByChat = async (req, res) => {
    const chatId = req.params.chatId;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const allowed = await (0, chatService_1.isUserInChat)(userId, chatId);
    if (!allowed)
        return res.status(403).json({ message: 'Access denied' });
    try {
        const messages = await prisma_1.default.message.findMany({
            where: { chatId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                sender: { select: { id: true, name: true, avatar: true } }
            }
        });
        res.json({
            messages,
            total: messages.length,
            page,
            limit
        });
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMessagesByChat = getMessagesByChat;
