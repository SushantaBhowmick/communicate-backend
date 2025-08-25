import { Server, Socket } from "socket.io";
import prisma from "../config/prisma";
import { isUserInChat } from "../services/chatService";
import { getUsersViewingChat } from "./index";
import { sendNotification } from "../services/notification";

/** Payload for sending a message */
type MessageSendPayload = {
  tempId: string;
  chatId: string;
  content: string;
  type?: "text" | "image" | "video" | "audio" | "file" | "system" | "voice";
  metadata?: any;
  replyToId?: string;
  attachments?: Array<{
    url: string;
    mime: string;
    size: number;
    width?: number;
    height?: number;
    durationMs?: number;
    filename?: string;
  }>;
};

export const registerMessageSocket = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  // ✅ Join a chat room
  socket.on("room:join", async (chatId: string) => {
    try {
      const allowed = await isUserInChat(userId, chatId);
      if (!allowed)
        return socket.emit("error", "Unauthorized: not a room member");
      socket.join(chatId);
      console.log(`User ${userId} joined room ${chatId}`);

      // Mark last N messages as delivered for this user (idempotent via unique constraint)
      const recent = await prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true },
      });

      if (recent.length) {
        await prisma.messageReceipt.createMany({
          data: recent.map((m: any) => ({
            messageId: m.id,
            userId,
            status: "delivered",
          })),
          skipDuplicates: true,
        });

        io.to(chatId).emit("message:receipt", {
          userId,
          status: "delivered",
          at: new Date(),
          messageIds: recent.map((m: any) => m.id),
        });
      }
    } catch (error) {
      console.log("room:join error", error);
      socket.emit("error", "Failed to join room");
    }
  });

  // ✅ Leave a chat room
  socket.on("room:leave", (chatId: string) => {
    socket.leave(chatId);
    console.log(`User ${userId} left room ${chatId}`);
  });

  // ✅ Typing Start
  socket.on("typing:start", ({ chatId, name }) => {
    socket.to(chatId).emit("typing:started", { chatId, userId, name });
  });

  // ✅ Typing Stop
  socket.on("typing:stop", ({ chatId }) => {
    socket.to(chatId).emit("typing:stopped", { chatId, userId });
  });

  // ✅ Seen Message
  socket.on(
    "message:read",
    async ({
      chatId,
      messageIds,
    }: {
      chatId: string;
      messageIds: string[];
    }) => {
      try {
        const allowed = await isUserInChat(userId, chatId);
        if (!allowed) return socket.emit("error", "Unauthorized");

        const now = new Date();

        if (messageIds.length) {
          await prisma.messageReceipt.createMany({
            data: messageIds.map((id) => ({
              messageId: id,
              userId,
              status: "read",
              at: now,
            })),
            skipDuplicates: true,
          });
        } else {
          // Mark last N messages read
          const recent = await prisma.message.findMany({
            where: { chatId },
            orderBy: { createdAt: "desc" },
            take: 200,
            select: { id: true },
          });

          if (recent.length) {
            await prisma.messageReceipt.createMany({
              data: recent.map((m: any) => ({
                messageId: m.id,
                userId,
                status: "read",
                at: now,
              })),
              skipDuplicates: true,
            });
            messageIds = recent.map((m: any) => m.id);
          }
        }

        //update fast unread counter
        await prisma.chatReadStatus.upsert({
          where: { userId_chatId: { userId, chatId } },
          update: { lastReadAt: now },
          create: { userId, chatId, lastReadAt: now },
        });

        io.to(chatId).emit("message:receipt", {
          userId,
          status: "read",
          at: now,
          messageIds: messageIds ?? [],
        });
      } catch (error) {
        console.error("Failed to mark message as seen:", error);
      }
    }
  );

  // ✅ Send a message
  socket.on("message:send", async (p: MessageSendPayload) => {
    try {
      if (!p.chatId || !p.content || typeof p.content !== "string")
        return socket.emit("error", "Invalid message payload");

      const content = p.content.trim();
      if (!content && !p.attachments?.length)
        return socket.emit("error", "Message content is required");

      const type =
        p.type &&
        ["text", "image", "video", "audio", "file", "system", "voice"].includes(
          p.type
        )
          ? p.type
          : "text";

      const userId = socket.data.userId;
      const allowed = await isUserInChat(userId, p.chatId);
      if (!allowed)
        return socket.emit("error", "Unauthorized: cannot send to this chat");

      // 3) Persist (transaction ensures consistency)
      const { messageId, memberIds } = await prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            chatId: p.chatId,
            content,
            senderId: userId,
            type,
            metadata: p.metadata ?? null,
            replyToId: p.replyToId || null,
          },
          select: { id: true },
        });

        if (p.attachments?.length) {
          await tx.attachment.createMany({
            data: p.attachments.map((a: any) => ({
              messageId: created.id,
              url: a.url,
              mime: a.mime,
              size: a.size,
              width: a.width,
              height: a.height,
              durationMs: a.durationMs,
              filename: a.filename,
            })),
          });
        }

        // Update chat's updatedAt timestamp
        await tx.chat.update({
          where: { id: p.chatId },
          data: { updatedAt: new Date() },
        });

        const members = await tx.chatMember.findMany({
          where: { chatId: p.chatId },
          select: { userId: true },
        });

        const memberIds = members.map((m) => m.userId);

        await tx.messageReceipt.createMany({
          data: memberIds.map((uid) => ({
            messageId: created.id,
            userId: uid,
            status: "sent",
          })),
          skipDuplicates: true,
        });

        return { messageId: created.id, memberIds };
      });

      //load full msg

      const fullMessage = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
          attachments: true,
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              sender: { select: { id: true, name: true, avatar: true } },
            },
          },
        },
      });

      if (!fullMessage) return socket.emit("error", "Message not found");

      socket.emit("message:ack", { tempId: p.tempId, fullMessage });

      io.to(p.chatId).emit("message:receive", fullMessage);

      const deliveredTo = memberIds.filter((uid) => uid !== userId);

      if (deliveredTo.length) {
        const ts = new Date();
        await prisma.messageReceipt.createMany({
          data: memberIds
            .filter((uid) => uid !== userId)
            .map((uid) => ({
              messageId,
              userId: uid,
              status: "delivered",
              at: ts,
            })),
          skipDuplicates: true,
        });

        io.to(p.chatId).emit("message:receipt", {
          userId: null,
          status: "delivered",
          at: ts,
          messageIds: [messageId],
        });
      }

      // 8) Chat list preview update to personal rooms
      for (const uid of memberIds) {
        io.to(`user:${uid}`).emit("chat:updated", {
          chatId: p.chatId,
          latestMessage: {
            id: fullMessage.id,
            content: fullMessage.content,
            createdAt: fullMessage.createdAt,
            sender: fullMessage.sender,
            type: fullMessage.type,
          },
          updatedAt: new Date(),
        });
      }

      // Get all chat members to notify them of the update
      //   const chat = await prisma.chat.findUnique({
      //     where: { id: p.chatId },
      //     include: {
      //       members: { select: { userId: true } },
      //     },
      //   });

      //   if (chat) {
      //     // Get users currently viewing this chat
      //     const usersViewingChat = getUsersViewingChat(p.chatId);

      //     // Notify all chat members via their personal rooms about chat update
      //     chat.members.forEach((member) => {
      //       io.to(`user:${member.userId}`).emit("chat:updated", {
      //         chatId: p.chatId,
      //         latestMessage: {
      //           id: message.id,
      //           content: message.content,
      //           createdAt: message.createdAt,
      //           sender: message.sender,
      //         },
      //         updatedAt: new Date(),
      //       });
      //     });

      //     // Send push notifications to users who are NOT viewing the chat
      //     const eligibleForNotification = chat.members.filter(
      //       (member) =>
      //         member.userId !== userId && // Don't notify the sender
      //         !usersViewingChat.includes(member.userId) // Don't notify users viewing the chat
      //     );

      //     // Get users with FCM tokens and send notifications
      //     if (eligibleForNotification.length > 0) {
      //       const userIds = eligibleForNotification.map(
      //         (member) => member.userId
      //       );

      //       // Fetch users with FCM tokens
      //       prisma.user
      //         .findMany({
      //           where: {
      //             id: { in: userIds },
      //             fcmToken: { not: null },
      //           },
      //           select: {
      //             id: true,
      //             name: true,
      //             fcmToken: true,
      //           },
      //         })
      //         .then((usersWithTokens) => {
      //           // Send notification to each user
      //           usersWithTokens.forEach(async (user) => {
      //             if (user.fcmToken) {
      //               try {
      //                 await sendNotification(
      //                   user.fcmToken,
      //                   message.content,
      //                   `${message.sender.name}`,
      //                   {
      //                     chatId: p.chatId,
      //                     senderId: userId,
      //                     senderName: message.sender.name,
      //                   }
      //                 );
      //                 console.log(`📱 Push notification sent to ${user.name}`);
      //               } catch (error) {
      //                 console.error(
      //                   `Failed to send notification to ${user.name}:`,
      //                   error
      //                 );
      //               }
      //             }
      //           });
      //         })
      //         .catch((error) => {
      //           console.error("Error fetching users for notifications:", error);
      //         });
      //     }
      //   }

      // Broadcast to all users in the room

      const usersViewingChat = getUsersViewingChat(p.chatId);
      const notifyCandidates = deliveredTo.filter(
        (uid) => !usersViewingChat.includes(uid)
      );

      if (notifyCandidates.length) {
        const prefs = await prisma.chatNotificationPref.findMany({
          where: {
            chatId: p.chatId,
            userId: { in: notifyCandidates },
          },
          select: {
            userId: true,
            muted: true,
          },
        });

        const muted = new Set(
          prefs.filter((x) => x.muted).map((x) => x.userId)
        );

        const targetIds = notifyCandidates.filter((uid) => !muted.has(uid));

        if (targetIds.length) {
          const targets = await prisma.user.findMany({
            where: {
              id: { in: targetIds },
              fcmToken: { not: null },
            },
            select: {
              id: true,
              name: true,
              fcmToken: true,
            },
          });

          // compose sendable notification payload
          const title = fullMessage?.sender?.name ?? "New message";
          const body =
            fullMessage.type === "text"
              ? fullMessage.content
              : fullMessage.type === "image"
              ? "📷 Image"
              : fullMessage.type === "video"
              ? "📹 Video"
              : fullMessage.type === "voice" || fullMessage.type === "audio"
              ? "🎤 Voice message"
              : fullMessage.type === "file"
              ? "📎 File"
              : "New message";

          for (const u of targets) {
            if (!u.fcmToken) continue;

            try {
              await sendNotification(u.fcmToken, body, title, {
                chatId: p.chatId,
                senderId: userId,
                senderName: title,
                // messageId,
              });
            } catch (error) {
              console.log(`Failed to send notification to ${u.name}:`, error);
            }
          }
        }
      }
      //   io.to(p.chatId).emit("message:receive", message);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  });
};
