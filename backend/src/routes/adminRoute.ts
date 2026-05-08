import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from "../utils/auth";
import { adminOnlyMiddleware } from "../middleware/adminOnly";

const router = Router();

const CreateUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["DOCTOR", "ADMIN"], {
    errorMap: () => ({ message: "Role must be DOCTOR or ADMIN" }),
  }),
});

router.post("/users", adminOnlyMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = CreateUserSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: validated.email }, { username: validated.username }],
      },
    });

    if (existingUser) {
      res.status(400).json({ error: "Email or username already exists" });
      return;
    }

    const hashedPassword = await hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        username: validated.username,
        password: hashedPassword,
        role: validated.role,
      },
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create user" });
    }
  }
});

export default router;
