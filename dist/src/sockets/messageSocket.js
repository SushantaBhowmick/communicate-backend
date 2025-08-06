"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMessageSocket = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const chatService_1 = require("../services/chatService");
const index_1 = require("./index");
const notification_1 = require("../services/notification");
const registerMessageSocket = (io, socket) => {
    const userId = socket.data.userId;
    console.log(socket.data);
    // ✅ Join a chat room
    socket.on('room:join', async (chatId) => {
        const allowed = await (0, chatService_1.isUserInChat)(userId, chatId);
        if (!allowed)
            return socket.emit('error', 'Unauthorized: not a room member');
        socket.join(chatId);
        console.log(`User ${userId} joined room ${chatId}`);
    });
    // ✅ Leave a chat room
    socket.on('room:leave', (chatId) => {
        socket.leave(chatId);
        console.log(`User ${userId} left room ${chatId}`);
    });
    // ✅ Typing Start
    socket.on('typing:start', ({ chatId, name }) => {
        socket.to(chatId).emit('typing:started', { chatId, userId, name });
    });
    // ✅ Typing Stop
    socket.on('typing:stop', ({ chatId }) => {
        socket.to(chatId).emit('typing:stopped', { chatId, userId });
    });
    // ✅ Seen Message
    socket.on('message:seen', async ({ messageId }) => {
        try {
            const message = await prisma_1.default.message.update({
                where: { id: messageId },
                data: {
                    seenBy: {
                        push: socket.data.userId
                    }
                }
            });
            io.to(message.chatId).emit('message:updated', {
                messageId: message.id,
                seenBy: message.seenBy
            });
        }
        catch (error) {
            console.error("Failed to mark message as seen:", error);
        }
    });
    // ✅ Send a message
    socket.on('message:send', async ({ chatId, content }) => {
        const allowed = await (0, chatService_1.isUserInChat)(userId, chatId);
        if (!allowed)
            return socket.emit('error', 'Unauthorized: cannot send to this chat');
        try {
            const message = await prisma_1.default.message.create({
                data: {
                    chatId,
                    content,
                    senderId: userId,
                    type: 'text',
                    seenBy: [userId],
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    sender: { select: { id: true, name: true, avatar: true } }
                }
            });
            // Update chat's updatedAt timestamp
            await prisma_1.default.chat.update({
                where: { id: chatId },
                data: { updatedAt: new Date() }
            });
            // Get all chat members to notify them of the update
            const chat = await prisma_1.default.chat.findUnique({
                where: { id: chatId },
                include: {
                    members: { select: { userId: true } }
                }
            });
            if (chat) {
                // Get users currently viewing this chat
                const usersViewingChat = (0, index_1.getUsersViewingChat)(chatId);
                // Notify all chat members via their personal rooms about chat update
                chat.members.forEach((member) => {
                    io.to(`user:${member.userId}`).emit('chat:updated', {
                        chatId,
                        latestMessage: {
                            id: message.id,
                            content: message.content,
                            createdAt: message.createdAt,
                            sender: message.sender
                        },
                        updatedAt: new Date()
                    });
                });
                // Send push notifications to users who are NOT viewing the chat
                const eligibleForNotification = chat.members.filter(member => member.userId !== userId && // Don't notify the sender
                    !usersViewingChat.includes(member.userId) // Don't notify users viewing the chat
                );
                // Get users with FCM tokens and send notifications
                if (eligibleForNotification.length > 0) {
                    const userIds = eligibleForNotification.map(member => member.userId);
                    // Fetch users with FCM tokens
                    prisma_1.default.user.findMany({
                        where: {
                            id: { in: userIds },
                            fcmToken: { not: null }
                        },
                        select: {
                            id: true,
                            name: true,
                            fcmToken: true
                        }
                    }).then(usersWithTokens => {
                        // Send notification to each user
                        usersWithTokens.forEach(async (user) => {
                            if (user.fcmToken) {
                                try {
                                    await (0, notification_1.sendNotification)(user.fcmToken, message.content, `${message.sender.name}`, {
                                        chatId,
                                        senderId: userId,
                                        senderName: message.sender.name
                                    });
                                    console.log(`📱 Push notification sent to ${user.name}`);
                                }
                                catch (error) {
                                    console.error(`Failed to send notification to ${user.name}:`, error);
                                }
                            }
                        });
                    }).catch(error => {
                        console.error('Error fetching users for notifications:', error);
                    });
                }
            }
            // Broadcast to all users in the room
            io.to(chatId).emit('message:receive', message);
        }
        catch (error) {
            console.error('Failed to send message:', error);
        }
    });
};
exports.registerMessageSocket = registerMessageSocket;
