import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { eq, and, or, isNull } from "drizzle-orm";
import { authMiddleware } from "../auth.js";

const router = Router();

router.use(authMiddleware);

router.get("/channels", async (req: Request, res: Response) => {
  try {
    if (req.userType === "bot") {
      const allChannels = await db.query.channels.findMany({
        where: and(
          eq(schema.channels.type, "public"),
          isNull(schema.channels.archived_at)
        ),
        orderBy: (channels, { asc }) => [asc(channels.name)],
      });
      res.json({ channels: allChannels });
      return;
    }

    const memberships = await db.query.channelMembers.findMany({
      where: eq(schema.channelMembers.user_id, req.userId!),
      with: {
        channel: true,
      },
    });

    const channels = memberships
      .map((m) => m.channel)
      .filter((c) => c && !c.archived_at);

    res.json({ channels });
  } catch (err) {
    console.error("List channels error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/channels", async (req: Request, res: Response) => {
  try {
    const { name, displayName, description, type } = req.body;

    if (!name || !displayName) {
      res.status(400).json({ error: "name and displayName are required" });
      return;
    }

    const existing = await db.query.channels.findFirst({
      where: eq(schema.channels.name, name),
    });

    if (existing) {
      res.status(409).json({ error: "Channel name already exists" });
      return;
    }

    const [channel] = await db
      .insert(schema.channels)
      .values({
        name,
        display_name: displayName,
        description: description || null,
        type: type || "public",
        created_by: req.userId!,
      })
      .returning();

    await db.insert(schema.channelMembers).values({
      channel_id: channel.id,
      user_id: req.userId!,
      role: "admin",
    });

    res.status(201).json({ channel });
  } catch (err) {
    console.error("Create channel error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/channels/:id", async (req: Request, res: Response) => {
  try {
    const channel = await db.query.channels.findFirst({
      where: eq(schema.channels.id, req.params.id),
    });

    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const members = await db.query.channelMembers.findMany({
      where: eq(schema.channelMembers.channel_id, channel.id),
      with: {
        user: {
          columns: {
            id: true,
            display_name: true,
            email: true,
            type: true,
            status: true,
          },
        },
      },
    });

    res.json({
      channel,
      members: members.map((m) => ({
        ...m.user,
        role: m.role,
        joinedAt: m.joined_at,
      })),
    });
  } catch (err) {
    console.error("Get channel error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/channels/:id/members", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const channel = await db.query.channels.findFirst({
      where: eq(schema.channels.id, req.params.id),
    });

    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const existing = await db.query.channelMembers.findFirst({
      where: and(
        eq(schema.channelMembers.channel_id, req.params.id),
        eq(schema.channelMembers.user_id, userId)
      ),
    });

    if (existing) {
      res.status(409).json({ error: "User is already a member" });
      return;
    }

    await db.insert(schema.channelMembers).values({
      channel_id: req.params.id,
      user_id: userId,
      role: "member",
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete(
  "/channels/:id/members/:uid",
  async (req: Request, res: Response) => {
    try {
      await db
        .delete(schema.channelMembers)
        .where(
          and(
            eq(schema.channelMembers.channel_id, req.params.id),
            eq(schema.channelMembers.user_id, req.params.uid)
          )
        );

      res.json({ success: true });
    } catch (err) {
      console.error("Remove member error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
