import prisma from "../config/prisma"



export const isUserInChat = async (userId: string, chatId: string | null | undefined) => {
  // ✅ Early return if chatId is not valid
  if (!chatId || typeof chatId !== 'string') return false;

  const member = await prisma.chatMember.findFirst({
    where: {
      userId,
      chatId,
    },
  });

  return !!member;
};

export const getUnreadMessageCount = async (userId: string, chatId: string) => {
  try {
    // Get user's last read timestamp for this chat
    const readStatus = await prisma.chatReadStatus.findUnique({
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
    const unreadCount = await prisma.message.count({
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
  } catch (error) {
    console.error('Error calculating unread messages:', error);
    return 0;
  }
};

export const markChatAsRead = async (userId: string, chatId: string) => {
  try {
    await prisma.chatReadStatus.upsert({
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
  } catch (error) {
    console.error('Error marking chat as read:', error);
  }
};