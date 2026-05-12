import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/db";
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  hashPassword,
  verifyRefreshToken,
} from "../utils/auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const verificationToken = process.env.EMAIL_VERIFY_TOKEN || "";
const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;

const CreateUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["DOCTOR", "ADMIN"], {
    errorMap: () => ({ message: "Role must be DOCTOR or ADMIN" }),
  }),
});

const CreatePatientSchema = z.object({
  email: z.string().email("Invalid email format"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["PATIENT"], {
    errorMap: () => ({ message: "Role must be PATIENT" }),
  }),
});

const LoginSchema = z
  .object({
    email: z.string().email().optional(),
    username: z.string().optional(),
    password: z.string().min(1, "Password required"),
  })
  .refine((data) => data.email || data.username, {
    message: "Either email or username is required",
  });

const authController = {
  createUser: async (req: Request, res: Response): Promise<void> => {
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
          is_verified: true,
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

      res.status(200).json({
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
  },

  signup: async (req: Request, res: Response): Promise<void> => {
    try {
      const validated = CreatePatientSchema.parse(req.body);

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
          is_verified: false,
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

      await prisma.emailVerificationToken.create({
        data: {
          token: verificationToken,
          userId: user.id,
          expiresAt: new Date(
            Date.now() + 1000 * 60 * 60, // 1 hour
          ),
        },
      });

      //send email to user with verification link containing the token
      (async function () {
        const { data, error } = await resend.emails.send({
          from: "noreply@mediqueue.com",
          to: user.email,
          subject: "Verify your email",
          html: `
    <p>Click below to verify your email:</p>

    <a href="${verificationLink}">
      Verify Email
    </a>
  `,
        });

        if (error) {
          return console.error({ error });
        }

        console.log({ data });
      })();
      res.status(200).json({
        message:
          "Signup successful. Please verify your email to activate your account.",
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
          },
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create patient" });
      }
    }
  },

  login: async (req: Request, res: Response): Promise<void> => {
    try {
      const validated = LoginSchema.parse(req.body);

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: validated.email || "" },
            { username: validated.username || "" },
          ],
        },
      });

      if (!user) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const isPasswordValid = await comparePassword(
        validated.password,
        user.password,
      );
      if (!isPasswordValid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      console.log(`User ${user.username} logged in with role: ${user.role}`);

      const accessToken = generateAccessToken(user.id, user.role);
      const refreshToken = generateRefreshToken(user.id);

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      res.status(200).json({
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
        res.status(500).json({ error: "Login failed" });
      }
    }
  },

  refreshToken: async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: "Refresh token required" });
        return;
      }

      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        res.status(401).json({ error: "Invalid refresh token" });
        return;
      }

      const tokenRecord = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        res.status(401).json({ error: "Refresh token expired" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const newAccessToken = generateAccessToken(user.id, user.role);
      res.status(200).json({ accessToken: newAccessToken });
    } catch (error) {
      res.status(500).json({ error: "Token refresh failed" });
    }
  },

  logout: async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await prisma.refreshToken.deleteMany({
          where: { token: refreshToken },
        });
      }

      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ error: "Logout failed" });
    }
  },

  verifyEmail: async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.query.token as string;

      if (!token) {
        res.status(400).json({
          error: "Token missing",
        });

        return;
      }
      const verificationToken = await prisma.emailVerificationToken.findUnique({
        where: {
          token,
        },
      });

      if (!verificationToken) {
        res.status(400).json({
          error: "Invalid token",
        });

        return;
      }
      if (verificationToken.expiresAt < new Date()) {
        res.status(400).json({
          error: "Token expired",
        });
        return;
      }

      await prisma.user.update({
        where: {
          id: verificationToken.userId,
        },
        data: {
          is_verified: true,
        },
      });

      await prisma.emailVerificationToken.delete({
        where: {
          token,
        },
      });
      res.status(200).json({
        message: "Email verified successfully",
      });
    } catch (error) {
      res.status(500).json({ error: "Email verification failed" });
    }
  },
};
export default authController;
