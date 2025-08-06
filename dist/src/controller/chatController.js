"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markChatAsReadController = exports.getGroupcInfo = exports.createGroupChat = exports.getChatById = exports.startDirectChart = exports.InviteToChat = exports.getuserChats = exports.createChat = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const sockets_1 = require("../sockets");
const chatService_1 = require("../services/chatService");
const createChat = async (req, res) => {
    const userId = req.user.id;
    const { name, isGroup, members } = req.body;
    try {
        const chat = await prisma_1.default.chat.create({
            data: {
                name: isGroup ? name : null,
                isGroup,
                ownerId: isGroup ? userId : null,
                members: {
                    create: [
                        { userId, role: "ADMIN" },
                        ...members.map((id) => ({ userId: id })),
                    ],
                },
            },
        });
        res.status(201).json(chat);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create chat", error });
    }
};
exports.createChat = createChat;
const getuserChats = async (req, res) => {
    const userId = req.user.id;
    try {
        const chats = await prisma_1.default.chat.findMany({
            where: {
                members: { some: { userId } },
            },
            include: {
                members: {
                    include: { user: { select: { id: true, name: true, avatar: true } } },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        content: true,
                        createdAt: true,
                        sender: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });
        // Add latestMessage field and unread count for easier frontend access
        const chatsWithExtras = await Promise.all(chats.map(async (chat) => {
            const unreadCount = await (0, chatService_1.getUnreadMessageCount)(userId, chat.id);
            return {
                ...chat,
                latestMessage: chat.messages[0] || null,
                unreadCount,
            };
        }));
        res.status(200).json({ chats: chatsWithExtras });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to get chats", error });
    }
};
exports.getuserChats = getuserChats;
const InviteToChat = async (req, res) => {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { inviteUserId } = req.body;
    const chat = await prisma_1.default.chat.findUnique({
        where: { id: chatId },
        include: { members: true },
    });
    if (!chat)
        return res.status(404).json({ message: "Chat not found" });
    const isMember = chat.members.some((m) => m.userId === userId);
    if (!isMember)
        return res.status(403).json({ message: "Not a member" });
    try {
        const added = await prisma_1.default.chatMember.create({
            data: {
                chatId,
                userId: inviteUserId,
            },
        });
        res.status(201).json({ added });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create chat", error });
    }
};
exports.InviteToChat = InviteToChat;
const startDirectChart = async (req, res) => {
    const currentUserId = req.user.id;
    const { targetUserId } = req.body;
    if (!targetUserId || targetUserId === currentUserId) {
        return res.status(400).json({ message: "Invalid target user." });
    }
    // Check for existing DM
    const existingChat = await prisma_1.default.chat.findFirst({
        where: {
            isGroup: false,
            members: {
                some: { userId: currentUserId }
            },
            AND: {
                members: {
                    some: { userId: targetUserId }
                }
            }
        },
        include: {
            members: true,
        }
    });
    if (existingChat && existingChat.members.length === 2) {
        return res.json({ chat: existingChat });
    }
    // Create new 1-1 chat
    const chat = await prisma_1.default.chat.create({
        data: {
            isGroup: false,
            members: {
                create: [
                    { userId: currentUserId },
                    { userId: targetUserId },
                ],
            },
        },
        include: {
            members: {
                include: {
                    user: { select: { id: true, name: true, avatar: true } }
                }
            },
        }
    });
    // Emit chat creation to both users via their personal rooms
    const io = (0, sockets_1.getSocketServer)();
    if (io) {
        [currentUserId, targetUserId].forEach((userId) => {
            io.to(`user:${userId}`).emit('chat:created', {
                chat: {
                    id: chat.id,
                    name: chat.name,
                    isGroup: chat.isGroup,
                    members: chat.members,
                    createdAt: chat.createdAt
                }
            });
        });
    }
    res.status(201).json({ chat });
};
exports.startDirectChart = startDirectChart;
const getChatById = async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user.id;
    const chat = await prisma_1.default.chat.findUnique({
        where: { id: chatId },
        include: {
            members: {
                include: {
                    user: { select: { id: true, name: true, avatar: true } },
                },
            },
        },
    });
    if (!chat || !chat.members.find((m) => m.userId === userId)) {
        return res.status(403).json({ message: "Access denied" });
    }
    res.json({ chat });
};
exports.getChatById = getChatById;
const createGroupChat = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { name, userIds } = req.body;
        if (!name || !userIds || !Array.isArray(userIds) || userIds.length < 1) {
            return res.status(400).json({ message: "Name and at least 1 user are required." });
        }
        const allUserIds = Array.from(new Set([...userIds, currentUserId]));
        const chat = await prisma_1.default.chat.create({
            data: {
                name,
                isGroup: true,
                members: {
                    create: allUserIds.map((id) => ({
                        userId: id,
                        role: id === currentUserId ? "ADMIN" : "MEMBER"
                    }))
                }
            },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, name: true, avatar: true } }
                    }
                },
            }
        });
        // Emit chat creation to all members via their personal rooms
        const io = (0, sockets_1.getSocketServer)();
        if (io) {
            allUserIds.forEach((userId) => {
                io.to(`user:${userId}`).emit('chat:created', {
                    chat: {
                        id: chat.id,
                        name: chat.name,
                        isGroup: chat.isGroup,
                        members: chat.members,
                        createdAt: chat.createdAt
                    }
                });
            });
        }
        res.status(201).json({ chat });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create group chat", error });
    }
};
exports.createGroupChat = createGroupChat;
const getGroupcInfo = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        const chat = await prisma_1.default.chat.findUnique({
            where: { id: chatId },
            include: {
                members: {
                    include: { user: true }
                }
            }
        });
        if (!chat || !chat.isGroup) {
            return res.status(404).json({ message: "Group not found" });
        }
        const isMember = chat.members.some((m) => m.userId === userId);
        if (!isMember) {
            return res.status(403).json({ message: "Not a member" });
        }
        res.json({ chat });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to get group info", error });
    }
};
exports.getGroupcInfo = getGroupcInfo;
const markChatAsReadController = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        // Verify user is a member of the chat
        const isMember = await prisma_1.default.chatMember.findFirst({
            where: {
                userId,
                chatId,
            },
        });
        if (!isMember) {
            return res.status(403).json({ message: "Not a member of this chat" });
        }
        // Mark chat as read
        await (0, chatService_1.markChatAsRead)(userId, chatId);
        // Emit socket event to update unread count in real-time
        const io = (0, sockets_1.getSocketServer)();
        if (io) {
            io.to(`user:${userId}`).emit('chat:read', {
                chatId,
                unreadCount: 0,
            });
        }
        res.status(200).json({ message: "Chat marked as read" });
    }
    catch (error) {
        console.error('Error marking chat as read:', error);
        res.status(500).json({ message: "Failed to mark chat as read", error });
    }
};
exports.markChatAsReadController = markChatAsReadController;
