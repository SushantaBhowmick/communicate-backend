import { messaging } from "../utils/firebaseAdmin";

interface NotificationData {
    chatId?: string;
    senderId?: string;
    senderName?: string;
}

export const sendNotification = async(
    fcmToken: string, 
    message: string, 
    title: string, 
    data?: NotificationData
) => {
    try {
        await messaging.send({
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
    } catch (error) {
        console.error('Error sending FCM notification:', error);
        throw error;
    }
}