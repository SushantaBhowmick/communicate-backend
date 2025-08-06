"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = void 0;
const firebaseAdmin_1 = require("../utils/firebaseAdmin");
const sendNotification = async (fcmToken, message, title, data) => {
    try {
        await firebaseAdmin_1.messaging.send({
            token: fcmToken,
            notification: {
                title,
                body: message,
            },
            data: {
                chatId: data?.chatId || '',
                senderId: data?.senderId || '',
                senderName: data?.senderName || '',
            },
            android: {
                priority: "high",
            },
            webpush: {
                headers: {
                    Urgency: "high",
                }
            }
        });
    }
    catch (error) {
        console.error('Error sending FCM notification:', error);
        throw error;
    }
};
exports.sendNotification = sendNotification;
