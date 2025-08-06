"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markChatAsRead = exports.getUnreadMessageCount = exports.isUserInChat = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const isUserInChat = async (userId, chatId) => {
    // ✅ Early return if chatId is not valid
    if (!chatId || typeof chatId !== 'string')
        return false;
    const member = await prisma_1.default.chatMember.findFirst({
        where: {
            userId,
            chatId,
        },
    });
    return !!member;
};
exports.isUserInChat = isUserInChat;
const getUnreadMessageCount = async (userId, chatId) => {
    try {
        // Get user's last read timestamp for this chat
        const readStatus = await prisma_1.default.chatReadStatus.findUnique({
            where: {
                userId_chatId: {
                    userId,
                    chatId,
                },
            },
        });
        // If no read status exists, count all messages in the chat
        const lastReadAt = readStatus?.lastReadAt || new Date(0);
        // Count messages after the last read timestamp
        const unreadCount = await prisma_1.default.message.count({
            where: {
                chatId,
                createdAt: {
                    gt: lastReadAt,
                },
                senderId: {
                    not: userId, // Don't count own messages as unread
                },
            },
        });
        return unreadCount;
    }
    catch (error) {
        console.error('Error calculating unread messages:', error);
        return 0;
    }
};
exports.getUnreadMessageCount = getUnreadMessageCount;
const markChatAsRead = async (userId, chatId) => {
    try {
        await prisma_1.default.chatReadStatus.upsert({
            where: {
                userId_chatId: {
                    userId,
                    chatId,
                },
            },
            update: {
                lastReadAt: new Date(),
            },
            create: {
                userId,
                chatId,
                lastReadAt: new Date(),
            },
        });
    }
    catch (error) {
        console.error('Error marking chat as read:', error);
    }
};
exports.markChatAsRead = markChatAsRead;
