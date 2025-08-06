import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { isUserInChat } from '../services/chatService';

export const getMessagesByChat = async (req:Request,res:Response)=>{

    
    const chatId = req.params.chatId;
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const allowed = await isUserInChat(userId, chatId);
    if (!allowed) return res.status(403).json({ message: 'Access denied' });
    try {

        const messages = await prisma.message.findMany({
            where:{chatId},
            orderBy:{createdAt:'desc'},
            skip,
            take:limit,
            include:{
                sender:{select:{id:true,name:true,avatar:true}}
            }
        });

        res.json({
            messages,
            total:messages.length,
            page,
            limit
        })
        
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error' });
    }
}