import { Role } from "@prisma/client/edge";
import bcryptjs from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "";
const ACCESS_TOKEN_EXPIRY = (process.env.ACCESS_TOKEN_EXPIRY ||
  "1h") as SignOptions["expiresIn"];
const REFRESH_TOKEN_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY ||
  "7d") as SignOptions["expiresIn"];

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcryptjs.compare(password, hashedPassword);
}

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

type AccessTokenPayload = {
  userId: string;
  role: Role;
};

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload | null;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
    return decoded;
  } catch {
    return null;
  }
}

export function getRefreshTokenExpiry(): Date {
  const expiryStr =
    typeof REFRESH_TOKEN_EXPIRY === "string" ? REFRESH_TOKEN_EXPIRY : "7d";
  const date = new Date();

  if (expiryStr.endsWith("d")) {
    const days = parseInt(expiryStr, 10);
    date.setDate(date.getDate() + days);
  } else if (expiryStr.endsWith("h")) {
    const hours = parseInt(expiryStr, 10);
    date.setHours(date.getHours() + hours);
  }

  return date;
}
