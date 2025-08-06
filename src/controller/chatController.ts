import { Request, Response } from "express";
import prisma from "../config/prisma";
import { getSocketServer } from "../sockets";
import { getUnreadMessageCount, markChatAsRead } from "../services/chatService";

export const createChat = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { name, isGroup, members } = req.body;
  try {
    const chat = await prisma.chat.create({
      data: {
        name: isGroup ? name : null,
        isGroup,
        ownerId: isGroup ? userId : null,
        members: {
          create: [
            { userId, role: "ADMIN" },
            ...members.map((id: string) => ({ userId: id })),
          ],
        },
      },
    });
    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ message: "Failed to create chat", error });
  }
};
export const getuserChats = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  try {
    const chats = await prisma.chat.findMany({
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
    const chatsWithExtras = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await getUnreadMessageCount(userId, chat.id);
        return {
          ...chat,
          latestMessage: chat.messages[0] || null,
          unreadCount,
        };
      })
    );

    res.status(200).json({ chats: chatsWithExtras });
  } catch (error) {
    res.status(500).json({ message: "Failed to get chats", error });
  }
};

export const InviteToChat = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { chatId } = req.params;
  const { inviteUserId } = req.body;

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { members: true },
  });

  if (!chat) return res.status(404).json({ message: "Chat not found" });

  const isMember = chat.members.some((m) => m.userId === userId);
  if (!isMember) return res.status(403).json({ message: "Not a member" });

  try {
    const added = await prisma.chatMember.create({
      data: {
        chatId,
        userId: inviteUserId,
      },
    });
    res.status(201).json({ added });
  } catch (error) {
    res.status(500).json({ message: "Failed to create chat", error });
  }
};


export const startDirectChart = async (req: Request, res: Response) => {
     const currentUserId = (req as any).user.id;
  const { targetUserId } = req.body;

    if (!targetUserId || targetUserId === currentUserId) {
    return res.status(400).json({ message: "Invalid target user." });
  }


    // Check for existing DM
  const existingChat = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      members: {
       some:{userId:currentUserId}
      },
      AND:{
        members:{
            some:{userId:targetUserId}
        }
      }
    },
    include:{
        members:true,
    }
  });

    if (existingChat && existingChat.members.length === 2) {
    return res.json({ chat: existingChat });
  }
    // Create new 1-1 chat
  const chat = await prisma.chat.create({
    data: {
      isGroup: false,
      members: {
        create: [
          { userId: currentUserId },
          { userId: targetUserId },
        ],
      },
    },
    include:{
        members:{
          include:{
            user: { select: { id: true, name: true, avatar: true } }
          }
        },
    }
  });

  // Emit chat creation to both users via their personal rooms
  const io = getSocketServer();
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
}


export const getChatById = async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = (req as any).user.id;

  const chat = await prisma.chat.findUnique({
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


export const createGroupChat = async (req: Request, res: Response) => {
 
  try {
    const currentUserId = (req as any).user.id;
    const { name, userIds } = req.body;


  if (!name || !userIds || !Array.isArray(userIds) || userIds.length < 1) {
    return res.status(400).json({ message: "Name and at least 1 user are required." });
  }

  const allUserIds = Array.from(new Set([...userIds,currentUserId]));

  const chat = await prisma.chat.create({
    data:{
      name,
      isGroup:true,
      members:{
        create:allUserIds.map((id)=>({
          userId:id,
          role: id === currentUserId ? "ADMIN" : "MEMBER"
        }))
      }
    },
    include:{
      members:{
        include:{
          user: { select: { id: true, name: true, avatar: true } }
        }
      },
    }
  })

  // Emit chat creation to all members via their personal rooms
  const io = getSocketServer();
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

  res.status(201).json({chat})
    
  } catch (error) {
      res.status(500).json({message:"Failed to create group chat",error})
  }
};

export const getGroupcInfo=async(req:Request,res:Response)=>{
  try {
    const {chatId}=req.params;
    const userId = (req as any).user.id;

    const chat = await prisma.chat.findUnique({
      where:{id:chatId},
      include:{
        members:{
          include:{user:true}
        }
      }
    });
    if(!chat || !chat.isGroup) {
      return res.status(404).json({message:"Group not found"})
    }

    const isMember = chat.members.some((m)=>m.userId===userId)

    if(!isMember) {
      return res.status(403).json({message:"Not a member"})
    }

    res.json({chat})

  } catch (error) {
    res.status(500).json({message:"Failed to get group info",error})
  }
}

export const markChatAsReadController = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = (req as any).user.id;

    // Verify user is a member of the chat
    const isMember = await prisma.chatMember.findFirst({
      where: {
        userId,
        chatId,
      },
    });

    if (!isMember) {
      return res.status(403).json({ message: "Not a member of this chat" });
    }

    // Mark chat as read
    await markChatAsRead(userId, chatId);

    // Emit socket event to update unread count in real-time
    const io = getSocketServer();
    if (io) {
      io.to(`user:${userId}`).emit('chat:read', {
        chatId,
        unreadCount: 0,
      });
    }

    res.status(200).json({ message: "Chat marked as read" });
  } catch (error) {
    console.error('Error marking chat as read:', error);
    res.status(500).json({ message: "Failed to mark chat as read", error });
  }
};


