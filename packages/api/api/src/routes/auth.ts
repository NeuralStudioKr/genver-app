import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db, schema } from "../db/index.js";
import { eq, and, isNull } from "drizzle-orm";
import { generateToken } from "../auth.js";

const router = Router();

router.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      res.status(400).json({ error: "email, password, and displayName are required" });
      return;
    }

    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        display_name: displayName,
        password_hash: passwordHash,
        type: "human",
        status: "offline",
      })
      .returning();

    // Auto-join general channel
    const generalCh = await db.query.channels.findFirst({
      where: and(eq(schema.channels.name, "general"), isNull(schema.channels.archived_at)),
    });
    if (generalCh) {
      await db.insert(schema.channelMembers).values({
        channel_id: generalCh.id,
        user_id: user.id,
        role: "member",
      }).onConflictDoNothing();
    }

    const token = generateToken(user.id, user.type);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        type: user.type,
        status: user.status,
      },
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user || !user.password_hash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken(user.id, user.type);

    await db
      .update(schema.users)
      .set({ status: "online", last_seen_at: new Date() })
      .where(eq(schema.users.id, user.id));

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        type: user.type,
        status: "online",
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
