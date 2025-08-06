import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { findUserByEmail, getAllUsersrs, searchUsers, updateFCMToken, updateProfile } from "../controller/userController";

const router = Router();

router.get("/search", authMiddleware, findUserByEmail);
router.get("/search-users", authMiddleware, searchUsers);
router.put("/profile", authMiddleware, updateProfile);
router.put("/push-token", authMiddleware, updateFCMToken);
router.get("/", getAllUsersrs);

export default router;
