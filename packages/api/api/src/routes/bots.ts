import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../auth.js";
import { broadcastToChannel } from "../ws.js";

const router = Router();

router.use(authMiddleware);

router.post("/bot/join", async (req: Request, res: Response) => {
  try {
    if (req.userType !== "bot") {
      res.status(403).json({ error: "Only bots can use this endpoint" });
      return;
    }

    const { channelId } = req.body;

    if (!channelId) {
      res.status(400).json({ error: "channelId is required" });
      return;
    }

    const channel = await db.query.channels.findFirst({
      where: eq(schema.channels.id, channelId),
    });

    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const existing = await db.query.channelMembers.findFirst({
      where: and(
        eq(schema.channelMembers.channel_id, channelId),
        eq(schema.channelMembers.user_id, req.userId!)
      ),
    });

    if (!existing) {
      await db.insert(schema.channelMembers).values({
        channel_id: channelId,
        user_id: req.userId!,
        role: "member",
      });
    }

    broadcastToChannel(channelId, {
      type: "bot_joined",
      channelId,
      botId: req.userId,
    });

    res.json({ success: true, channelId });
  } catch (err) {
    console.error("Bot join error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bot/typing", async (req: Request, res: Response) => {
  try {
    if (req.userType !== "bot") {
      res.status(403).json({ error: "Only bots can use this endpoint" });
      return;
    }

    const { channelId } = req.body;

    if (!channelId) {
      res.status(400).json({ error: "channelId is required" });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
      columns: { display_name: true },
    });

    broadcastToChannel(channelId, {
      type: "typing",
      channelId,
      userId: req.userId,
      displayName: user?.display_name || "Bot",
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Bot typing error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
