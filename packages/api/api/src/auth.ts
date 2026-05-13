import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db, schema } from "./db/index.js";
import { eq, and } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "genver-dev-secret-key-change-in-production";

export interface AuthUser {
  userId: string;
  userType: "human" | "bot" | "system";
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userType?: "human" | "bot" | "system";
    }
  }
}

export function generateToken(userId: string, userType: string): string {
  return jwt.sign({ userId, userType }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, JWT_SECRET) as { userId: string; userType: string };
  return { userId: payload.userId, userType: payload.userType as AuthUser["userType"] };
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const botId = req.headers["x-bot-id"] as string | undefined;
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (botId && apiKey) {
      const user = await db.query.users.findFirst({
        where: and(eq(schema.users.id, botId), eq(schema.users.type, "bot")),
      });

      if (user && user.bot_api_key) {
        const valid = await bcrypt.compare(apiKey, user.bot_api_key);
        if (valid) {
          req.userId = user.id;
          req.userType = "bot";
          next();
          return;
        }
      }
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const decoded = verifyToken(token);
      req.userId = decoded.userId;
      req.userType = decoded.userType;
      next();
      return;
    }

    _res.status(401).json({ error: "Unauthorized" });
  } catch {
    _res.status(401).json({ error: "Unauthorized" });
  }
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  authMiddleware(req, _res, () => {
    next();
  });
}
