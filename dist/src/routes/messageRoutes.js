"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const messageController_1 = require("../controller/messageController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.route('/:chatId').get(authMiddleware_1.authMiddleware, messageController_1.getMessagesByChat);
exports.default = router;
