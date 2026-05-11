import { adminOnlyMiddleware, superAdminOnlyMiddleware } from "../middleware/adminOnly";
import { Router } from "express";
import authController from "../controllers/authController";

const router = Router();

router.post("/createUser", superAdminOnlyMiddleware, authController.createUser);

export default router;
