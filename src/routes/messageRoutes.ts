import { Router } from 'express';
import { getMessagesByChat } from '../controller/messageController';
import { authMiddleware } from '../middleware/authMiddleware';


const router = Router();

router.route('/:chatId').get(authMiddleware, getMessagesByChat)

export default router;