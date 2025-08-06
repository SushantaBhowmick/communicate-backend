"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = exports.setUserChatView = exports.getUsersViewingChat = exports.getSocketServer = exports.setSocketServer = void 0;
const messageSocket_1 = require("./messageSocket");
const prisma_1 = __importDefault(require("../config/prisma"));
// Export io instance for use in controllers
let socketServer;
// Track which users are viewing which chats
const userChatViews = new Map(); // userId -> chatId
const setSocketServer = (io) => {
    socketServer = io;
};
exports.setSocketServer = setSocketServer;
const getSocketServer = () => socketServer;
exports.getSocketServer = getSocketServer;
const getUsersViewingChat = (chatId) => {
    const usersViewing = [];
    for (const [userId, viewingChatId] of userChatViews.entries()) {
        if (viewingChatId === chatId) {
            usersViewing.push(userId);
        }
    }
    return usersViewing;
};
exports.getUsersViewingChat = getUsersViewingChat;
const setUserChatView = (userId, chatId) => {
    if (chatId) {
        userChatViews.set(userId, chatId);
    }
    else {
        userChatViews.delete(userId);
    }
};
exports.setUserChatView = setUserChatView;
// Helper function to update user presence
const updateUserPresence = async (userId, isOnline) => {
    try {
        await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                isOnline,
                lastSeen: new Date(),
            },
        });
        // Emit presence update to users who share chats with this user
        const userChats = await prisma_1.default.chatMember.findMany({
            where: { userId },
            include: {
                chat: {
                    include: {
                        members: {
                            where: { userId: { not: userId } },
                            select: { userId: true }
                        }
                    }
                }
            }
        });
        // Get unique user IDs who share chats with this user
        const contactUserIds = new Set();
        userChats.forEach(chatMember => {
            chatMember.chat.members.forEach(member => {
                contactUserIds.add(member.userId);
            });
        });
        // Emit presence update to these users
        const io = (0, exports.getSocketServer)();
        if (io) {
            contactUserIds.forEach(contactUserId => {
                io.to(`user:${contactUserId}`).emit('user:presence', {
                    userId,
                    isOnline,
                    lastSeen: new Date(),
                });
            });
        }
    }
    catch (error) {
        console.error('Error updating user presence:', error);
    }
};
const registerSocketHandlers = (io, socket) => {
    const userId = socket.data.userId;
    console.log(`🔗 Socket handshake user ID: ${userId}`);
    // Join user to their personal notification room
    socket.join(`user:${userId}`);
    console.log(`👤 User ${userId} joined personal room: user:${userId}`);
    // Update user to online status
    updateUserPresence(userId, true);
    (0, messageSocket_1.registerMessageSocket)(io, socket);
    // Handle chat view tracking
    socket.on('chat:viewing', (data) => {
        (0, exports.setUserChatView)(userId, data.chatId);
        console.log(`👁️ User ${userId} is now viewing chat ${data.chatId}`);
    });
    socket.on('chat:not-viewing', () => {
        (0, exports.setUserChatView)(userId, null);
        console.log(`👁️ User ${userId} stopped viewing chat`);
    });
    socket.on('disconnect', () => {
        console.log(`🔗 Socket disconnected:  ${userId}`);
        // Clean up chat view tracking
        (0, exports.setUserChatView)(userId, null);
        // Update user to offline status
        updateUserPresence(userId, false);
    });
    // socket.on('join-room',(roomId:string)=>{
    //     socket.join(roomId);
    //     console.log(`🔗 Socket joined room: ${roomId}`);
    // })
};
exports.registerSocketHandlers = registerSocketHandlers;
