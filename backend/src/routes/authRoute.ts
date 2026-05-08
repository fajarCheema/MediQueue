// import { Router, Request, Response } from "express";
// import { z } from "zod";
// import { prisma } from "../../server";
// import {
//   hashPassword,
//   comparePassword,
//   generateAccessToken,
//   generateRefreshToken,
//   verifyRefreshToken,
//   getRefreshTokenExpiry,
// } from "../utils/auth";
// import { authMiddleware } from "../middleware/auth";

// const router = Router();

// const SignupSchema = z
//   .object({
//     email: z.string().email("Invalid email format"),
//     username: z.string().min(3, "Username must be at least 3 characters"),
//     password: z
//       .string()
//       .min(8, "Password must be at least 8 characters")
//       .regex(/[A-Z]/, "Password must contain uppercase letter")
//       .regex(/[0-9]/, "Password must contain number"),
//     password_confirm: z.string(),
//   })
//   .refine((data) => data.password === data.password_confirm, {
//     message: "Passwords don't match",
//     path: ["password_confirm"],
//   });

// const LoginSchema = z
//   .object({
//     email: z.string().email().optional(),
//     username: z.string().optional(),
//     password: z.string().min(1, "Password required"),
//   })
//   .refine((data) => data.email || data.username, {
//     message: "Either email or username is required",
//   });

// router.post("/signup", async (req: Request, res: Response): Promise<void> => {
//   try {
//     const validated = SignupSchema.parse(req.body);

//     const existingUser = await prisma.user.findFirst({
//       where: {
//         OR: [{ email: validated.email }, { username: validated.username }],
//       },
//     });

//     if (existingUser) {
//       res.status(400).json({ error: "Email or username already exists" });
//       return;
//     }

//     const hashedPassword = await hashPassword(validated.password);

//     const user = await prisma.user.create({
//       data: {
//         email: validated.email,
//         username: validated.username,
//         password: hashedPassword,
//         role: "PATIENT",
//       },
//     });

//     const accessToken = generateAccessToken(user.id, user.role);
//     const refreshToken = generateRefreshToken(user.id);

//     await prisma.refreshToken.create({
//       data: {
//         token: refreshToken,
//         userId: user.id,
//         expiresAt: getRefreshTokenExpiry(),
//       },
//     });

//     res.status(201).json({
//       user: {
//         id: user.id,
//         email: user.email,
//         username: user.username,
//         role: user.role,
//       },
//       accessToken,
//       refreshToken,
//     });
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       res.status(400).json({ errors: error.errors });
//     } else {
//       res.status(500).json({ error: "Signup failed" });
//     }
//   }
// });

// router.post("/login", async (req: Request, res: Response): Promise<void> => {
//   try {
//     const validated = LoginSchema.parse(req.body);

//     const user = await prisma.user.findFirst({
//       where: {
//         OR: [
//           { email: validated.email || "" },
//           { username: validated.username || "" },
//         ],
//       },
//     });

//     if (!user) {
//       res.status(401).json({ error: "Invalid credentials" });
//       return;
//     }

//     const isPasswordValid = await comparePassword(
//       validated.password,
//       user.password,
//     );
//     if (!isPasswordValid) {
//       res.status(401).json({ error: "Invalid credentials" });
//       return;
//     }

//     console.log(`User ${user.username} logged in with role: ${user.role}`);

//     const accessToken = generateAccessToken(user.id, user.role);
//     const refreshToken = generateRefreshToken(user.id);

//     await prisma.refreshToken.create({
//       data: {
//         token: refreshToken,
//         userId: user.id,
//         expiresAt: getRefreshTokenExpiry(),
//       },
//     });

//     res.json({
//       user: {
//         id: user.id,
//         email: user.email,
//         username: user.username,
//         role: user.role,
//       },
//       accessToken,
//       refreshToken,
//     });
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       res.status(400).json({ errors: error.errors });
//     } else {
//       res.status(500).json({ error: "Login failed" });
//     }
//   }
// });

// router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { refreshToken } = req.body;

//     if (!refreshToken) {
//       res.status(400).json({ error: "Refresh token required" });
//       return;
//     }

//     const decoded = verifyRefreshToken(refreshToken);
//     if (!decoded) {
//       res.status(401).json({ error: "Invalid refresh token" });
//       return;
//     }

//     const tokenRecord = await prisma.refreshToken.findUnique({
//       where: { token: refreshToken },
//     });

//     if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
//       res.status(401).json({ error: "Refresh token expired" });
//       return;
//     }

//     const user = await prisma.user.findUnique({
//       where: { id: decoded.userId },
//     });

//     if (!user) {
//       res.status(401).json({ error: "User not found" });
//       return;
//     }

//     const newAccessToken = generateAccessToken(user.id, user.role);
//     res.json({ accessToken: newAccessToken });
//   } catch (error) {
//     res.status(500).json({ error: "Token refresh failed" });
//   }
// });

// router.post(
//   "/logout",
//   authMiddleware,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { refreshToken } = req.body;

//       if (refreshToken) {
//         await prisma.refreshToken.deleteMany({
//           where: { token: refreshToken },
//         });
//       }

//       res.json({ message: "Logged out successfully" });
//     } catch (error) {
//       res.status(500).json({ error: "Logout failed" });
//     }
//   },
// );

// export default router;
