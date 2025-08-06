import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { createChat, createGroupChat, getChatById, getGroupcInfo, getuserChats, InviteToChat, markChatAsReadController, startDirectChart } from "../controller/chatController";

const router = Router();

router.route('/').post(authMiddleware,createChat)
router.route('/').get(authMiddleware,getuserChats)
router.route('/:chatId/invite').post(authMiddleware,InviteToChat)
router.route('/direct').post(authMiddleware,startDirectChart)
router.route('/:chatId').get(authMiddleware,getChatById)
router.route('/group').post(authMiddleware,createGroupChat)
router.route('/:chatId/info').get(authMiddleware,getGroupcInfo)
router.route('/:chatId/read').post(authMiddleware,markChatAsReadController)

export default router